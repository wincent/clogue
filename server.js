const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const app = express();
const PORT = 3000;

const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');

app.use(express.static('public'));

// Reconstruct the actual filesystem path from the encoded directory name
async function reconstructPath(dirName, homeDir) {
  // Remove leading dash and split into parts
  const parts = dirName.replace(/^-/, '').split('-');

  // Start building path from root
  let currentPath = '';
  let pathComponents = [];
  let i = 0;

  // Handle /Users/username pattern (username may contain dots)
  if (parts[0] === 'Users' && parts.length > 2) {
    // Try username with dot: Users/first.last
    const possibleUsername = parts[1] + '.' + parts[2];
    if (homeDir === `/Users/${possibleUsername}`) {
      currentPath = homeDir;
      pathComponents.push('Users', possibleUsername);
      i = 3;
    } else {
      // Fall back to regular handling
      currentPath = '/Users';
      pathComponents.push('Users');
      i = 1;
    }
  } else {
    currentPath = '/' + parts[0];
    pathComponents.push(parts[0]);
    i = 1;
  }

  // Walk through remaining parts, checking filesystem to determine actual structure
  while (i < parts.length) {
    let found = false;

    // Try dot-separated combination first (e.g., github + com = github.com)
    if (i + 1 < parts.length) {
      const dotCandidate = parts[i] + '.' + parts[i + 1];
      const testPath = path.join(currentPath, dotCandidate);

      try {
        await fs.access(testPath);
        // Dot-separated path exists on disk
        currentPath = testPath;
        pathComponents.push(dotCandidate);
        i += 2;
        found = true;
      } catch (e) {
        // Dot-separated doesn't exist, continue with dash combinations
      }
    }

    // Try increasingly longer dash-separated combinations
    if (!found) {
      for (let j = i; j < parts.length; j++) {
        const candidate = parts.slice(i, j + 1).join('-');
        const testPath = path.join(currentPath, candidate);

        try {
          await fs.access(testPath);
          // Path exists, use it
          currentPath = testPath;
          pathComponents.push(candidate);
          i = j + 1;
          found = true;
          break;
        } catch (e) {
          // Path doesn't exist, try longer combination
        }
      }
    }

    if (!found) {
      // Path doesn't exist on disk, fall back to treating each part as separate
      pathComponents.push(parts[i]);
      currentPath = path.join(currentPath, parts[i]);
      i++;
    }
  }

  return {
    fullPath: currentPath,
    components: pathComponents
  };
}

// List all projects
app.get('/api/projects', async (req, res) => {
  try {
    const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
    const homeDir = os.homedir();
    const projects = await Promise.all(
      entries
        .filter(entry => entry.isDirectory())
        .map(async (entry) => {
          const { fullPath, components } = await reconstructPath(entry.name, homeDir);

          // Get project name (last component)
          const projectName = components[components.length - 1];

          // Get parent path components (domain patterns already handled in reconstructPath)
          const parentComponents = components.slice(0, -1);

          // Build the parent path
          const parentPath = '/' + parentComponents.join('/');
          const displayParentPath = parentPath.startsWith(homeDir)
            ? '~' + parentPath.substring(homeDir.length)
            : parentPath;

          return {
            name: entry.name,
            projectName: projectName,
            parentPath: displayParentPath
          };
        })
    );
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
    const includeWarmup = req.query.includeWarmup === 'true';

    for (const file of files) {
      if (file.endsWith('.jsonl')) {
        const filePath = path.join(projectPath, file);
        const stats = await fs.stat(filePath);
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.trim().split('\n').filter(line => line);

        let firstUserMessage = null;
        let isWarmup = false;
        let isSidechain = false;

        // First pass: check for sidechain flag and warmup message
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);

            // Check for sidechain flag
            if (entry.isSidechain === true) {
              isSidechain = true;
            }

            // Look for first user message to check for warmup
            if (!isWarmup && entry.type === 'user' && entry.message && entry.message.content) {
              const content = typeof entry.message.content === 'string'
                ? entry.message.content
                : entry.message.content[0]?.text || '';
              // Check if it's a warmup message
              if (content === 'Warmup') {
                isWarmup = true;
              }
            }
          } catch (e) {
            // Skip malformed lines
          }
        }

        // Skip warmup conversations unless explicitly requested
        if ((isWarmup || isSidechain) && !includeWarmup) {
          continue;
        }

        // Second pass: get first user message for preview (skip tool_result messages)
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
          size: stats.size,
          isWarmup: isWarmup,
          isSidechain: isSidechain
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
