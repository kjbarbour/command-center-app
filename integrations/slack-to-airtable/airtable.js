import fetch from "node-fetch";

const {
  AIRTABLE_API_KEY,
  AIRTABLE_BASE_ID,
  AIRTABLE_TASKS_TABLE = "Tasks",
} = process.env;

const API = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TASKS_TABLE)}`;

export async function createTask(fields) {
  const payload = { records: [{ fields }] };

  const res = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable create failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  return json.records?.[0];
}