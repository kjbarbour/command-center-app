const mockTasks = [
  {
    id: 1,
    taskName: "Follow up with Stem client",
    status: "Today",
    priority: "P1-Critical",
    energyLevel: "High",
    timeEstimate: 30,
    context: "Deep Work",
    project: "Stem Sales"
  },
  {
    id: 2,
    taskName: "Schedule Q4 Planning Meeting",
    status: "Inbox",
    priority: "P2-High",
    energyLevel: "Medium",
    timeEstimate: 15,
    context: "Meetings",
    project: "Business Development"
  },
  {
    id: 3,
    taskName: "Update CRM Opportunities",
    status: "This Week",
    priority: "P3-Medium",
    energyLevel: "Low",
    timeEstimate: 45,
    context: "Admin",
    project: "CRM Dashboard"
  }
];

const statusGroups = ["Inbox", "Today", "This Week", "Scheduled"];

const priorityColors = {
  "P1-Critical": "border-red-500",
  "P2-High": "border-orange-500",
  "P3-Medium": "border-yellow-400",
  "P4-Low": "border-gray-300"
};

export default function Dashboard() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statusGroups.map((status) => (
        <div key={status} className="bg-white rounded-2xl shadow p-4">
          <h2 className="text-xl font-bold mb-4 text-gray-800">{status}</h2>
          {mockTasks
            .filter((task) => task.status === status)
            .map((task) => (
              <div
                key={task.id}
                className={`mb-4 border-l-4 pl-4 pr-3 py-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-all duration-200 ${priorityColors[task.priority]}`}
              >
                <div className="font-semibold text-gray-900">
                  {task.taskName}
                </div>
                <div className="text-sm text-gray-500 flex justify-between mt-1">
                  <span>{task.context}</span>
                  <span>{task.timeEstimate} min</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">{task.project}</div>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}