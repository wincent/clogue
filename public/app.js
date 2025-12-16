let currentProject = null;
let currentConversation = null;
let allProjects = [];
let allConversations = [];
let showWarmup = false;
let currentMessages = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadProjects();
  setupSearchHandlers();
  setupWarmupToggle();
});

// Load all projects
async function loadProjects() {
  try {
    const response = await fetch('/api/projects');
    allProjects = await response.json();
    renderProjects(allProjects);
  } catch (error) {
    document.getElementById('projects-list').innerHTML =
      `<div class="empty-state"><h3>Error</h3><p>${error.message}</p></div>`;
  }
}

// Render projects list
function renderProjects(projects) {
  const container = document.getElementById('projects-list');
  if (projects.length === 0) {
    container.innerHTML =
      '<div class="empty-state"><h3>No projects found</h3></div>';
    return;
  }

  container.innerHTML = projects.map(project => `
    <div class="project-item" data-name="${project.name}" onclick="selectProject('${project.name}')">
      <div class="project-name">${escapeHtml(project.projectName)}</div>
      <div class="project-path">${escapeHtml(project.parentPath)}</div>
    </div>
  `).join('');
}

// Select a project
async function selectProject(projectName) {
  currentProject = projectName;
  currentConversation = null;

  // Update active state
  document.querySelectorAll('.project-item').forEach(el => {
    el.classList.toggle('active', el.dataset.name === projectName);
  });

  // Clear conversation selection
  document.getElementById('viewer').innerHTML =
    '<div class="empty-state"><h3>No conversation selected</h3><p>Select a conversation to view its messages</p></div>';

  // Load conversations
  document.getElementById('conversations-list').innerHTML =
    '<div class="loading">Loading conversations...</div>';

  try {
    const url = `/api/projects/${projectName}/conversations${showWarmup ? '?includeWarmup=true' : ''}`;
    const response = await fetch(url);
    allConversations = await response.json();
    renderConversations(allConversations);
  } catch (error) {
    document.getElementById('conversations-list').innerHTML =
      `<div class="empty-state"><h3>Error</h3><p>${error.message}</p></div>`;
  }
}

// Render conversations list
function renderConversations(conversations) {
  const container = document.getElementById('conversations-list');
  if (conversations.length === 0) {
    container.innerHTML =
      '<div class="empty-state"><h3>No conversations found</h3></div>';
    return;
  }

  container.innerHTML = conversations.map(conv => {
    const date = new Date(conv.modified).toLocaleString();
    const size = formatSize(conv.size);
    const warmupClass = conv.isWarmup ? ' warmup-conversation' : '';
    const warmupBadge = conv.isWarmup ? '<span class="warmup-badge">WARMUP</span>' : '';
    return `
      <div class="conversation-item${warmupClass}" data-id="${conv.id}" onclick="selectConversation('${conv.id}')">
        <div class="preview">${warmupBadge}${escapeHtml(conv.preview)}</div>
        <div class="meta">${date} • ${conv.messageCount} msgs • ${size}</div>
      </div>
    `;
  }).join('');
}

// Select a conversation
async function selectConversation(conversationId) {
  currentConversation = conversationId;

  // Update active state
  document.querySelectorAll('.conversation-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === conversationId);
  });

  // Load conversation
  document.getElementById('viewer').innerHTML =
    '<div class="loading">Loading conversation...</div>';

  try {
    const response = await fetch(`/api/projects/${currentProject}/conversations/${conversationId}`);
    const messages = await response.json();
    renderConversation(messages);
  } catch (error) {
    document.getElementById('viewer').innerHTML =
      `<div class="empty-state"><h3>Error</h3><p>${error.message}</p></div>`;
  }
}

