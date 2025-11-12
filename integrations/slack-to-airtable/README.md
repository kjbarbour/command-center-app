# Slack → Airtable Task Bridge (Socket Mode)

Turns Slack DMs/mentions into Airtable tasks for the Command Center.  
No public URL required (uses Slack **Socket Mode**). Tasks are created with `Auto-Schedule = true`, so your Command Center app schedules them automatically.

---

## What it does

Creates an Airtable **Tasks** record when:
- Someone **DMs you** and it looks like a request (e.g., “please…”, “can you…”, “due…”, `P1`, `@ 11/12`)
- Someone **@mentions you** in a channel and it looks like a request
- **You** type `task: ...` anywhere (quick capture)

Parsed hints (all optional):
- **Priority:** `P1 | P2 | P3 | P4`
- **Duration:** `45` or `45m`
- **Due date:** `@ 2025-11-10` or `@ 11/12`

Example: