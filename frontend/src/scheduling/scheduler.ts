// Lightweight, deterministic scheduler for "Today"
// - Prioritizes P1, near due dates, and tasks with Auto-Schedule checked
// - Morning = high-energy, afternoon = medium, late = low/admin
// - Sprinkles quick wins (< 5 min) between longer blocks
// - Writes back Scheduled Start/End via provided saveFn

export type Task = {
    id: string;
    name: string;
    status: "Inbox" | "Today" | "This Week" | "Scheduled" | "Done" | "Someday";
    priority?: "P1-Critical" | "P2-High" | "P3-Medium" | "P4-Low";
    energy?: "High" | "Medium" | "Low";
    timeEstimate?: number; // minutes
    dueDate?: string | null; // ISO date or null
    autoSchedule?: boolean;
    context?: "Deep Work" | "Meetings" | "Admin" | "Quick Wins";
    scheduledStart?: string | null;
    scheduledEnd?: string | null;
  };
  
  export type ScheduleBlock = {
    taskId: string;
    title: string;
    start: Date;
    end: Date;
  };
  
  export type DayConfig = {
    workStart: string; // "09:00"
    workEnd: string;   // "17:30"
    tz: string;        // e.g. "America/Chicago"
    defaultBlockMin: number; // fallback if missing timeEstimate
    bufferMin: number;       // gap between tasks
    quickWinMaxMin: number;  // sprinkle threshold
  };
  
  const parseHM = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return { h, m };
  };
  
  const clampToDay = (d: Date, startHM: string, endHM: string) => {
    const s = new Date(d);
    const e = new Date(d);
    const { h: sh, m: sm } = parseHM(startHM);
    const { h: eh, m: em } = parseHM(endHM);
    s.setHours(sh, sm, 0, 0);
    e.setHours(eh, em, 0, 0);
    return { start: s, end: e };
  };
  
  const minutes = (ms: number) => Math.floor(ms / 60000);
  
  const scoreTask = (t: Task, todayISO: string) => {
    // Higher is better
    let s = 0;
  
    // Priority weight
    if (t.priority === "P1-Critical") s += 100;
    else if (t.priority === "P2-High") s += 70;
    else if (t.priority === "P3-Medium") s += 40;
    else s += 10;
  
    // Due date urgency
    if (t.dueDate) {
      const due = new Date(t.dueDate);
      const today = new Date(todayISO);
      const days = Math.floor((due.getTime() - today.getTime()) / (24 * 3600 * 1000));
      if (days <= 0) s += 60;        // due or overdue
      else if (days <= 1) s += 45;
      else if (days <= 3) s += 25;
    }
  
    // Auto-schedule gets a boost
    if (t.autoSchedule) s += 20;
  
    // Quick wins are nice to place if time allows
    if ((t.timeEstimate ?? 0) > 0 && (t.timeEstimate ?? 0) <= 5) s += 10;
  
    return s;
  };
  
  const fitsEnergy = (energy: Task["energy"], hour: number) => {
    // Morning (8–11): prefer High; Midday (11–3): Medium/High; Late (3–5:30): Low/Admin
    if (hour < 11) return energy !== "Low";
    if (hour < 15) return energy !== "Low"; // flexible
    return energy !== "High"; // late day: avoid high-cog load if possible
  };
  
  export function buildScheduleForToday(
    rawTasks: Task[],
    now = new Date(),
    cfg: DayConfig = {
      workStart: "09:00",
      workEnd: "17:30",
      tz: "America/Chicago",
      defaultBlockMin: 30,
      bufferMin: 10,
      quickWinMaxMin: 5,
    }
  ): ScheduleBlock[] {
    // Filter candidates: Today or This Week + Auto-Schedule, not Done
    const candidates = rawTasks.filter(
      (t) =>
        t.status !== "Done" &&
        (t.status === "Today" || t.status === "This Week" || t.autoSchedule)
    );
  
    // Rank
    const todayISO = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).toISOString();
  
    const ranked = [...candidates].sort(
      (a, b) => scoreTask(b, todayISO) - scoreTask(a, todayISO)
    );
  
    // Time window
    const { start: dayStart, end: dayEnd } = clampToDay(now, cfg.workStart, cfg.workEnd);
    const blocks: ScheduleBlock[] = [];
  
    let cursor = new Date(Math.max(now.getTime(), dayStart.getTime())); // start now if day already started
  
    // Helper: advance cursor with buffer
    const advance = (mins: number) => new Date(cursor.getTime() + mins * 60000);
    const addBuffer = () => (cursor = advance(cfg.bufferMin));
  
    // Reserve quick wins to sprinkle
    const quickWins = ranked.filter(
      (t) => (t.timeEstimate ?? 0) > 0 && (t.timeEstimate ?? 0) <= cfg.quickWinMaxMin
    );
    const mains = ranked.filter(
      (t) => !(quickWins.includes(t))
    );
  
    // Place main tasks
    for (const t of mains) {
      // Skip if already scheduled
      if (t.scheduledStart && t.scheduledEnd) continue;
  
      // Respect day end
      if (cursor >= dayEnd) break;
  
      // Energy gate (soft): try to place at a time that matches
      let blockMin = t.timeEstimate && t.timeEstimate > 0 ? t.timeEstimate : cfg.defaultBlockMin;
  
      // If estimate is huge, chunk into 90-min max focus blocks
      const chunkMax = 90;
      if (blockMin > chunkMax) blockMin = chunkMax;
  
      // Find a time window that matches energy preference (try up to 3 bumps)
      let tries = 0;
      let placed = false;
      while (tries < 3 && !placed) {
        const end = advance(blockMin);
        if (end <= dayEnd && fitsEnergy(t.energy, cursor.getHours())) {
          blocks.push({
            taskId: t.id,
            title: t.name,
            start: new Date(cursor),
            end,
          });
          cursor = end;
          addBuffer();
          placed = true;
  
          // After a longer focus block, try to insert one quick win if any remain
          if (blockMin >= 45 && quickWins.length) {
            const q = quickWins.shift()!;
            const qLen = q.timeEstimate ?? Math.min(cfg.quickWinMaxMin, 5);
            const qEnd = advance(qLen);
            if (qEnd <= dayEnd) {
              blocks.push({
                taskId: q.id,
                title: q.name + " (Quick Win)",
                start: new Date(cursor),
                end: qEnd,
              });
              cursor = qEnd;
              addBuffer();
            }
          }
        } else {
          // bump cursor forward a bit (15 min) to search for a better slot
          cursor = advance(15);
        }
        tries++;
      }
    }
  
    // Place any remaining quick wins in leftover space
    while (quickWins.length && cursor < dayEnd) {
      const q = quickWins.shift()!;
      const qLen = q.timeEstimate ?? Math.min(cfg.quickWinMaxMin, 5);
      const qEnd = advance(qLen);
      if (qEnd > dayEnd) break;
      blocks.push({
        taskId: q.id,
        title: q.name + " (Quick Win)",
        start: new Date(cursor),
        end: qEnd,
      });
      cursor = qEnd;
      addBuffer();
    }
  
    return blocks;
  }
  
  // Utility to persist blocks back to Airtable (you pass the saveFn)
  export async function persistBlocks(
    blocks: ScheduleBlock[],
    saveFn: (taskId: string, fields: { [k: string]: any }) => Promise<void>
  ) {
    for (const b of blocks) {
      await saveFn(b.taskId, {
        "Scheduled Start": b.start.toISOString(),
        "Scheduled End": b.end.toISOString(),
        Status: "Scheduled",
      });
    }
  }