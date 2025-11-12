// src/App.jsx
import { useEffect, useState, useMemo, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import Section from './components/Section'
import AddTaskModal from './components/AddTaskModal'
import BrainDump from './components/BrainDump'
import TaskDetailsModal from './components/TaskDetailsModal'
import MetricBar from './components/MetricBar'
import DailySummary from './components/DailySummary'
import SchedulePanel from './components/SchedulePanel'
import { fetchTasks, createTasksBatch, updateTask } from './api/airtable'
import { computeCompletionStats } from './utils/completionStats'

export default function App() {
  const [sidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const [today, setToday] = useState([])
  const [week, setWeek] = useState([])
  const [scheduled, setScheduled] = useState([])
  const [inbox, setInbox] = useState([])
  const [done, setDone] = useState([])

  const [showDone, setShowDone] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [prefillStatus, setPrefillStatus] = useState('Inbox')

  const [selectedTask, setSelectedTask] = useState(null)
  const [collapseWeek, setCollapseWeek] = useState(true)
  const [collapseInbox, setCollapseInbox] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const records = await fetchTasks()
      bucket(records)
    } catch (e) {
      console.warn('Airtable fetch failed, using sample data:', e)
      setErr(`Airtable error: ${e.message || e}`)
      bucket(sampleAll)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ---- Date helpers
  function toDateOnly(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }
  function toDateOnlySafe(d) {
    try {
      if (!d) return null
      if (d instanceof Date) return toDateOnly(d)
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d))
      if (m) return new Date(+m[1], +m[2] - 1, +m[3])
      const p = new Date(d)
      return toDateOnly(p)
    } catch { return null }
  }
  function isSameDay(a, b) {
    if (!a || !b) return false
    return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate()
  }

  // ---- Bucket with “scheduled for today” logic
  function bucket(records) {
    const t = [], w = [], i = [], d = [], s = []
    const todayMid = toDateOnly(new Date())

    records.forEach(r => {
      const status = (r.status || r.fields?.Status || 'Inbox')
      const lower = String(status).toLowerCase()
      const schedStart = r.fields?.['Scheduled Start'] || r['Scheduled Start'] || r.scheduledStart
      const schedStartDay = toDateOnlySafe(schedStart)

      // If scheduled for today, also show in Today (without changing Status)
      const scheduledForToday = lower === 'scheduled' && isSameDay(schedStartDay, todayMid)

      if (scheduledForToday) {
        t.push(r)
      } else if (lower === 'today') {
        t.push(r)
      } else if (lower === 'this week') {
        w.push(r)
      } else if (lower === 'scheduled') {
        s.push(r)
      } else if (lower === 'done') {
        d.push(r)
      } else {
        i.push(r)
      }
    })

    setToday(t)
    setWeek(w)
    setScheduled(s)
    setInbox(i)
    setDone(d)
  }

  // Derive compact strip counts (Overdue, Due Soon, P1 today)
  const { overdueCount, dueSoonCount, p1Today } = useMemo(() => {
    const allActive = [...today, ...week, ...inbox] // do not double count Scheduled here; 'today' already includes scheduled-for-today
    let overdue = 0, soon = 0, p1 = 0
    const nowMid = toDateOnly(new Date())
    for (const t of allActive) {
      const due = toDateOnlySafe(t.due || t.fields?.['Due Date'])
      if (due) {
        const diff = (due - nowMid) / 86400000
        if (diff < 0) overdue++
        else if (diff <= 3) soon++
      }
    }
    p1 = today.filter(t => String(t.priority || t.fields?.['Priority'] || '').startsWith('P1')).length
    return { overdueCount: overdue, dueSoonCount: soon, p1Today: p1 }
  }, [today, week, inbox])

  // 7-day completion rate + streak
  const { rate7d, streakDays } = useMemo(() => {
    const allTasks = [...today, ...week, ...scheduled, ...inbox, ...done]
    return computeCompletionStats(allTasks)
  }, [today, week, scheduled, inbox, done])

  const metrics = useMemo(() => ([
    { label: 'Today', value: today.length },
    { label: 'P1 Today', value: p1Today },
    { label: 'Due Soon', value: dueSoonCount },
    { label: 'Overdue', value: overdueCount },
    { label: '7d Complete', value: `${rate7d}%` },
    { label: 'Streak', value: `${streakDays}d` },
  ]), [today.length, p1Today, dueSoonCount, overdueCount, rate7d, streakDays])

  // BrainDump create-many
  async function handleCreateMany(list) {
    const created = await createTasksBatch(list)
    bucket([...created, ...today, ...week, ...scheduled, ...inbox, ...done])
    load()
  }

  function handleSectionAdd(title) {
    setPrefillStatus(title)
    setAddOpen(true)
  }

  const handleOpenTask = (task) => setSelectedTask(task)
  const handleCloseTask = () => setSelectedTask(null)
  const handleTaskUpdatedInModal = (id, updates) => {
    const mergedAll = mergeUpdateDeep([...today, ...week, ...scheduled, ...inbox, ...done], id, updates)
    bucket(mergedAll)
  }

  // ✓ Done
  async function handleComplete(task) {
    try {
      const id = task.id
      const todayStr = new Date().toISOString().slice(0, 10)
      await updateTask(id, { 'Status': 'Done', 'Completed Time': todayStr })
      const mergedAll = mergeUpdateDeep(
        [...today, ...week, ...scheduled, ...inbox, ...done],
        id,
        { status: 'Done' }
      )
      bucket(mergedAll)
    } catch (e) { setErr(String(e?.message || e)) }
  }

  // ▶ Move to Today (manual override if you want)
  async function handleMoveToToday(task) {
    try {
      const id = task.id
      await updateTask(id, { 'Status': 'Today', 'Scheduled Start': null, 'Scheduled End': null })
      const mergedAll = mergeUpdateDeep(
        [...today, ...week, ...scheduled, ...inbox, ...done],
        id,
        { status: 'Today' }
      )
      bucket(mergedAll)
    } catch (e) { setErr(String(e?.message || e)) }
  }

  function mergeUpdateDeep(list, id, updates) {
    return list.map((t) => {
      if (t.id !== id) return t
      const next = { ...t, ...updates }
      if (t.fields) {
        const f = { ...t.fields }
        if ('name' in updates)      f['Task Name'] = updates.name
        if ('notes' in updates)     f['Notes'] = updates.notes
        if ('status' in updates)    f['Status'] = updates.status
        if ('priority' in updates)  f['Priority'] = updates.priority
        if ('context' in updates)   f['Context'] = updates.context
        if ('due' in updates)       f['Due Date'] = updates.due
        if ('Scheduled Start' in updates) f['Scheduled Start'] = updates['Scheduled Start']
        if ('Scheduled End' in updates)   f['Scheduled End'] = updates['Scheduled End']
        next.fields = f
      }
      return next
    })
  }

  function handleCreated() { load(); setAddOpen(false) }

  const sections = useMemo(() => ([
    { id: 'today', label: 'Today', caption: `${today.length} tasks` },
    { id: 'week', label: 'This Week', caption: `${week.length} tasks` },
    { id: 'scheduled', label: 'Scheduled', caption: `${scheduled.length} tasks` },
    { id: 'inbox', label: 'Inbox', caption: `${inbox.length} tasks` },
    { id: 'done', label: 'Done', caption: `${done.length} tasks` },
  ]), [today.length, week.length, scheduled.length, inbox.length, done.length])

  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <TopBar />
      <MetricBar metrics={metrics} />

      <div className="container-narrow py-5 flex items-start gap-6">
        <Sidebar
          open={sidebarOpen}
          sections={sections}
          onSelect={(id) => {
            const el = document.getElementById(id)
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        />

        <main className="flex-1 space-y-8">
          {err && (
            <div className="card p-3 text-[color:var(--stem-orange)] bg-[color:var(--stem-orange)]/8 border border-[color:var(--stem-orange)]/30">
              {err}
            </div>
          )}

          {/* Brain Dump */}
          <div className="card p-4">
            <div className="heading-sm mb-2">Brain Dump</div>
            <BrainDump onCreateMany={handleCreateMany} />
          </div>

          {/* Smart Scheduler */}
          <SchedulePanel onRefresh={load} />

          {/* Focus-first sections */}
          <div id="today">
            <Section
              title="Today"
              items={today}
              loading={loading}
              dense
              maxItems={12}
              onTaskClick={handleOpenTask}
              onAdd={handleSectionAdd}
              onComplete={handleComplete}
            />
          </div>

          <div id="week">
            <Section
              title="This Week"
              items={week}
              loading={loading}
              collapsed={collapseWeek}
              onToggleCollapse={() => setCollapseWeek(v => !v)}
              dense
              maxItems={12}
              onTaskClick={handleOpenTask}
              onAdd={handleSectionAdd}
              onComplete={handleComplete}
            />
          </div>

          {/* Scheduled column (still visible for non-today items) */}
          <div id="scheduled">
            <Section
              title="Scheduled"
              items={scheduled}
              loading={loading}
              dense
              maxItems={20}
              onTaskClick={handleOpenTask}
              onComplete={handleComplete}
              onMoveToToday={handleMoveToToday}
            />
          </div>

          <div id="inbox">
            <Section
              title="Inbox"
              items={inbox}
              loading={loading}
              collapsed={collapseInbox}
              onToggleCollapse={() => setCollapseInbox(v => !v)}
              dense
              maxItems={12}
              onTaskClick={handleOpenTask}
              onAdd={handleSectionAdd}
              onComplete={handleComplete}
            />
          </div>

          {showDone && (
            <div id="done">
              <Section
                title="Done"
                items={done}
                loading={loading}
                dense
                maxItems={20}
                onTaskClick={handleOpenTask}
                onComplete={handleComplete}
              />
            </div>
          )}

          <div className="flex items-center justify-end">
            <label className="text-sm text-[color:var(--stem-navy)] flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-stem-blue text-stem-blue focus:ring-[color:var(--stem-blue)]"
                checked={showDone}
                onChange={(e) => setShowDone(e.target.checked)}
              />
              Show Done
            </label>
          </div>

          <DailySummary tasks={[...today, ...week, ...scheduled, ...inbox, ...done]} className="mt-4" />
        </main>
      </div>

      {addOpen && <AddTaskModal onClose={() => setAddOpen(false)} onCreated={handleCreated} />}

      {selectedTask && (
        <TaskDetailsModal task={selectedTask} onClose={handleCloseTask} onUpdated={handleTaskUpdatedInModal} />
      )}
    </div>
  )
}

const sampleAll = [
  { id: 't1', name: 'Prep Q4 pipeline review', status: 'Today', priority: 'P1-Critical', time: 60, context: 'Deep Work', due: '2025-11-07' },
  { id: 't2', name: 'Email follow-ups (3)', status: 'Today', priority: 'P2-High', time: 20, context: 'Admin', due: '2025-11-09' },
  { id: 'w1', name: 'Prospect list cleanup', status: 'This Week', priority: 'P3-Medium', time: 45, context: 'Admin', due: '2025-11-12' },
  { id: 'i1', name: 'Slack: pricing question — TerraVolt', status: 'Inbox', priority: 'P3-Medium', time: 5, context: 'Quick Wins', due: '2025-11-05' },
]