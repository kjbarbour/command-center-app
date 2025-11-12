// src/components/AddTaskModal.jsx
import { useEffect, useRef, useState } from 'react'
import { createTask } from '../api/airtable'
import { classifyTask } from '../api/enrich'

/**
 * Props:
 * - onClose?(): optional; will be called on close, but modal also closes itself
 * - onCreated?(task)
 */
export default function AddTaskModal({ onClose, onCreated }) {
  // Local open state so the modal can always close itself
  const [open, setOpen] = useState(true)

  // ---- form state ----
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('Inbox')
  const [priority, setPriority] = useState('P3-Medium')
  const [energy, setEnergy] = useState('Medium')
  const [context, setContext] = useState('Admin')
  const [due, setDue] = useState('')
  const [project, setProject] = useState('')
  const [autoSchedule, setAutoSchedule] = useState(false)

  // ---- ai + ui state ----
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSug, setAiSug] = useState(null)
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  const nameRef = useRef(null)
  useEffect(() => { nameRef.current?.focus() }, [])

  // Close helper: always closes locally, then notifies parent (if any)
  function closeModal() {
    setOpen(false)
    try { onClose?.() } catch { /* no-op */ }
  }

  // Close on Escape
  useEffect(() => {
    function handler(e) { if (e.key === 'Escape') closeModal() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const Projects = [
    '', 'CRM Dashboard','Stem Sales','Command Center',
    'Business Development','Personal','Home Improvement','Learning','Health'
  ]

  async function runTriage() {
    setAiLoading(true); setErr('')
    try {
      const text = [name, notes].filter(Boolean).join('\n')
      const out = await classifyTask(text)
      setAiSug(out)
    } catch (e) {
      console.error('[AddTaskModal] classify error:', e)
      setErr('AI triage failed. Try again or proceed without it.')
    } finally {
      setAiLoading(false)
    }
  }

  function applyTriage() {
    if (!aiSug) return
    setStatus(aiSug.Status)
    setPriority(aiSug.Priority)
    setEnergy(aiSug.EnergyLevel)
    setContext(aiSug.Context)
    setProject(aiSug.Project || '')
    setAutoSchedule(Boolean(aiSug.AutoSchedule))
    setDue(aiSug.DueDate || '')
  }

  async function save() {
    console.log('[AddTaskModal] Save clicked')
    setErr('')
    if (!name.trim()) { setErr('Task name required'); return }

    const fields = {
      'Task Name': name.trim(),
      'Status': status,
      'Priority': priority,
      'Energy Level': energy,
      'Context': context,
      'Notes': notes || '',
      'Auto-Schedule': autoSchedule,
    }
    if (due) fields['Due Date'] = due
    if (project) fields['Project'] = project

    try {
      setSaving(true)
      const created = await createTask(fields)
      onCreated?.(created)
      // Always close on success
      closeModal()
    } catch (e) {
      console.error('[AddTaskModal] Save error:', e)
      setErr(String(e?.message || e))
    } finally {
      setSaving(false)
    }
  }

  // If locally closed, unmount the modal entirely
  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      // Backdrop click closes (ignore clicks inside the card)
      onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal() }}
    >
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-neutral-900 shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Add Task</h2>
          <button onClick={closeModal} className="px-3 py-1 rounded-lg border">Close</button>
        </div>

        {err ? <div className="text-red-600 text-sm break-words">{err}</div> : null}

        <label className="block space-y-1">
          <span className="text-sm opacity-80">Task Name</span>
          <input
            ref={nameRef}
            className="w-full rounded-lg border px-3 py-2"
            value={name}
            onChange={e=>setName(e.target.value)}
            placeholder="e.g., Fix dashboard tooltip currency"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm opacity-80">Notes</span>
          <textarea
            className="w-full rounded-lg border px-3 py-2 min-h-[90px]"
            value={notes}
            onChange={e=>setNotes(e.target.value)}
            placeholder="Context, links, acceptance criteria…"
          />
        </label>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <label className="block">
            <span className="text-sm opacity-80">Status</span>
            <select className="w-full rounded-lg border px-3 py-2" value={status} onChange={e=>setStatus(e.target.value)}>
              <option>Inbox</option>
              <option>Today</option>
              <option>This Week</option>
              <option>Scheduled</option>
              <option>Done</option>
              <option>Someday</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm opacity-80">Priority</span>
            <select className="w-full rounded-lg border px-3 py-2" value={priority} onChange={e=>setPriority(e.target.value)}>
              <option>P1-Critical</option>
              <option>P2-High</option>
              <option>P3-Medium</option>
              <option>P4-Low</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm opacity-80">Energy Level</span>
            <select className="w-full rounded-lg border px-3 py-2" value={energy} onChange={e=>setEnergy(e.target.value)}>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm opacity-80">Context</span>
            <select className="w-full rounded-lg border px-3 py-2" value={context} onChange={e=>setContext(e.target.value)}>
              <option>Deep Work</option>
              <option>Meetings</option>
              <option>Admin</option>
              <option>Quick Wins</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm opacity-80">Due Date</span>
            <input
              type="date"
              className="w-full rounded-lg border px-3 py-2"
              value={due}
              onChange={e=>setDue(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-sm opacity-80">Project</span>
            <select className="w-full rounded-lg border px-3 py-2" value={project} onChange={e=>setProject(e.target.value)}>
              {Projects.map(p => <option key={p} value={p}>{p || '—'}</option>)}
            </select>
          </label>

          <label className="flex items-center gap-2 col-span-2">
            <input
              type="checkbox"
              checked={autoSchedule}
              onChange={e=>setAutoSchedule(e.target.checked)}
            />
            <span className="text-sm">Auto-Schedule</span>
          </label>
        </div>

        {/* AI Suggestions */}
        <div className="rounded-xl border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-medium">AI Suggestions</div>
            <div className="flex items-center gap-2">
              <button
                onClick={runTriage}
                className="px-3 py-1 rounded-lg border disabled:opacity-50"
                disabled={aiLoading}
              >
                {aiLoading ? 'Classifying…' : 'Run AI Triage'}
              </button>
              <button
                onClick={applyTriage}
                className="px-3 py-1 rounded-lg border"
                disabled={!aiSug}
              >
                Apply
              </button>
            </div>
          </div>
          {aiSug ? (
            <ul className="text-sm grid grid-cols-2 gap-x-6 gap-y-1">
              <li><span className="opacity-70">Status:</span> {aiSug.Status}</li>
              <li><span className="opacity-70">Priority:</span> {aiSug.Priority}</li>
              <li><span className="opacity-70">Energy:</span> {aiSug.EnergyLevel}</li>
              <li><span className="opacity-70">Context:</span> {aiSug.Context}</li>
              <li><span className="opacity-70">Due:</span> {aiSug.DueDate || '—'}</li>
              <li><span className="opacity-70">Project:</span> {aiSug.Project || '—'}</li>
              <li className="col-span-2"><span className="opacity-70">Auto-Schedule:</span> {aiSug.AutoSchedule ? 'Yes' : 'No'}</li>
            </ul>
          ) : (
            <div className="text-sm opacity-70">No suggestions yet. Click “Run AI Triage”.</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          <button className="px-3 py-2 rounded-lg border" onClick={closeModal}>Cancel</button>
          <button
            className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50"
            onClick={save}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Task'}
          </button>
        </div>
      </div>
    </div>
  )
}