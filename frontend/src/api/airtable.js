// src/api/airtable.js

// ------- Env / constants -------
const TOKEN = import.meta.env.VITE_AIRTABLE_TOKEN
const BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID
const TABLE = import.meta.env.VITE_AIRTABLE_TABLE || 'Tasks'

if (!BASE_ID) console.warn('[airtable] Missing VITE_AIRTABLE_BASE_ID')
if (!TOKEN) console.warn('[airtable] Missing VITE_AIRTABLE_TOKEN')

const API_ROOT = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE)}`
const HEADERS_JSON = {
  Authorization: `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
}

// Small helper
async function _req(url, init) {
  const res = await fetch(url, init)
  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    throw new Error(`Airtable ${res.status}: ${msg || res.statusText}`)
  }
  return res.json()
}

// ------- Public API -------

/**
 * Fetch up to 100 records (you can add pagination later if needed).
 * Returns raw Airtable records: { id, fields, createdTime }
 */
export async function fetchTasks({ view, pageSize = 100, filterByFormula } = {}) {
  const url = new URL(API_ROOT)
  url.searchParams.set('pageSize', String(Math.min(pageSize, 100)))
  if (view) url.searchParams.set('view', view)
  if (filterByFormula) url.searchParams.set('filterByFormula', filterByFormula)

  const data = await _req(url.toString(), { headers: { Authorization: `Bearer ${TOKEN}` } })
  return data.records || []
}

/**
 * Fetch specific tasks by Airtable record IDs (<= 100).
 */
export async function fetchTasksByIds(ids = []) {
  if (!ids.length) return []
  const ors = ids.slice(0, 100).map((id) => `RECORD_ID()="${id}"`).join(', ')
  const url = new URL(API_ROOT)
  url.searchParams.set('pageSize', '100')
  url.searchParams.set('filterByFormula', `OR(${ors})`)
  const data = await _req(url.toString(), { headers: { Authorization: `Bearer ${TOKEN}` } })
  return data.records || []
}

/**
 * Create a single task with raw Airtable fields object.
 * Returns the created Airtable record.
 */
export async function createTask(fields) {
  const body = JSON.stringify({ fields })
  const data = await _req(API_ROOT, { method: 'POST', headers: HEADERS_JSON, body })
  return data
}

/**
 * Create a batch of tasks. `list` is an array of field objects.
 * Returns created records array.
 */
export async function createTasksBatch(list = []) {
  if (!Array.isArray(list) || !list.length) return []
  const body = JSON.stringify({ records: list.map((fields) => ({ fields })) })
  const data = await _req(API_ROOT, { method: 'POST', headers: HEADERS_JSON, body })
  return data.records || []
}

/**
 * Update a task by id with raw fields.
 * Returns the updated Airtable record.
 */
export async function updateTask(id, fields) {
  const url = `${API_ROOT}/${id}`
  const body = JSON.stringify({ fields })
  const data = await _req(url, { method: 'PATCH', headers: HEADERS_JSON, body })
  return data
}

/**
 * Create subtasks and link them to a parent.
 * - Creates child records with Parent Task linked to parentId (and Status=Inbox)
 * - Appends children to parent's Subtasks (does not overwrite existing)
 * Returns { children: createdRecords, parent: updatedParentRecord }
 */
export async function createSubtasks(parentId, names = []) {
  if (!parentId || !Array.isArray(names) || !names.length) {
    return { children: [], parent: null }
  }

  // 1) Create children
  const childPayloads = names.map((name) => ({
    'Task Name': name,
    'Status': 'Inbox',
    'Parent Task': [parentId],
  }))
  const createdChildren = await createTasksBatch(childPayloads)

  // 2) Fetch parent to get existing Subtasks
  const [parent] = await fetchTasksByIds([parentId])
  const existingSubIds = Array.isArray(parent?.fields?.Subtasks)
    ? parent.fields.Subtasks.map((x) => (typeof x === 'string' ? x : x?.id)).filter(Boolean)
    : []

  const newIds = createdChildren.map((r) => r.id)
  const nextIds = Array.from(new Set([...existingSubIds, ...newIds]))

  // 3) Update parent Subtasks
  const updatedParent = await updateTask(parentId, { 'Subtasks': nextIds })

  return { children: createdChildren, parent: updatedParent }
}

export default {
  fetchTasks,
  fetchTasksByIds,
  createTask,
  createTasksBatch,
  updateTask,
  createSubtasks,
}