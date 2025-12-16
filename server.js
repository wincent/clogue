const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const app = express();
const PORT = 3000;

const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');

app.use(express.static('public'));

// List all projects
app.get('/api/projects', async (req, res) => {
  try {
    const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
    const projects = entries
      .filter(entry => entry.isDirectory())
      .map(entry => ({
        name: entry.name,
        displayName: entry.name.replace(/-/g, '/').replace(/^\//, '')
      }));
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List conversations in a project
app.get('/api/projects/:projectName/conversations', async (req, res) => {
  try {
    const projectPath = path.join(PROJECTS_DIR, req.params.projectName);
    const files = await fs.readdir(projectPath);
    const conversations = [];

    for (const file of files) {
      if (file.endsWith('.jsonl')) {
        const filePath = path.join(projectPath, file);
        const stats = await fs.stat(filePath);
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.trim().split('\n').filter(line => line);

        let firstUserMessage = null;
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            if (entry.type === 'user' && entry.message && entry.message.content) {
              const content = typeof entry.message.content === 'string'
                ? entry.message.content
                : entry.message.content[0]?.text || '';
              if (content && !content.includes('tool_result')) {
                firstUserMessage = content.substring(0, 100);
                break;
              }
            }
          } catch (e) {
            // Skip malformed lines
          }
        }

        conversations.push({
          id: file.replace('.jsonl', ''),
          filename: file,
          preview: firstUserMessage || 'No preview available',
          messageCount: lines.length,
          modified: stats.mtime,
          size: stats.size
        });
      }
    }

    conversations.sort((a, b) => b.modified - a.modified);
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get conversation content
app.get('/api/projects/:projectName/conversations/:conversationId', async (req, res) => {
  try {
    const filePath = path.join(
      PROJECTS_DIR,
      req.params.projectName,
      `${req.params.conversationId}.jsonl`
    );

    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line);
    const messages = [];

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.type === 'user' || entry.type === 'assistant') {
          messages.push(entry);
        }
      } catch (e) {
        console.error('Failed to parse line:', e);
      }
    }

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Clogue server running at http://localhost:${PORT}`);
  console.log(`Exploring Claude projects from: ${PROJECTS_DIR}`);
});
