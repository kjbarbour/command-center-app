const https = require('https');
const fs = require('fs');

// Airtable Configuration
const AIRTABLE_TOKEN = 'AIRTABLE_TOKEN_REDACTED.44d1b12f6a83e20f6d2e8cce95f0a11ca620fc63833988186259775151510950';
const BASE_ID = 'appQlPzbpST2aQ3ca';
const TABLE_NAME = 'Project Tasks';

// Read the markdown file
const markdownPath = './competitive-intel-checklist.md';
const markdown = fs.readFileSync(markdownPath, 'utf8');

// Parse markdown
function parseMarkdown(md) {
  const tasks = [];
  const lines = md.split('\n');
  
  let currentParentTask = null;
  let currentPhase = '';
  let inSubtasks = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Phase headers
    if (line.match(/^##\s+.*PHASE\s+\d+:/i)) {
      currentPhase = line.replace(/^##\s+/, '').replace(/[🔴🟢🎨🚀✨]/g, '').trim();
      continue;
    }
    
    // Main task headers
    const taskMatch = line.match(/^###\s+.*Task\s+([\d.]+):\s+(.+)/i);
    if (taskMatch) {
      if (currentParentTask && currentParentTask.taskName) {
        tasks.push(currentParentTask);
      }
      
      currentParentTask = {
        taskName: `Task ${taskMatch[1]}: ${taskMatch[2]}`.trim(),
        phase: currentPhase,
        timeEstimate: 60,
        subtaskTexts: []
      };
      inSubtasks = false;
      continue;
    }
    
    // Time estimate
    const timeMatch = line.match(/\*\*Time\*\*:\s+(\d+)\s+hours?/i);
    if (timeMatch && currentParentTask) {
      currentParentTask.timeEstimate = parseInt(timeMatch[1]);
      continue;
    }
    
    // Subtasks section start
    if (line.match(/^\*\*Subtasks\*\*:/i)) {
      inSubtasks = true;
      continue;
    }
    
    // Collect subtask items
    if (inSubtasks && line.match(/^-\s+\[\s*\]\s+/)) {
      const subtaskText = line.replace(/^-\s+\[\s*\]\s+/, '').trim();
      if (currentParentTask && subtaskText) {
        const cleanText = subtaskText.replace(/`/g, '').replace(/[^\x00-\x7F]/g, '');
        currentParentTask.subtaskTexts.push(cleanText);
      }
      continue;
    }
    
    // End subtasks section
    if (inSubtasks && line.match(/^\*\*[A-Z]/)) {
      inSubtasks = false;
    }
  }
  
  if (currentParentTask && currentParentTask.taskName) {
    tasks.push(currentParentTask);
  }
  
  return tasks;
}

// Create task in Airtable
function createTask(taskData) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      fields: taskData
    });
    
    const options = {
      hostname: 'api.airtable.com',
      path: `/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          const result = JSON.parse(body);
          resolve(result);
        } else {
          reject(new Error(`Status ${res.statusCode}: ${body}`));
        }
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Main execution
async function importTasks() {
  console.log('📖 Reading markdown file...');
  const parsedTasks = parseMarkdown(markdown);
  console.log(`Found ${parsedTasks.length} parent tasks\n`);
  
  let successCount = 0;
  let failCount = 0;
  let totalSubtasks = 0;
  
  for (const task of parsedTasks) {
    try {
      // Create parent task - ONLY send basic fields
      console.log(`\n📌 Creating: ${task.taskName}`);
      const parentTaskData = {
        'Task Name': task.taskName,
        'Estimated Hours': task.timeEstimate
      };
      
      const parentRecord = await createTask(parentTaskData);
      console.log(`✅ Parent created (ID: ${parentRecord.id})`);
      successCount++;
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Create subtasks
      if (task.subtaskTexts.length > 0) {
        console.log(`  📋 Creating ${task.subtaskTexts.length} subtasks...`);
        
        for (let i = 0; i < task.subtaskTexts.length; i++) {
          const subtaskText = task.subtaskTexts[i];
          const subtaskData = {
            'Task Name': subtaskText,
            'Estimated Hours': Math.round(task.timeEstimate / task.subtaskTexts.length * 10) / 10,
            'Parent Task': [parentRecord.id]
          };
          
          await createTask(subtaskData);
          process.stdout.write(`    ✅ ${i+1}/${task.subtaskTexts.length}\r`);
          totalSubtasks++;
          
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        console.log(`    ✅ ${task.subtaskTexts.length}/${task.subtaskTexts.length} subtasks created`);
      }
      
    } catch (error) {
      console.error(`\n❌ Failed: ${task.taskName}`);
      console.error(`   Error: ${error.message}`);
      failCount++;
    }
  }
  
  console.log(`\n\n${'='.repeat(60)}`);
  console.log(`🎉 IMPORT COMPLETE`);
  console.log(`${'='.repeat(60)}`);
  console.log(`✅ Successful parent tasks: ${successCount}`);
  console.log(`❌ Failed parent tasks: ${failCount}`);
  console.log(`📋 Total subtasks created: ${totalSubtasks}`);
  console.log(`📊 Total tasks in Project Tasks table: ${successCount + totalSubtasks}`);
  console.log(`${'='.repeat(60)}\n`);
}

importTasks().catch(console.error);
