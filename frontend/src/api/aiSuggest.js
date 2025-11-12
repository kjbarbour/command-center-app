// src/api/aiSuggest.js
// suggestForTask(task) -> { summary: string, steps: string[], subtasks: string[] }
// - Uses OpenAI if VITE_OPENAI_API_KEY is present
// - Otherwise returns mocked test data

function getField(task, key, fallbackKey) {
  if (!task) return ''
  const f = task.fields || {}
  return f[key] ?? task[key] ?? (fallbackKey ? (f[fallbackKey] ?? task[fallbackKey] ?? '') : '')
}

export async function suggestForTask(task) {
  const title = getField(task, 'Task Name', 'name') || ''
  const notes = getField(task, 'Notes', 'notes') || ''
  const status = getField(task, 'Status', 'status') || ''
  const priority = getField(task, 'Priority', 'priority') || ''
  const context = getField(task, 'Context', 'context') || ''
  const due = getField(task, 'Due Date', 'due') || ''
  const project = getField(task, 'Project', 'project') || ''

  // Try to include subtask names if available. In many Airtable setups a linked field
  // holds IDs; if names are present via lookup we include them, otherwise blank.
  // Accept several common shapes.
  const subtasksRaw =
    getField(task, 'Subtasks Names') ||
    getField(task, 'Subtasks') ||
    []
  const existingSubtaskNames = Array.isArray(subtasksRaw)
    ? subtasksRaw.filter(Boolean).map(String).slice(0, 20)
    : []

  const key = import.meta.env.VITE_OPENAI_API_KEY
  if (!key) {
    // Testing hooks (no key): return mocked data
    return {
      summary: 'Draft agenda and polish metric tooltips.',
      steps: ['Skim prior demos', 'Draft 5 bullets', 'Tighten tooltips'],
      subtasks: ['Review last demo notes', 'Write 5-bullet agenda', 'Update tooltip copy'],
    }
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: `You are helping a user execute a single task by providing a concise summary, 1–3 next steps, and 1–5 suggested subtasks.
Return ONLY JSON:
{
  "summary": string,         // max 2 sentences
  "steps": string[],         // up to 3 concise bullets
  "subtasks": string[]       // actionable, ≤ 7 words each
}
Keep everything brief and concrete.`,
          },
          {
            role: 'user',
            content: [
              'Task Context:',
              `Task Name: ${title}`,
              `Notes: ${notes || 'n/a'}`,
              `Status: ${status || 'n/a'}`,
              `Priority: ${priority || 'n/a'}`,
              `Context: ${context || 'n/a'}`,
              `Project: ${project || 'n/a'}`,
              `Due Date: ${due || 'n/a'}`,
              `Existing Subtasks: ${existingSubtaskNames.length ? existingSubtaskNames.join(' | ') : 'n/a'}`,
            ].join('\n'),
          },
        ],
      }),
    })
    const data = await res.json()
    const raw = data?.choices?.[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw)

    const summary = typeof parsed.summary === 'string'
      ? parsed.summary.split('\n').join(' ').trim().slice(0, 500)
      : ''
    const steps = Array.isArray(parsed.steps)
      ? parsed.steps.filter(Boolean).map(s => String(s).trim()).slice(0, 3)
      : []
    const subtasks = Array.isArray(parsed.subtasks)
      ? parsed.subtasks.filter(Boolean).map(s => String(s).trim()).slice(0, 5)
      : []

    return {
      summary: summary || 'No summary available.',
      steps,
      subtasks,
    }
  } catch (e) {
    // Graceful fallback on errors
    return {
      summary: 'Draft agenda and polish metric tooltips.',
      steps: ['Skim prior demos', 'Draft 5 bullets', 'Tighten tooltips'],
      subtasks: ['Review last demo notes', 'Write 5-bullet agenda', 'Update tooltip copy'],
    }
  }
}


