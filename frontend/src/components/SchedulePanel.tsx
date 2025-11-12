import { useMemo, useState } from "react";
import { buildScheduleForToday, persistBlocks, type Task } from "../scheduling/scheduler";

// Expect these to be passed in from your existing data hooks
type Props = {
  tasks: Task[];
  onSaveTaskFields: (taskId: string, fields: { [k: string]: any }) => Promise<void>;
  refreshTasks: () => Promise<void>;
};

export default function SchedulePanel({ tasks, onSaveTaskFields, refreshTasks }: Props) {
  const [isRunning, setIsRunning] = useState(false);
  const [preview, setPreview] = useState<ReturnType<typeof buildScheduleForToday>>([]);

  const todayBlocks = useMemo(() => {
    return buildScheduleForToday(tasks);
  }, [tasks]);

  const runAutoSchedule = async () => {
    setIsRunning(true);
    try {
      const blocks = buildScheduleForToday(tasks);
      setPreview(blocks);
      await persistBlocks(blocks, onSaveTaskFields);
      await refreshTasks();
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="w-full rounded-2xl p-4 shadow-sm border bg-white">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Auto-Schedule (Today)</h2>
        <button
          onClick={runAutoSchedule}
          disabled={isRunning}
          className="px-3 py-2 rounded-xl bg-black text-white disabled:opacity-50"
        >
          {isRunning ? "Scheduling…" : "Auto-Schedule Today"}
        </button>
      </div>

      {/* Preview list */}
      <div className="space-y-2">
        {todayBlocks.length === 0 ? (
          <p className="text-sm text-gray-500">No schedulable tasks found for today.</p>
        ) : (
          todayBlocks.map((b) => (
            <div key={`${b.taskId}-${b.start.toISOString()}`} className="border rounded-xl p-3">
              <div className="text-sm font-medium">{b.title}</div>
              <div className="text-xs text-gray-600">
                {b.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                {b.end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Optional: last run preview */}
      {preview.length > 0 && (
        <div className="mt-4">
          <div className="text-xs text-gray-500 mb-1">Last applied:</div>
          <div className="grid gap-2 md:grid-cols-2">
            {preview.map((b) => (
              <div key={`applied-${b.taskId}-${b.start.toISOString()}`} className="border rounded-xl p-3">
                <div className="text-sm font-medium">{b.title}</div>
                <div className="text-xs text-gray-600">
                  {b.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                  {b.end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}