// Render a conversation
function renderConversation(messages) {
  const viewer = document.getElementById('viewer');
  if (messages.length === 0) {
    viewer.innerHTML =
      '<div class="empty-state"><h3>Empty conversation</h3></div>';
    return;
  }

  currentMessages = messages;

  viewer.innerHTML = messages.map((msg, index) => {
    const timestamp = new Date(msg.timestamp).toLocaleString();
    let role = msg.message?.role || msg.type;

    // Detect tool result messages (they have type="user" but contain tool_result content)
    if (role === 'user' && Array.isArray(msg.message?.content)) {
      const hasOnlyToolResults = msg.message.content.every(item => item.type === 'tool_result');
      if (hasOnlyToolResults) {
        role = 'tool_result';
      }
    }

    // Build metadata pills
    const pills = [];
    if (msg.isMeta) {
      pills.push('<span class="meta-pill">meta</span>');
    }
    if (msg.isSidechain) {
      pills.push('<span class="meta-pill sidechain">sidechain</span>');
    }
    const pillsHtml = pills.length > 0 ? `<div class="meta-pills">${pills.join('')}</div>` : '';

    return `
      <div class="message ${role}">
        <div class="message-header">
          <span class="message-role">${role}</span>
          <span class="message-timestamp">${timestamp}</span>
          <button class="json-button" onclick="showJsonModal(${index})" title="View raw JSON">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>
            </svg>
          </button>
        </div>
        <div class="message-content">
          ${renderMessageContent(msg.message)}
        </div>
        ${pillsHtml}
      </div>
    `;
  }).join('');

  viewer.scrollTop = 0;
}

// Render message content
function renderMessageContent(message) {
  if (!message || !message.content) return '<em>No content</em>';

  const content = message.content;

  if (typeof content === 'string') {
    return escapeHtml(content);
  }

  if (Array.isArray(content)) {
    return content.map(item => {
      if (item.type === 'text') {
        return escapeHtml(item.text || '');
      } else if (item.type === 'thinking') {
        return `<div class="thinking"><strong>Thinking:</strong><br>${escapeHtml(item.thinking || '')}</div>`;
      } else if (item.type === 'tool_use') {
        return `
          <div class="tool-use">
            <div class="tool-use-header">Tool: ${item.name}</div>
            <pre>${escapeHtml(JSON.stringify(item.input, null, 2))}</pre>
          </div>
        `;
      } else if (item.type === 'tool_result') {
        const resultContent = typeof item.content === 'string'
          ? item.content
          : JSON.stringify(item.content, null, 2);
        return `
          <div class="tool-result">
            <strong>Tool Result (${item.tool_use_id}):</strong>
            <pre>${escapeHtml(resultContent)}</pre>
          </div>
        `;
      } else {
        return `<pre>${escapeHtml(JSON.stringify(item, null, 2))}</pre>`;
      }
    }).join('');
  }

  return escapeHtml(JSON.stringify(content, null, 2));
}

// Setup warmup toggle
function setupWarmupToggle() {
  const toggle = document.getElementById('warmup-toggle');
  toggle.addEventListener('change', (e) => {
    showWarmup = e.target.checked;
    if (currentProject) {
      selectProject(currentProject);
    }
  });
}

// Setup search handlers
function setupSearchHandlers() {
  document.getElementById('project-search').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = allProjects.filter(p =>
      p.projectName.toLowerCase().includes(query) ||
      p.parentPath.toLowerCase().includes(query)
    );
    renderProjects(filtered);
  });

  document.getElementById('conversation-search').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = allConversations.filter(c =>
      c.preview.toLowerCase().includes(query)
    );
    renderConversations(filtered);
  });
}

// JSON Modal functions
function showJsonModal(messageIndex) {
  const msg = currentMessages[messageIndex];
  const modal = document.getElementById('json-modal');
  const content = document.getElementById('json-content');

  content.textContent = JSON.stringify(msg, null, 2);
  modal.showModal();
}

function closeJsonModal() {
  const modal = document.getElementById('json-modal');
  modal.close();
}

// Utility functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
