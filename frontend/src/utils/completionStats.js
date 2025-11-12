// frontend/src/utils/completionStats.js
function coerceDate(v) {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  
  function isCompleted(task) {
    // Flexible: supports either explicit completed flag or Status field
    const status = task?.status || task?.Status;
    const doneFlag = task?.completed ?? task?.isComplete ?? task?.IsComplete;
    return doneFlag === true || String(status || '').toLowerCase() === 'done';
  }
  
  function completionDate(task) {
    // Prefer Airtable field label if it exists
    return (
      coerceDate(task?.completedTime) ||
      coerceDate(task?.CompletedTime) ||
      coerceDate(task?.['Completed Time']) ||
      coerceDate(task?.updatedAt) || // fallback if you update on complete
      null
    );
  }
  
  export function computeCompletionStats(allTasks = [], today = new Date()) {
    const now = new Date(today);
    // Normalize to local midnight boundaries
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start7d = new Date(midnight);
    start7d.setDate(midnight.getDate() - 6); // include today → 7 days window
  
    // Collect completions in last 7 days and total completed count in that window
    let completedLast7 = 0;
    let totalCompletedCandidates = 0;
  
    // For rate, we’ll estimate “opportunities to complete” as number of tasks that were either
    // due or touched in the last 7 days. If you prefer a different denominator, swap below.
    let denom = 0;
  
    // Track per-day completion for streak (count of completed on each day)
    const byDay = new Map(); // key: YYYY-MM-DD, val: number of completions
  
    const toKey = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
  
    for (const t of allTasks) {
      const d = completionDate(t);
      const completed = isCompleted(t);
  
      // Count opportunities in window (very simple heuristic)
      const due =
        coerceDate(t?.dueDate) ||
        coerceDate(t?.DueDate) ||
        coerceDate(t?.['Due Date']);
  
      const touched =
        coerceDate(t?.updatedAt) ||
        coerceDate(t?.lastModified) ||
        coerceDate(t?.LastModifiedTime) ||
        null;
  
      const inWindow = (dt) => dt && dt >= start7d && dt <= midnight;
  
      // Denominator: tasks due OR touched in last 7 days
      if (inWindow(due) || inWindow(touched) || inWindow(d)) {
        denom++;
      }
  
      if (completed && d && inWindow(d)) {
        completedLast7++;
        const k = toKey(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
        byDay.set(k, (byDay.get(k) || 0) + 1);
      }
  
      // Also count all completions (used elsewhere if needed)
      if (completed && d) totalCompletedCandidates++;
    }
  
    const rate7d = denom > 0 ? Math.round((completedLast7 / denom) * 1000) / 10 : 0; // one decimal
  
    // Streak: count consecutive days up to today with >=1 completion
    let streakDays = 0;
    for (let i = 0; i < 365; i++) { // cap at 1 year for safety
      const d = new Date(midnight);
      d.setDate(midnight.getDate() - i);
      const k = toKey(d);
      const had = (byDay.get(k) || 0) > 0;
  
      if (i === 0) {
        // today: if no completion today, streak is 0
        if (!had) break;
        streakDays = 1;
      } else {
        if (!had) break;
        streakDays++;
      }
    }
  
    return { rate7d, streakDays };
  }