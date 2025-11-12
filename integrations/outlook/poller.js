// integrations/outlook/poller.js
import fetch from "node-fetch";
import msal from "@azure/msal-node";
import { createTask } from "../common/airtable.js";

const {
  MSFT_TENANT_ID,
  MSFT_CLIENT_ID,
  MSFT_CLIENT_SECRET,        // for client credentials flow (app-only)
  MSFT_USER_ID,              // user principal name or GUID to read mailbox for
  POLL_INTERVAL_MS = "120000",
} = process.env;

// Auth (client credentials; requires proper Graph app perms: Mail.Read)
const cca = new msal.ConfidentialClientApplication({
  auth: {
    clientId: MSFT_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${MSFT_TENANT_ID}`,
    clientSecret: MSFT_CLIENT_SECRET,
  },
});

async function getToken() {
  const token = await cca.acquireTokenByClientCredential({
    scopes: ["https://graph.microsoft.com/.default"],
  });
  if (!token?.accessToken) throw new Error("Failed to get Graph token");
  return token.accessToken;
}

async function fetchCandidateEmails(accessToken) {
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(MSFT_USER_ID)}/messages?$top=25&$orderby=receivedDateTime DESC`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Graph list messages failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const items = json.value || [];
  // Filter: category includes "Task" OR subject starts with [TASK]
  return items.filter(m =>
    (Array.isArray(m.categories) && m.categories.includes("Task")) ||
    (m.subject || "").trim().toUpperCase().startsWith("[TASK]")
  );
}

function extractTaskFromMail(m) {
  const subject = (m.subject || "").replace(/^\[TASK\]\s*/i, "").trim() || "Email → Task";
  const bodyPreview = m.bodyPreview || "";
  // Basic duration & priority hints: [P1], [P2], [45m], [11/18]
  const p = (m.subject || "").match(/\[P([1-4])\]/i);
  const pr = p ? `P${p[1]}` : "P3";
  const min = (m.subject || "").match(/\[(\d{2,3})m\]/i);
  const minutes = min ? Number(min[1]) : 30;
  const dueM = (m.subject || "").match(/\[(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2})\]/);
  let due = null;
  if (dueM) {
    const raw = dueM[1];
    if (raw.includes("-")) due = raw;
    else {
      const [mm, dd] = raw.split("/");
      const yyyy = new Date().getFullYear();
      due = `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }
  }
  return {
    name: subject,
    priority: mapPriority(pr),
    timeEstimate: minutes,
    dueDate: due,
    notes: `From Outlook: ${m.from?.emailAddress?.name || ""} <${m.from?.emailAddress?.address || ""}>\n\n${bodyPreview}`,
  };
}

function mapPriority(p) {
  const m = { P1: "P1-Critical", P2: "P2-High", P3: "P3-Medium", P4: "P4-Low" };
  return m[(p || "P3").toUpperCase()] || "P3-Medium";
}

async function runOnce() {
  const token = await getToken();
  const emails = await fetchCandidateEmails(token);
  for (const m of emails) {
    try {
      await createTask({
        ...extractTaskFromMail(m),
        source: "Email",
        context: "Admin",
        project: "CRM Dashboard",
        status: "Inbox",
        autoSchedule: true,
      });
      // Optional: add a category so we don’t re-import next poll
      await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(MSFT_USER_ID)}/messages/${m.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ categories: [...new Set([...(m.categories || []), "ImportedToAirtable"])] }),
      });
    } catch (e) {
      console.error("Create task from mail failed:", e.message);
    }
  }
}

(async function loop() {
  console.log("📬 Outlook poller started.");
  await runOnce();
  setInterval(runOnce, Number(POLL_INTERVAL_MS));
})();