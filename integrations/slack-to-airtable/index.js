import "dotenv/config";
import { App } from "@slack/bolt";
import { createTask } from "./airtable.js";

// ----- Env -----
const {
  SLACK_BOT_TOKEN,
  SLACK_SIGNING_SECRET,
  SLACK_APP_TOKEN,
  SLACK_MY_USER_ID,
  DEFAULT_PROJECT = "CRM Dashboard",
  DEFAULT_STATUS_THIS_WEEK = "This Week",
  DEFAULT_ENERGY = "Medium",
  DEFAULT_CONTEXT = "Quick Wins",
  DEFAULT_TIME_MIN = "30",
} = process.env;

if (!SLACK_BOT_TOKEN || !SLACK_SIGNING_SECRET || !SLACK_APP_TOKEN) {
  console.error("Missing Slack env vars. Check .env.");
  process.exit(1);
}
if (!SLACK_MY_USER_ID) {
  console.error("Missing SLACK_MY_USER_ID (your Slack user ID).");
  process.exit(1);
}

// ----- Helpers -----
const mapPriority = (p) => ({
  "P1": "P1-Critical",
  "P2": "P2-High",
  "P3": "P3-Medium",
  "P4": "P4-Low",
}[String(p || "P3").toUpperCase()] || "P3-Medium");

function parseText(text) {
  const out = {
    priority: "P3-Medium",
    minutes: Number(DEFAULT_TIME_MIN),
    due: null,
    name: (text || "").trim(),
  };

  const p = text.match(/\bP[1-4]\b/i);
  if (p) out.priority = p[0].toUpperCase();

  const m = text.match(/\b(\d{2,3})\s?(min|m)?\b/i);   // "45" or "45m"
  if (m) out.minutes = Number(m[1]);

  // "@ 2025-11-10" or "@ 11/12"
  const d = text.match(/@\s*(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2})/);
  if (d) {
    const raw = d[1];
    if (raw.includes("-")) out.due = raw;
    else {
      const [mm, dd] = raw.split("/");
      const yyyy = new Date().getFullYear();
      out.due = `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }
  }

  // Clean the name of hints
  out.name = text
    .replace(/\bP[1-4]\b/i, "")
    .replace(/\b(\d{2,3})\s?(min|m)?\b/i, "")
    .replace(/@\s*(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2})/, "")
    .replace(/^\s*task:\s*/i, "")
    .trim();

  return out;
}

// Assignment-like language
const ASSIGNMENT_HINTS = [
  /\bplease\b/i,
  /\bcan\s+you\b/i,
  /\bcould\s+you\b/i,
  /\btodo\b/i,
  /\btask\b/i,
  /\bdue\b/i,
  /\bby\s+\d{1,2}\/\d{1,2}\b/i,
  /\bP[1-4]\b/i,
];

// ----- Slack App (Socket Mode) -----
const app = new App({
  token: SLACK_BOT_TOKEN,
  signingSecret: SLACK_SIGNING_SECRET,
  appToken: SLACK_APP_TOKEN,
  socketMode: true,
});

function looksAssigned(text) {
  if (!text) return false;
  return ASSIGNMENT_HINTS.some((rx) => rx.test(text));
}

async function handleMessage(e, client) {
  // Ignore non-text noise
  if (e.subtype && e.subtype !== "file_share") return;
  if (!e.text || !e.text.trim()) return;

  const text = e.text.trim();
  const isDM = e.channel_type === "im";
  const mentionsYou = text.includes(`<@${SLACK_MY_USER_ID}>`);
  const fromYou = e.user === SLACK_MY_USER_ID;

  // Gate logic
  const shouldCreate =
    (isDM && looksAssigned(text)) ||
    (mentionsYou && looksAssigned(text)) ||
    (fromYou && /^\s*task:/i.test(text));

  if (!shouldCreate) return;

  const parsed = parseText(text);
  const fields = {
    "Task Name": parsed.name || "Untitled task",
    "Status": DEFAULT_STATUS_THIS_WEEK,
    "Priority": mapPriority(parsed.priority),
    "Energy Level": DEFAULT_ENERGY,
    "Time Estimate": parsed.minutes,
    ...(parsed.due ? { "Due Date": parsed.due } : {}),
    "Source": "Slack",
    "Context": DEFAULT_CONTEXT,
    "Notes": `From Slack by <@${e.user}> in ${isDM ? "DM" : `#${e.channel}`}\n\n${text}`,
    "Project": DEFAULT_PROJECT,
    "Phase": "",
    "Auto-Schedule": true,
  };

  try {
    await createTask(fields);
    await client.chat.postMessage({
      channel: e.channel,
      thread_ts: e.ts,
      text: `✅ Task created in Airtable: *${fields["Task Name"]}* (${fields["Priority"]}, ${fields["Time Estimate"]}m${parsed.due ? `, due ${parsed.due}` : ""})`,
    });
  } catch (err) {
    console.error("Create task failed:", err);
    await client.chat.postMessage({
      channel: e.channel,
      thread_ts: e.ts,
      text: `❌ Failed to create task: ${err.message}`,
    });
  }
}

// Listen to all app_mention + message events
app.event("app_mention", async ({ event, client }) => handleMessage(event, client));
app.message(async ({ message, client }) => handleMessage(message, client));

// Start
(async () => {
  await app.start();
  console.log("⚡️ Slack → Airtable service running (Socket Mode).");
})();