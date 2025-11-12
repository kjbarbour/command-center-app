// integrations/slack/index.js
import { App } from "@slack/bolt";
import { createTask } from "../common/airtable.js";

const {
  SLACK_BOT_TOKEN,
  SLACK_SIGNING_SECRET,
  SLACK_APP_TOKEN, // for socket mode (no public URL needed)
} = process.env;

const app = new App({
  token: SLACK_BOT_TOKEN,
  signingSecret: SLACK_SIGNING_SECRET,
  appToken: SLACK_APP_TOKEN,
  socketMode: true,
});

function parseCommand(text) {
  // Very forgiving parser: [/task] [P1|P2|P3|P4]? [minutes]? Task name [@ MM/DD or YYYY-MM-DD]?
  // Examples:
  // "P1 60 Verify endpoints @ 2025-11-10"
  // "Add loaders 45 @ 11/13"
  const out = {
    priority: "P3-Medium",
    time: 30,
    name: text,
    due: null,
  };

  const mPriority = text.match(/\bP[1-4]\b/i);
  if (mPriority) out.priority = mPriority[0].toUpperCase();

  const mMinutes = text.match(/\b(\d{2,3})\b/);
  if (mMinutes) out.time = Number(mMinutes[1]);

  const mDue = text.match(/@\s*(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2})/);
  if (mDue) {
    const raw = mDue[1];
    if (raw.includes("-")) out.due = raw;
    else {
      const [mm, dd] = raw.split("/");
      const yyyy = new Date().getFullYear();
      out.due = `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }
  }

  // Remove hints from name
  out.name = text
    .replace(/\bP[1-4]\b/i, "")
    .replace(/\b\d{2,3}\b/, "")
    .replace(/@\s*(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2})/, "")
    .trim();

  return out;
}

// Slash command: /task
app.command("/task", async ({ ack, respond, command }) => {
  await ack();
  try {
    const parsed = parseCommand(command.text || "");
    const rec = await createTask({
      name: parsed.name || "Untitled task",
      priority: mapPriority(parsed.priority),
      timeEstimate: parsed.time,
      dueDate: parsed.due,
      source: "Slack",
      context: "Quick Wins",
      project: "CRM Dashboard",
      autoSchedule: true,
      status: "This Week",
    });
    await respond(`✅ Created task: *${parsed.name}* (${parsed.priority}, ${parsed.time}m${parsed.due ? `, due ${parsed.due}` : ""})`);
  } catch (e) {
    await respond(`❌ Failed to create task: ${e.message}`);
  }
});

// Message action: Create Task
app.shortcut("create_task_from_message", async ({ ack, body, client }) => {
  await ack();
  const msg = body?.message?.text || "(no text)";
  const parsed = parseCommand(msg);
  try {
    const rec = await createTask({
      name: parsed.name || "Untitled task",
      priority: mapPriority(parsed.priority),
      timeEstimate: parsed.time,
      dueDate: parsed.due,
      source: "Slack",
      context: "Quick Wins",
      project: "CRM Dashboard",
      autoSchedule: true,
      status: "This Week",
      notes: `From Slack by @${body.user.username || body.user.id}`,
    });

    await client.chat.postMessage({
      channel: body.channel.id,
      thread_ts: body.message.ts,
      text: `✅ Created task in Airtable: *${parsed.name}* (${parsed.priority}, ${parsed.time}m${parsed.due ? `, due ${parsed.due}` : ""})`,
    });
  } catch (e) {
    await client.chat.postMessage({
      channel: body.channel.id,
      thread_ts: body.message.ts,
      text: `❌ Failed to create task: ${e.message}`,
    });
  }
});

function mapPriority(p) {
  const m = {
    "P1": "P1-Critical",
    "P2": "P2-High",
    "P3": "P3-Medium",
    "P4": "P4-Low",
  };
  return m[p.toUpperCase()] || "P3-Medium";
}

(async () => {
  await app.start();
  console.log("⚡️ Slack app is running (socket mode).");
})();