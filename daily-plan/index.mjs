import 'dotenv/config';

// --- Config ---
const {
  AIRTABLE_TOKEN,
  AIRTABLE_BASE,
  AIRTABLE_TABLE = 'Tasks',
  DEFAULT_PROJECT = 'Command Center',
  TIMEZONE = 'America/Chicago',
  MAX_HIGH = '6',
  MAX_MED = '6',
  MAX_LOW = '6'
} = process.env;

if (!AIRTABLE_TOKEN || !AIRTABLE_BASE) {
  console.error('Missing AIRTABLE_TOKEN or AIRTABLE_BASE in .env');
  process.exit(1);
}

const DRY = process.argv.includes('--dry-run');

// Airtable REST helpers (Node 18+ has fetch)
const AT_URL = (path) => `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(AIRTABLE_TABLE)}${path || ''}`;
const AT = async (path, options = {}) => {
  const res = await fetch(AT_URL(path), {
    ...options,
    headers: {
      Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Airtable ${res.status}: ${txt}`);
  }
  return res.json();
};

// Utils
const todayIso = (tz = 'UTC') => {
  const d = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(d).reduce((a, p) => (a[p.type] = p.value, a), {});
  return `${fmt.year}-${fmt.month}-${fmt.day}`; // YYYY-MM-DD
};

const nowStamp = (tz) =>
  new Intl.DateTimeFormat('en-US', { timeZone: tz, dateStyle: 'medium', timeStyle: 'short' }).format(new Date());

const uniq = (arr) => [...new Set(arr)];
const sum = (arr) => arr.reduce((a, b) => a + (Number(b) || 0), 0);

// Fetch candidate tasks
async function fetchTasks() {
  // Pull not-Done tasks from typical working statuses
  const filter =
    "AND(NOT({Status} = 'Done'), OR({Status} = 'Inbox', {Status} = 'Today', {Status} = 'This Week', {Status} = 'Scheduled'))";

  let offset, all = [];
  do {
    const url = `?filterByFormula=${encodeURIComponent(filter)}&pageSize=100${offset ? `&offset=${offset}` : ''}`;
    const data = await AT(url, { method: 'GET' });
    all = all.concat(data.records);
    offset = data.offset;
  } while (offset);

  return all.map(r => ({
    id: r.id,
    ...r.fields
  }));
}

// Bucketing logic
function bucketize(tasks) {
  // Normalize fields we use
  const t = tasks.map(x => ({
    id: x.id,
    name: x['Task Name'] || '(untitled)',
    status: x['Status'] || '',
    priority: x['Priority'] || '',
    context: x['Context'] || '',
    time: Number(x['Time Estimate'] || 0),
    due: x['Due Date'] || null,
    urgency: Number(x['Urgency Score'] || 0)
  }));

  // Quick wins
  const quick = t.filter(x => x.time > 0 && x.time <= 5);

  // High / Med / Low (simple, tunable)
  const high = t
    .filter(x =>
      x.status === 'Today' ||
      x.priority === 'P1-Critical' ||
      x.urgency >= 100
    );

  const med = t
    .filter(x =>
      !high.includes(x) &&
      (x.priority === 'P2-High' || x.priority === 'P3-Medium' || x.urgency >= 40)
    );

  const low = t
    .filter(x => !high.includes(x) && !med.includes(x));

  // Sort inside buckets
  const byUrgencyThenShorter = (a, b) => (b.urgency - a.urgency) || (a.time - b.time);
  high.sort(byUrgencyThenShorter);
  med.sort(byUrgencyThenShorter);
  low.sort(byUrgencyThenShorter);
  quick.sort(byUrgencyThenShorter);

  // Caps
  const cap = (arr, n) => arr.slice(0, Number(n));
  return {
    high: cap(high, MAX_HIGH),
    med: cap(med, MAX_MED),
    low: cap(low, MAX_LOW),
    quick: cap(quick, 8) // cap quick wins to keep it tidy
  };
}

// Recommend first task
function pickStartingTask(buckets) {
  const prefer = (arr, pred) => arr.find(pred) || arr[0];
  return (
    prefer(buckets.high, t => (t.context || '').includes('Deep Work')) ||
    buckets.quick[0] ||
    buckets.med[0] ||
    buckets.low[0] ||
    null
  );
}

// Render Markdown plan
function renderPlan({ buckets, startTask, tz }) {
  const stamp = nowStamp(tz);
  const lines = [];

  const fmt = (t) => `- ${t.name}  _(P:${t.priority || '-'} • ${t.time ? t.time + 'm' : '—'} • U:${t.urgency})_`;

  lines.push(`# Daily Plan — ${todayIso(tz)} (${stamp})`);
  if (startTask) lines.push(`\n**Recommended starting task:** ${startTask.name}`);
  lines.push('\n## High-priority (must happen today)');
  lines.push(buckets.high.length ? buckets.high.map(fmt).join('\n') : '- (none)');

  lines.push('\n## Medium-priority (if time allows)');
  lines.push(buckets.med.length ? buckets.med.map(fmt).join('\n') : '- (none)');

  lines.push('\n## Low-priority (park or schedule)');
  lines.push(buckets.low.length ? buckets.low.map(fmt).join('\n') : '- (none)');

  lines.push('\n## Quick wins (≤5 min)');
  lines.push(buckets.quick.length ? buckets.quick.map(fmt).join('\n') : '- (none)');

  const totalEst = {
    high: sum(buckets.high.map(x => x.time)),
    med: sum(buckets.med.map(x => x.time)),
    low: sum(buckets.low.map(x => x.time)),
    quick: sum(buckets.quick.map(x => x.time))
  };

  lines.push(`\n---\n**Estimates** • High: ${totalEst.high}m • Med: ${totalEst.med}m • Low: ${totalEst.low}m • Quick: ${totalEst.quick}m`);

  lines.push(`\n> Generated automatically by Daily Plan script.`);

  return lines.join('\n');
}

// Create (or replace) the “📋 Daily Plan (YYYY-MM-DD)” record
async function upsertDailyPlan(planMd, tz) {
  const name = `📋 Daily Plan (${todayIso(tz)})`;

  // Find existing by name
  const filter = `({Task Name} = '${name.replace(/'/g, "\\'")}')`;
  const url = `?filterByFormula=${encodeURIComponent(filter)}&pageSize=1`;
  const found = await AT(url, { method: 'GET' });

  const fields = {
    'Task Name': name,
    'Notes': planMd,
    // ▼ single-selects must be strings (exact option text)
    'Project': DEFAULT_PROJECT,         // e.g., "Command Center"
    'Status': 'Today',
    'Source': 'Manual'
  };

  if (DRY) {
    console.log(`[DRY] Would upsert task: ${name}`);
    return null;
  }

  if (found.records && found.records.length) {
    const id = found.records[0].id;
    await AT('', {
      method: 'PATCH',
      body: JSON.stringify({
        records: [{ id, fields }],
        typecast: true // allows valid option matching
      })
    });
    return id;
  } else {
    const created = await AT('', {
      method: 'POST',
      body: JSON.stringify({
        records: [{ fields }],
        typecast: true // allows valid option matching
      })
    });
    return created.records?.[0]?.id || null;
  }
}
// Annotate included tasks
async function annotateTasks(buckets, tz) {
  const all = uniq([...buckets.high, ...buckets.med, ...buckets.low, ...buckets.quick].map(x => x.id));
  if (all.length === 0 || DRY) {
    if (DRY) console.log(`[DRY] Would annotate ${all.length} tasks`);
    return;
  }

  const stamp = nowStamp(tz);
  const updates = all.map(id => ({
    id,
    fields: {
      'AI Reasoning': `[Daily Plan ${stamp}] Included in the plan for ${todayIso(tz)}.`
    }
  }));

  // Batch in 10s to be safe
  for (let i = 0; i < updates.length; i += 10) {
    await AT('', { method: 'PATCH', body: JSON.stringify({ records: updates.slice(i, i + 10) }) });
  }
}

async function main() {
  const tasks = await fetchTasks();
  const buckets = bucketize(tasks);
  const startTask = pickStartingTask(buckets);
  const plan = renderPlan({ buckets, startTask, tz: TIMEZONE });

  console.log('\n=== Daily Plan Preview ===\n');
  console.log(plan);
  console.log('\n==========================\n');

  const planId = await upsertDailyPlan(plan, TIMEZONE);
  await annotateTasks(buckets, TIMEZONE);

  if (!DRY) console.log(`Saved plan to Airtable record: ${planId || '(created)'}`);
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});