// src/components/SchedulePanel.jsx
import { useEffect, useMemo, useState } from 'react'
import { fetchTasks, updateTask } from '../api/airtable'
import { normalizeTask, schedule } from '../lib/scheduler'

const LS_KEY = 'cc.scheduler.settings.v3'
const DEFAULT_SETTINGS = {
  startHour: 9,
  endHour: 17,
  includeDeepAM: true,
  includeDeepPM: true,
  includeAdminAM: true,
  includeAdminPM: true,
  includeMeetings: true,
  ignoreAuto: true,        // plan even if Auto-Schedule is off
  includeScheduled: true,  // NEW: re-plan already scheduled tasks
}

function loadSettings() {
  try { return { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem(LS_KEY) || '{}')) } }
  catch { return { ...DEFAULT_SETTINGS } }
}
function saveSettings(s) { try { localStorage.setItem(LS_KEY, JSON.stringify(s)) } catch {} }

function buildBlocksForTodayFromSettings(s, now = new Date()) {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const at = (h, m) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0)
  const start = Math.min(s.startHour, s.endHour)
  const end = Math.max(s.startHour, s.endHour)

  const blocks = []
  const amStart = start
  const amEnd = Math.min(end, start + 2)
  const admin1Start = Math.min(end, start + 2)
  const admin1End = Math.min(end, start + 3)
  const pmStart = Math.max(start + 3, 14)
  const pmEnd = end

  if (s.includeDeepAM && amEnd > amStart) blocks.push({ kind: 'deep', start: at(amStart, 0), end: at(amEnd, 0) })
  if (s.includeAdminAM && admin1End > admin1Start) blocks.push({ kind: s.includeMeetings ? 'meeting' : 'admin', start: at(admin1Start, 0), end: at(admin1End, 0) })
  if (s.includeDeepPM && pmEnd > pmStart) {
    const deepPmEnd = Math.min(pmEnd, pmStart + 2)
    blocks.push({ kind: 'deep', start: at(pmStart, 0), end: at(deepPmEnd, 0) })
    if (s.includeAdminPM && pmEnd > deepPmEnd) blocks.push({ kind: s.includeMeetings ? 'meeting' : 'admin', start: at(deepPmEnd, 0), end: at(pmEnd, 0) })
  }
  blocks.sort((a, b) => a.start - b.start)
  return blocks
}

const iso = (d) => d.toISOString()
const hhmm = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

async function applyWithFallback(rec, fields) {
  const id = rec.id
  try {
    return await updateTask(id, fields)
  } catch (e1) {
    try {
      if (fields['Status']) return await updateTask(id, { 'Status': fields['Status'] })
    } catch (_) {}
    const windowText = fields['Scheduled Start'] && fields['Scheduled End']
      ? ` (Scheduled: ${hhmm(new Date(fields['Scheduled Start']))}–${hhmm(new Date(fields['Scheduled End']))})`
      : ''
    const existing = rec.fields?.['Notes'] || ''
    const note = `${existing}${existing ? ' ' : ''}Scheduled via planner${windowText}`
    return await updateTask(id, { 'Status': 'Scheduled', 'Notes': note })
  }
}

export default function SchedulePanel({ onRefresh }) {
  const [settings, setSettings] = useState(loadSettings())
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [records, setRecords] = useState([])
  const [plan, setPlan] = useState(null)
  const [applying, setApplying] = useState(false)
  const [resultMsg, setResultMsg] = useState('')

  useEffect(() => { saveSettings(settings) }, [settings])

  async function load() {
    setErr(''); setLoading(true); setResultMsg('')
    try {
      const recs = await fetchTasks({ pageSize: 100 })
      setRecords(recs || [])
    } catch (e) {
      setErr(String(e))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const normalized = useMemo(() => records.map(normalizeTask), [records])

  function makePlan() {
    setResultMsg('')
    const blocks = buildBlocksForTodayFromSettings(settings)
    const res = schedule(normalized, {
      blocks,
      ignoreAuto: settings.ignoreAuto,
      includeScheduled: settings.includeScheduled,
    })
    setPlan(res)
  }

  async function applyPlan() {
    if (!plan) return
    setApplying(true); setErr(''); setResultMsg('')
    let ok = 0, fail = 0
    try {
      for (const a of plan.assignments) {
        try {
          await applyWithFallback(a.raw, {
            'Status': 'Scheduled',
            'Scheduled Start': iso(a.start),
            'Scheduled End': iso(a.end),
          })
          ok++
        } catch { fail++ }
      }
      for (const u of plan.unscheduled) {
        try {
          const current = u.raw.fields?.['Notes'] || ''
          await updateTask(u.id, { 'Notes': `${current}${current ? ' ' : ''}Did not fit today` })
        } catch {}
      }
      await load()
      onRefresh?.()
      setPlan(null)
      setResultMsg(`Applied: ${ok} scheduled${fail ? `, ${fail} failed (see Notes/Status in Airtable)` : ''}.`)
    } catch (e) {
      setErr(String(e))
    } finally {
      setApplying(false)
    }
  }

  const today = plan?.today
  const counts = useMemo(() => {
    if (!plan) return null
    return {
      assigned: plan.assignments.length,
      unscheduled: plan.unscheduled.length,
      ineligible: plan.ineligible.length,
    }
  }, [plan])

  return (
    <div className="rounded-2xl border p-4 bg-white dark:bg-neutral-900">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold">Smart Scheduler</div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 rounded-lg border" onClick={load} disabled={loading}>
            {loading ? 'Loading…' : 'Reload'}
          </button>
          <button className="px-3 py-1 rounded-lg border" onClick={makePlan} disabled={loading}>
            Plan Today
          </button>
          <button
            className="px-3 py-1 rounded-lg border disabled:opacity-50"
            onClick={applyPlan}
            disabled={!plan || applying}
          >
            {applying ? 'Applying…' : 'Apply Plan'}
          </button>
        </div>
      </div>

      {/* Settings */}
      <div className="mb-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm opacity-70">Start</span>
          <input type="number" min={5} max={12} className="w-20 rounded border px-2 py-1"
            value={settings.startHour}
            onChange={e => setSettings(s => ({ ...s, startHour: Number(e.target.value || 9) }))} />
          <span className="text-sm opacity-70">End</span>
          <input type="number" min={13} max={22} className="w-20 rounded border px-2 py-1"
            value={settings.endHour}
            onChange={e => setSettings(s => ({ ...s, endHour: Number(e.target.value || 17) }))} />
        </div>

        <label className="flex items-center gap-2">
          <input type="checkbox" checked={settings.includeDeepAM}
            onChange={e => setSettings(s => ({ ...s, includeDeepAM: e.target.checked }))} />
          <span className="text-sm">AM Deep Work</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={settings.includeAdminAM}
            onChange={e => setSettings(s => ({ ...s, includeAdminAM: e.target.checked }))} />
          <span className="text-sm">AM Admin/Meet</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={settings.includeDeepPM}
            onChange={e => setSettings(s => ({ ...s, includeDeepPM: e.target.checked }))} />
          <span className="text-sm">PM Deep Work</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={settings.includeAdminPM}
            onChange={e => setSettings(s => ({ ...s, includeAdminPM: e.target.checked }))} />
          <span className="text-sm">PM Admin</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={settings.includeMeetings}
            onChange={e => setSettings(s => ({ ...s, includeMeetings: e.target.checked }))} />
          <span className="text-sm">Use Meetings block (else Admin)</span>
        </label>

        {/* NEW toggles */}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.ignoreAuto}
            onChange={e => setSettings(s => ({ ...s, ignoreAuto: e.target.checked }))}
          />
          <span className="text-sm">Ignore Auto-Schedule</span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.includeScheduled}
            onChange={e => setSettings(s => ({ ...s, includeScheduled: e.target.checked }))}
          />
          <span className="text-sm">Include already “Scheduled”</span>
        </label>
      </div>

      {err ? <div className="text-red-600 text-sm mb-2 break-words">{err}</div> : null}
      {resultMsg ? <div className="text-green-700 text-sm mb-2">{resultMsg}</div> : null}

      {!plan ? (
        <div className="text-sm opacity-70">
          Adjust settings, hit <span className="font-medium">Plan Today</span>, review, then <span className="font-medium">Apply Plan</span>.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm opacity-70">Plan for <span className="font-medium">{today}</span>:</div>
          <div className="text-xs opacity-80">
            Assigned: <b>{counts.assigned}</b> • Unscheduled: <b>{counts.unscheduled}</b> • Ineligible: <b>{counts.ineligible}</b>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <div className="text-sm font-medium mb-1">Assignments</div>
              {plan.assignments.length === 0 ? (
                <div className="text-sm opacity-70">No tasks fit into today’s blocks.</div>
              ) : (
                <ul className="text-sm space-y-1">
                  {plan.assignments.map(a => (
                    <li key={`${a.id}-${a.start.toISOString()}`} className="flex items-start gap-2">
                      <span className="opacity-60">{hhmm(a.start)}–{hhmm(a.end)}</span>
                      <span>•</span>
                      <span className="font-medium">{a.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Unscheduled</div>
              {plan.unscheduled.length === 0 ? (
                <div className="text-sm opacity-70">Everything fit. Nice.</div>
              ) : (
                <ul className="text-sm list-disc pl-5 space-y-1">
                  {plan.unscheduled.map(u => (
                    <li key={u.id}>
                      {u.name} <span className="opacity-60">({u.priority}, {u.context}, {u.energy}, {u.minutes}m)</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Debug: why skipped */}
          {plan.ineligible?.length ? (
            <div className="rounded-lg border p-2 bg-yellow-50 dark:bg-yellow-900/30">
              <div className="text-sm font-medium mb-1">Why some tasks weren’t eligible</div>
              <ul className="text-xs list-disc pl-5 space-y-1 max-h-64 overflow-y-auto">
                {plan.ineligible.map(x => (
                  <li key={x.id}>
                    <b>{x.name}</b> — {x.reasons.join(', ')}
                  </li>
                ))}
              </ul>
              <div className="text-xs opacity-60 mt-1">Showing {plan.ineligible.length} skipped tasks</div>
            </div>
          ) : (
            <div className="text-xs opacity-70 mt-1">No tasks were skipped.</div>
          )}
        </div>
      )}
    </div>
  )
}