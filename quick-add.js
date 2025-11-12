const { ipcRenderer } = require('electron');

// Airtable Configuration
const AIRTABLE_CONFIG = {
  baseId: 'appQlPzbpST2aQ3ca',
  token: 'AIRTABLE_TOKEN_REDACTED.44d1b12f6a83e20f6d2e8cce95f0a11ca620fc63833988186259775151510950',
  tableName: 'Tasks'
};

// Form elements
const form = document.getElementById('quickAddForm');
const taskNameInput = document.getElementById('taskName');
const prioritySelect = document.getElementById('priority');
const energySelect = document.getElementById('energy');
const timeEstimateInput = document.getElementById('timeEstimate');
const submitBtn = document.getElementById('submitBtn');
const feedback = document.getElementById('feedback');

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Escape to close
  if (e.key === 'Escape') {
    closeWindow();
  }
  
  // Cmd/Ctrl + Enter to submit
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    if (form.checkValidity()) {
      form.requestSubmit();
    }
  }
});

// Form submission
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const taskName = taskNameInput.value.trim();
  if (!taskName) {
    taskNameInput.focus();
    return;
  }

  // Disable form during submission
  submitBtn.disabled = true;
  submitBtn.textContent = 'Adding...';

  try {
    await addTaskToAirtable({
      taskName,
      priority: prioritySelect.value,
      energy: energySelect.value,
      timeEstimate: timeEstimateInput.value ? parseInt(timeEstimateInput.value) : null
    });

    // Show success feedback
    showFeedback('✅ Task added to Inbox!');
    
    // Notify main window to refresh
    ipcRenderer.send('task-added');
    
    // Close window after brief delay
    setTimeout(() => {
      closeWindow();
    }, 1000);

  } catch (error) {
    console.error('Failed to add task:', error);
    showFeedback('❌ Failed to add task');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Add to Inbox';
  }
});

async function addTaskToAirtable(taskData) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/${AIRTABLE_CONFIG.tableName}`;
  
  const fields = {
    'Task Name': taskData.taskName,
    'Status': 'Inbox',
    'Priority': taskData.priority,
    'Energy Level': taskData.energy,
    'Source': 'Quick Add'
  };

  // Add time estimate if provided
  if (taskData.timeEstimate) {
    fields['Time Estimate'] = taskData.timeEstimate;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_CONFIG.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to create task');
  }

  return response.json();
}

function showFeedback(message) {
  feedback.textContent = message;
  feedback.style.display = 'block';
  
  setTimeout(() => {
    feedback.style.display = 'none';
  }, 2000);
}

function closeWindow() {
  ipcRenderer.send('close-quick-add');
}

// Auto-focus on task name input
window.addEventListener('load', () => {
  taskNameInput.focus();
});