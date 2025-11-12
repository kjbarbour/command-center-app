// src/components/BrainDump.jsx
import { useState } from 'react'
import { parseBrainDump } from '../api/enrich'

/**
 * Props:
 * - onCreateMany(recordsArray): Promise<void>
 */
export default function BrainDump({ onCreateMany }) {
  const [text, setText] = useState('')
  const [preview, setPreview] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')

  async function analyze() {
    setErr(''); setOk(''); setLoading(true)
    try {
      const { tasks } = await parseBrainDump(text)
      setPreview(tasks || [])
      if (!tasks?.length) setOk('No tasks detected. Try shorter, action-oriented lines.')
    } catch (e) {
      setErr(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  async function createAll() {
    if (!preview.length) return
    setErr(''); setOk(''); setLoading(true)
    try {
      await onCreateMany(preview)
      setOk(`Created ${preview.length} task(s)`)
      setText('')
      setPreview([])
    } catch (e) {
      setErr(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  function updateCell(idx, key, value) {
    setPreview(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [key]: value }
      return next
    })
  }

  return (
    <div className="space-y-3">
      {(err || ok) ? (
        <div className={`text-sm ${err ? 'text-red-600' : 'text-green-700'}`}>
          {err || ok}
        </div>
      ) : null}

      <textarea
        className="w-full rounded-xl border px-3 py-2 min-h-[110px]"
        placeholder="Dump thoughts here. Example: 
- Email Harvest about pricing; 
- Prep NPM slide deck and outline; 
- Schedule sync with Sydney Friday"
        value={text}
        onChange={e=>setText(e.target.value)}
      />

      <div className="flex items-center gap-2">
        <button className="px-3 py-1 rounded-lg border" onClick={analyze} disabled={loading}>
          {loading ? 'Analyzing…' : 'Detect Tasks'}
        </button>
        <button
          className="px-3 py-1 rounded-lg border disabled:opacity-50"
          onClick={createAll}
          disabled={!preview.length || loading}
        >
          {loading ? 'Creating…' : `Create ${preview.length || ''} tasks`}
        </button>
      </div>

      {/* Preview / inline edit */}
      {preview.length > 0 && (
        <div className="rounded-xl border p-3 overflow-x-auto">
          <div className="text-sm font-medium mb-2">Preview & Edit</div>
          <table className="w-full text-sm">
            <thead className="text-left opacity-70">
              <tr>
                <th className="py-1 pr-2">Task Name</th>
                <th className="py-1 pr-2">Status</th>
                <th className="py-1 pr-2">Priority</th>
                <th className="py-1 pr-2">Energy</th>
                <th className="py-1 pr-2">Context</th>
                <th className="py-1 pr-2">Project</th>
                <th className="py-1 pr-2">Due Date</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i} className="align-top">
                  <td className="py-1 pr-2">
                    <input
                      className="w-full rounded border px-2 py-1"
                      value={row['Task Name'] || ''}
                      onChange={e=>updateCell(i, 'Task Name', e.target.value)}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <select
                      className="rounded border px-2 py-1"
                      value={row['Status'] || 'Inbox'}
                      onChange={e=>updateCell(i, 'Status', e.target.value)}
                    >
                      <option>Inbox</option><option>Today</option><option>This Week</option><option>Scheduled</option>
                    </select>
                  </td>
                  <td className="py-1 pr-2">
                    <select
                      className="rounded border px-2 py-1"
                      value={row['Priority'] || 'P3-Medium'}
                      onChange={e=>updateCell(i, 'Priority', e.target.value)}
                    >
                      <option>P1-Critical</option><option>P2-High</option><option>P3-Medium</option><option>P4-Low</option>
                    </select>
                  </td>
                  <td className="py-1 pr-2">
                    <select
                      className="rounded border px-2 py-1"
                      value={row['Energy Level'] || 'Medium'}
                      onChange={e=>updateCell(i, 'Energy Level', e.target.value)}
                    >
                      <option>High</option><option>Medium</option><option>Low</option>
                    </select>
                  </td>
                  <td className="py-1 pr-2">
                    <select
                      className="rounded border px-2 py-1"
                      value={row['Context'] || 'Admin'}
                      onChange={e=>updateCell(i, 'Context', e.target.value)}
                    >
                      <option>Deep Work</option><option>Meetings</option><option>Admin</option><option>Quick Wins</option>
                    </select>
                  </td>
                  <td className="py-1 pr-2">
                    <select
                      className="rounded border px-2 py-1"
                      value={row['Project'] || ''}
                      onChange={e=>updateCell(i, 'Project', e.target.value)}
                    >
                      <option value="">—</option>
                      <option>CRM Dashboard</option>
                      <option>Stem Sales</option>
                      <option>Command Center</option>
                      <option>Business Development</option>
                      <option>Personal</option>
                      <option>Home Improvement</option>
                      <option>Learning</option>
                      <option>Health</option>
                    </select>
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      type="date"
                      className="rounded border px-2 py-1"
                      value={row['Due Date'] || ''}
                      onChange={e=>updateCell(i, 'Due Date', e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Auto-Schedule toggle per-row */}
          <div className="mt-2 text-xs opacity-70">
            All detected tasks default to <b>Auto-Schedule</b>. You can edit any field above before creating.
          </div>
        </div>
      )}
    </div>
  )
}