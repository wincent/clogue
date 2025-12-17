# Contributing

## Publishing to npm

### Prerequisites

Ensure you are logged in:
```bash
npm login
```

### Publishing Process

1. **Update the version number** in `package.json`:
   ```bash
   npm version patch  # for bug fixes (0.0.1 -> 0.0.2)
   npm version minor  # for new features (0.0.1 -> 0.1.0)
   npm version major  # for breaking changes (0.0.1 -> 1.0.0)
   ```

   This updates `package.json` and creates a git tag automatically.

2. **Test the package locally**:
   ```bash
   npm link
   clogue
   ```

   Verify it works correctly, then unlink:
   ```bash
   npm unlink
   ```

3. **Preview what will be published**:
   ```bash
   npm pack --dry-run
   ```

   This shows which files will be included based on the `files` field in `package.json`.

4. **Publish to npm**:
   ```bash
   npm publish
   ```

5. **Push the version tag to GitHub**:
   ```bash
   git push --follow-tags
   ```

6. **Verify the package**:
   ```bash
   npm view clogue
   ```

### What Gets Published

The `files` field in `package.json` controls what gets published:
- `server.js` - The main executable
- `public/app.js` - Client-side JavaScript
- `public/index.html` - Web interface
- `README.md` - Documentation
- `LICENSE.md` - License text

Note: `package.json` and dependencies are automatically included.
