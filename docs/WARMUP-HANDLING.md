# Warmup Conversation Handling

## Implementation Summary

I've implemented a system to filter out warmup conversations by default, with an optional toggle to show them.

## How It Works

### Backend (server.js)

The server now:
1. **Detects warmup conversations** by checking for:
   - `isSidechain: true` flag in the JSONL entries
   - First user message containing exactly "Warmup"

2. **Filters them by default**: Unless the `includeWarmup=true` query parameter is passed, warmup conversations are excluded from the response.

3. **Returns metadata**: Each conversation object includes `isWarmup` and `isSidechain` flags for frontend use.

### Frontend (app.js + index.html)

The UI now includes:
1. **A toggle checkbox** in the Conversations panel labeled "Show warmup conversations"
2. **Visual indicators** for warmup conversations when displayed:
   - Orange "WARMUP" badge
   - Dashed border and reduced opacity
3. **Dynamic loading**: When the toggle is changed, conversations are reloaded with the appropriate filter

## Testing

### Verify the API

Without warmup (default):
```bash
curl 'http://localhost:3000/api/projects/-Users-greg-hurrell-code-clogue/conversations'
```
Should return ~3 conversations (only real conversations)

With warmup enabled:
```bash
curl 'http://localhost:3000/api/projects/-Users-greg-hurrell-code-clogue/conversations?includeWarmup=true'
```
Should return ~12 conversations (including all agent-*.jsonl files)

### Verify the UI

1. **Start fresh**: Clear browser cache or do a hard refresh (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows/Linux)
2. **Load a project**: Click on a project in the left panel
3. **Check default state**: The conversations panel should show only real conversations (NOT the agent-*.jsonl files)
4. **Toggle warmup**: Check the "Show warmup conversations" checkbox
5. **Verify warmup appears**: You should now see additional conversations with:
   - "WARMUP" orange badge
   - Dashed borders
   - Reduced opacity

## What Gets Filtered

Based on analysis of the JSONL files in your clogue project:

**Filtered out (warmup/sidechain):**
- `agent-a0904d4.jsonl` - Warmup: true
- `agent-a0be5d5.jsonl` - Warmup: true
- `agent-a2b0848.jsonl` - Warmup: true
- `agent-a424f64.jsonl` - Warmup: true
- `agent-a823ca5.jsonl` - Sidechain: true
- `agent-a8d7dfd.jsonl` - Sidechain: true
- `agent-a935d2c.jsonl` - Sidechain: true
- `agent-aa1c15c.jsonl` - Warmup: true
- `agent-ab27128.jsonl` - Warmup: true

**Kept (real conversations):**
- `33208985-2b3e-42fa-9d7b-2282d7c977bb.jsonl`
- `85f3e1b3-88df-41e4-950d-e20fa8c3d3d9.jsonl`
- `fe22d7ce-98f2-4b58-a8ed-f33f16f57017.jsonl`

## Troubleshooting

If you still see warmup conversations when the checkbox is unchecked:

1. **Hard refresh the browser**: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)
2. **Check browser console**: Open DevTools (F12) and check the Console tab for errors
3. **Check network requests**: In DevTools Network tab, verify the API calls include/exclude `?includeWarmup=true` as expected
4. **Verify server is running the latest code**: Restart the server with `npm start`
5. **Check checkbox state**: Make sure the checkbox is actually unchecked (click it off if needed)
