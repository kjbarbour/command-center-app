// integrations/common/airtable.js
import fetch from "node-fetch";

const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_TASKS_TABLE = "Tasks" } = process.env;

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error("Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID");
}

const API = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TASKS_TABLE)}`;

export async function createTask({
  name,
  status = "Inbox",
  priority = "P3-Medium",
  energy = "Medium",
  timeEstimate = 30,
  dueDate = null,
  source = "Slack",
  context = "Quick Wins",
  notes = "",
  project = "CRM Dashboard",
  phase = "",
  autoSchedule = true,
}) {
  const fields = {
    "Task Name": name,
    "Status": status,
    "Priority": priority,
    "Energy Level": energy,
    "Time Estimate": Number(timeEstimate) || 30,
    ...(dueDate ? { "Due Date": dueDate } : {}),
    "Source": source,
    "Context": context,
    "Notes": notes,
    "Project": project,
    ...(phase ? { "Phase": phase } : {}),
    "Auto-Schedule": !!autoSchedule,
  };

  const res = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ records: [{ fields }] }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable create failed: ${res.status} ${text}`);
  }
  const json = await res.json();
  return json.records?.[0];
}