// Slack Sweep Service - Local API for Command Center
// Run with: node slack-sweep-service.js
// This service analyzes Slack DMs and extracts action items

const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3456;

// Your credentials
const ANTHROPIC_API_KEY = 'ANTHROPIC_KEY_REDACTED';
const SLACK_TOKEN = 'SLACK_TOKEN_REDACTED';

const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
});

// Endpoint to sweep Slack for tasks
app.post('/sweep-slack', async (req, res) => {
  try {
    console.log('Starting Slack sweep...');
    
    const daysBack = req.body.daysBack || 2;
    const timestamp = Math.floor(Date.now() / 1000) - (daysBack * 24 * 60 * 60);
    
    // Calculate date for search query
    const searchDate = new Date(Date.now() - (daysBack * 24 * 60 * 60 * 1000));
    const dateStr = searchDate.toISOString().split('T')[0];
    
    // Build the Slack search query
    const searchQuery = `to:me after:${dateStr} (can you OR could you OR need OR please OR by OR deadline OR urgent)`;
    
    console.log('Search query:', searchQuery);
    
    // Use Claude API with Slack MCP to search messages
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      mcp_servers: [{
        type: 'url',
        url: 'https://mcp.slack.com/mcp',
        name: 'slack-mcp'
      }],
      messages: [{
        role: 'user',
        content: `Search my Slack direct messages using this query: "${searchQuery}"
        
Then analyze the results and extract any ACTION ITEMS that are requests or tasks directed at me (Kevin Barbour).

For each action item found, return a JSON object with:
- taskName: Clear, actionable task description (30-50 chars)
- person: Who is asking/requesting
- priority: P2-High (default for all Slack requests)
- energy: "Medium" (default)
- timeEstimate: 30 (default, in minutes)
- context: "Quick Wins" for simple tasks, "Admin" for administrative work, "Meetings" for scheduling
- aiReasoning: One sentence explaining why this is a task
- slackLink: Permalink to the original message

IMPORTANT: Only include genuine action items where someone is asking me to do something specific. Do not include:
- Casual conversation
- FYI messages
- Things I already completed (check context)
- General discussions

Return ONLY a JSON array of task objects, nothing else. If no tasks found, return empty array [].`
      }]
    });
    
    // Parse Claude's response
    let tasks = [];
    const responseText = message.content.find(block => block.type === 'text')?.text || '[]';
    
    console.log('Claude response:', responseText);
    
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = responseText.trim();
    if (jsonStr.includes('```json')) {
      jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
    } else if (jsonStr.includes('```')) {
      jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
    }
    
    try {
      tasks = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse JSON:', parseError);
      console.error('Raw response:', responseText);
      tasks = [];
    }
    
    console.log(`Found ${tasks.length} tasks`);
    
    res.json({
      success: true,
      tasksFound: tasks.length,
      tasks: tasks
    });
    
  } catch (error) {
    console.error('Error sweeping Slack:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'running', service: 'slack-sweep' });
});

app.listen(PORT, () => {
  console.log(`🚀 Slack Sweep Service running on http://localhost:${PORT}`);
  console.log(`Ready to sweep Slack DMs for tasks!`);
});