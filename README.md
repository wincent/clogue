# Clogue

Browser-based tool for exploring Claude conversation history stored in `~/.claude/projects`.

Vibe-coded with Claude, obviously.

## Features

- Browse all your Claude projects
- View conversations within each project
- Search projects and conversations
- Read complete conversation history with:
  - User messages
  - Assistant responses
  - Tool usage
  - Thinking blocks
  - Tool results
- Clean, modern interface with syntax highlighting

## Usage

1. Start the server:

```bash
npm start
```

2. Open your browser to:

```
http://localhost:3000
```

3. Browse your conversations:
   - Select a project from the left panel
   - Choose a conversation from the middle panel
   - View the full conversation in the right panel

## Project Structure

```
clogue/
├── server.js           # Express server with API endpoints
├── public/
│   ├── index.html     # Main HTML interface
│   └── app.js         # Client-side JavaScript
├── package.json       # Node.js dependencies
└── README.md          # This file
```

## API Endpoints

- `GET /api/projects` - List all projects
- `GET /api/projects/:projectName/conversations` - List conversations in a project
- `GET /api/projects/:projectName/conversations/:conversationId` - Get conversation messages

## Requirements

- Node.js (version 14 or higher)
- Access to `~/.claude/projects` directory
