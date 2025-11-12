// src/components/TaskDetailsModal.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { updateTask, createSubtasks } from '../api/airtable'
import { suggestForTask } from '../api/aiSuggest'
import SubtasksBlock from './SubtasksBlock'

// Debounce helper
function useDebouncedEffect(fn, deps, delay = 800) {
  const t = useRef()
  useEffect(() => {
    clearTimeout(t.current)
    t.current = setTimeout(fn, delay)
    return () => clearTimeout(t.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

export default function TaskDetailsModal({ task, onClose, onUpdated }) {
  const fields = task?.fields || {}
  const [name, setName] = useState(fields['Task Name'] || task?.name || '')
  const [notes, setNotes] = useState(fields['Notes'] || task?.notes || '')
  const [status, setStatus] = useState(fields['Status'] || task?.status || 'Inbox')
  const [priority, setPriority] = useState(fields['Priority'] || task?.priority || 'P3-Medium')
  const [context, setContext] = useState(fields['Context'] || task?.context || 'Admin')
  const [due, setDue] = useState(fields['Due Date'] || task?.due || '')

  // Save status
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState('')

  // AI panel
  const [aiLoading, setAiLoading] = useState(true)
  const [aiErr, setAiErr] = useState('')
  const [ai, setAi] = useState({ summary: '', steps: [], subtasks: [] })
  const [selectedSubs, setSelectedSubs] = useState([])
  const [subMsg, setSubMsg] = useState('')

  const displayTask = useMemo(
    () => ({
      id: task.id,
      name,
      notes,
      status,
      priority,
      context,
      due,
      project: fields['Project'] || '',
      subtasks: fields['Subtasks'] || [],
    }),
    [task.id, name, notes, status, priority, context, due, fields]
  )

  // Fetch AI suggestions when modal opens and when name/notes change
  useEffect(() => {
    let mounted = true
    async function run() {
      setAiLoading(true)
      setAiErr('')
      try {
        const res = await suggestForTask(displayTask)
        if (mounted) setAi(res)
      } catch (e) {
        if (mounted) setAiErr(String(e?.message || e))
      } finally {
        if (mounted) setAiLoading(false)
      }
    }
    run()
    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id])

  useDebouncedEffect(async () => {
    // Re-fetch suggestions when inputs change (debounced)
    try {
      setAiLoading(true); setAiErr('')
      const res = await suggestForTask(displayTask)
      setAi(res)
    } catch (e) {
      setAiErr(String(e?.message || e))
    } finally {
      setAiLoading(false)
    }
  }, [name, notes])

  async function handleSave() {
    setSaving(true); setSaveErr(''); setSubMsg('')
    try {
      const payload = {
        'Task Name': name,
        'Notes': notes,
        'Status': status,
        'Priority': priority,
        'Context': context,
      }
      if (due) payload['Due Date'] = due
      const updated = await updateTask(task.id, payload)

      // Notify parent to refresh lists
      onUpdated?.(task.id, {
        name,
        notes,
        status,
        priority,
        context,
        due,
        fields: updated.fields,
      })
      onClose?.()
    } catch (e) {
      setSaveErr(String(e?.message || e))
    } finally {
      setSaving(false)
    }
  }

  async function addSuggestedSubtasks() {
    if (!selectedSubs.length) return
    setSubMsg('Adding subtasks…')
    try {
      const { children } = await createSubtasks(task.id, selectedSubs)
      setSubMsg(`Added ${children.length} subtasks`)
      // ask parent to refetch so subtasks block updates
      onUpdated?.(task.id, {})
      setSelectedSubs([])
    } catch (e) {
      setSubMsg(String(e?.message || e))
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-4xl rounded-2xl bg-white dark:bg-neutral-900 shadow-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Task Details</h2>
          <div className="flex items-center gap-2">
            <button className="px-3 py-2 rounded-lg border" onClick={onClose}>Close</button>
            <button
              className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {saveErr ? <div className="text-red-600 text-sm mb-3">{saveErr}</div> : null}

        {/* Layout: details | AI panel */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left: main fields */}
          <div>
            <label className="block space-y-1 mb-3">
              <span className="text-sm opacity-80">Task Name</span>
              <input
                className="w-full rounded-lg border px-3 py-2"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Task title…"
              />
            </label>

            <label className="block space-y-1 mb-3">
              <span className="text-sm opacity-80">Notes</span>
              <textarea
                className="w-full rounded-lg border px-3 py-2 min-h-[120px]"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Context, links, acceptance criteria…"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
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
            </div>

            {/* Progressive Subtasks Block */}
            <div className="mt-5">
              <div className="text-sm font-medium mb-1">Subtasks</div>
              <SubtasksBlock
                parent={task}
                compact={false}
                onChanged={onUpdated ? () => onUpdated(task.id, {}) : undefined}
              />
            </div>
          </div>

          {/* Right: AI Panel */}
          <div className="rounded-xl border p-3 bg-white/60 dark:bg-neutral-900/60">
            <div className="font-medium mb-2">AI Suggestions</div>

            {aiLoading ? (
              <div className="space-y-2">
                <div className="h-3 bg-black/10 dark:bg-white/10 rounded w-4/5" />
                <div className="h-3 bg-black/10 dark:bg-white/10 rounded w-3/5" />
                <div className="h-3 bg-black/10 dark:bg-white/10 rounded w-2/5" />
              </div>
            ) : aiErr ? (
              <div className="text-sm text-red-600">{aiErr}</div>
            ) : (
              <>
                {/* Summary */}
                <div className="mb-3">
                  <div className="text-sm font-medium mb-1">Summary</div>
                  <p className="text-sm opacity-80">{ai.summary || '—'}</p>
                </div>

                {/* Steps */}
                <div className="mb-3">
                  <div className="text-sm font-medium mb-1">Next Steps</div>
                  {ai.steps?.length ? (
                    <ul className="list-disc ml-5 text-sm">
                      {ai.steps.slice(0, 3).map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  ) : (
                    <div className="text-sm opacity-70">No steps suggested.</div>
                  )}
                </div>

                {/* Subtask suggestions */}
                <div className="mb-2">
                  <div className="text-sm font-medium mb-1">Subtask Suggestions</div>
                  {ai.subtasks?.length ? (
                    <ul className="space-y-1">
                      {ai.subtasks.map((s, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedSubs.includes(s)}
                            onChange={(e) => {
                              setSelectedSubs((prev) =>
                                e.target.checked ? [...prev, s] : prev.filter(x => x !== s)
                              )
                            }}
                          />
                          <span className="text-sm">{s}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm opacity-70">No subtasks suggested.</div>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      className="px-3 py-1 rounded-lg border text-sm disabled:opacity-50"
                      disabled={!selectedSubs.length}
                      onClick={addSuggestedSubtasks}
                    >
                      Add as Subtasks
                    </button>
                    {subMsg ? <span className="text-xs opacity-70">{subMsg}</span> : null}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}