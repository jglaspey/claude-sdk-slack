# Claude Agent SDK Docker Deployment Troubleshooting

## Objective
Deploy a Slack bot using the Claude Agent SDK in a Docker container on Railway, resolving `spawn ENOENT` errors.

---

## 📊 Progress Summary

**Status:** ✅ **SUCCESS! FULLY WORKING!** 🎉

**Final Solution Achieved After 28 Attempts!**

**All Issues Resolved:**
- ✅ **Solved spawn ENOENT errors** (attempts 17-18)
- ✅ **Process spawns successfully** (using `executable: 'node'`)
- ✅ **Working directory issue resolved** (create before spawn)
- ✅ **CLI version compatibility fixed** (upgraded to 1.0.117)
- ✅ **Authentication solved** (`forceLoginMethod: "console"` + `apiKeyHelper`)
- ✅ **CLI runs without errors** (non-root user allows `bypassPermissions`)
- ✅ **Database permissions fixed** (entrypoint script with gosu)
- ✅ **Railway deployment working** (removed startCommand override)
- ✅ **Bot responding in Slack** (full end-to-end success!)

**Key Insights:**
1. The `spawn ENOENT` error was caused by an invalid `cwd`, not missing executables
2. Using `executable: 'node'` with `require.resolve()` bypasses shebang issues
3. **stderr/stdout capture was crucial** - revealed hidden CLI errors
4. SDK version must match CLI version (1.0.67 doesn't support `--setting-sources`)
5. CLI refuses `bypassPermissions` when running as root (security feature)
6. Railway volumes are root-owned and need permission fix at runtime
7. **Railway's `startCommand` in railway.toml completely bypasses Docker ENTRYPOINT** (critical!)

**Total Attempts:** 28 different approaches documented below

---

## 🎯 Working Solution (TL;DR)

For anyone trying to deploy the Claude Agent SDK in Docker on Railway, here's what you need:

### 1. Package Dependencies
```json
{
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.1.30",
    "@anthropic-ai/claude-code": "^1.0.117",
    // ... other deps
  }
}
```

### 2. SDK Configuration (TypeScript)
```typescript
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'path';

const require = createRequire(import.meta.url);

// Create sessions directory
function getSessionsDir(): string {
  const mount = process.env.RAILWAY_VOLUME_MOUNT_PATH;
  const sessionsPath = mount ? path.join(mount, '.claude_sessions') : '/data/.claude_sessions';
  fs.mkdirSync(sessionsPath, { recursive: true });
  return sessionsPath;
}

// Configure Claude settings for API key auth
function ensureClaudeUserSettings(): void {
  const settingsPath = path.join(os.homedir(), '.claude/settings.json');
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify({
    forceLoginMethod: 'console',
    hasCompletedOnboarding: true
  }));
}

// SDK options
const options = {
  executable: 'node', // Use node directly, not shebang
  pathToClaudeCodeExecutable: require.resolve('@anthropic-ai/claude-code/cli.js'),
  cwd: getSessionsDir(), // Must exist before spawning!
  env: { ...process.env, ANTHROPIC_API_KEY: config.apiKey },
  stderr: (data) => console.error('[claude-cli stderr]', data),
  permissionMode: 'bypassPermissions',
};
```

### 3. Dockerfile
```dockerfile
FROM node:20-slim

# Create non-root user
RUN useradd -m -u 1001 appuser

# Install app dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci
RUN npm run build
RUN npm prune --production

# Give ownership to appuser
RUN chown -R appuser:appuser /app

# Install gosu for user switching
RUN apt-get update && apt-get install -y gosu && rm -rf /var/lib/apt/lists/*

# Entrypoint: fix /data permissions, then switch to appuser
ENTRYPOINT ["/bin/sh", "-c", "if [ -d /data ]; then chown -R appuser:appuser /data; fi && exec gosu appuser /usr/local/bin/node dist/index.js"]
```

### 4. Railway Configuration (railway.toml)
```toml
[build]
builder = "dockerfile"

[deploy]
# DO NOT set startCommand - let Docker ENTRYPOINT run!
# startCommand = "npm start" # <-- This breaks everything!
healthcheckPath = "/health"

[[volumes]]
mountPath = "/data"
```

### 5. Key Requirements
- ✅ CLI version 1.0.117+ to match SDK
- ✅ `executable: 'node'` with `require.resolve()` for CLI path
- ✅ Create `cwd` directory before spawning
- ✅ `forceLoginMethod: 'console'` for API key auth
- ✅ Run as non-root user (bypasses permission restriction)
- ✅ Fix volume permissions in entrypoint before switching users
- ✅ **Remove `startCommand` from railway.toml** (critical!)

---

## What We've Tried & What We Learned

### 1. **Initial Error: `spawn node ENOENT`**
**Attempt:** Basic Dockerfile with globally installed `@anthropic-ai/claude-code`  
**Result:** ❌ Failed  
**Error:** `spawn node ENOENT`  
**Learning:** The SDK spawns a child process that couldn't find `node` in its PATH, even though node was available in the parent process.

---

### 2. **Added PATH Environment Variables**
**Attempt:** Set `ENV PATH="/usr/local/bin:$PATH"` in Dockerfile  
**Result:** ❌ Failed  
**Error:** Still `spawn node ENOENT`  
**Learning:** ENV variables in Dockerfile don't automatically propagate to spawned child processes.

---

### 3. **Pointed to Direct CLI Path**
**Attempt:** Changed `pathToClaudeCodeExecutable` from symlink to direct path: `/usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js`  
**Result:** ❌ Failed  
**Error:** `spawn node ENOENT`  
**Learning:** The CLI has shebang `#!/usr/bin/env node`, which requires finding `node` in PATH. The spawned process still couldn't find node.

---

### 4. **Created Bash Wrapper Script**
**Attempt:** Created `claude-wrapper.sh` with `#!/bin/bash` that calls node with absolute paths  
**Result:** ❌ Failed  
**Error:** `spawn /usr/local/bin/claude-wrapper ENOENT`  
**Learning:** Files in `/usr/local/bin` exist during Docker **build** but disappear at **runtime** in Railway's container environment.

---

### 5. **Changed to `/bin/sh` Shebang**
**Attempt:** Changed wrapper shebang from `#!/bin/bash` to `#!/bin/sh`  
**Result:** ❌ Failed  
**Error:** Still `spawn /usr/local/bin/claude-wrapper ENOENT`  
**Learning:** The issue wasn't the shell type - the file simply didn't exist at runtime.

---

### 6. **Moved Wrapper to `/app` Directory**
**Attempt:** Copied wrapper to `/app/claude-wrapper.sh` instead of `/usr/local/bin`  
**Result:** ❌ Failed  
**Error:** `spawn /app/claude-wrapper.sh ENOENT`  
**Learning:** Even files in `/app` that existed at build time were not found at runtime by the SDK's spawn call.

---

### 7. **Created Node.js Wrapper**
**Attempt:** Created `claude-wrapper.js` with `#!/usr/bin/env node` shebang  
**Result:** ❌ Failed  
**Error:** `spawn node ENOENT` (back to original error)  
**Learning:** The wrapper was found and executed, but when IT tried to spawn node, the same PATH issue occurred.

---

### 8. **Explicitly Set PATH in SDK Options**
**Attempt:** Added `env: { ...process.env, PATH: '/usr/local/bin:/usr/local/sbin:/usr/bin:/usr/sbin:/bin:/sbin' }` to SDK options  
**Result:** ❌ Failed  
**Error:** Still `spawn node ENOENT`  
**Learning:** The SDK receives the env options (confirmed via logging), but the spawned child process still doesn't have node in its PATH.

---

### 9. **Copied Claude Code to `/app`**
**Attempt:** Copied entire `/usr/local/lib/node_modules/@anthropic-ai/claude-code` to `/app/claude-code`  
**Result:** ❌ Failed  
**Error:** `spawn node ENOENT`  
**Learning:** Having the CLI in `/app` doesn't solve the PATH issue for the shebang resolution.

---

### 10. **Created Shell Wrapper in Dockerfile**
**Attempt:** Created `/app/claude` wrapper in Dockerfile with:
```sh
#!/bin/sh
exec /usr/local/bin/node /app/claude-code/cli.js "$@"
```
**Result:** ❌ Failed  
**Error:** `spawn /app/claude ENOENT`  
**Learning:** **CRITICAL DISCOVERY** - Files that exist at Docker build time are **NOT FOUND** at runtime by the SDK's spawn call, even though they're in `/app`.

---

### 11. **Set NODE Environment Variable**
**Attempt:** Added `ENV NODE=/usr/local/bin/node` in Dockerfile and used absolute path in CMD  
**Result:** ❌ Failed  
**Error:** Still `spawn node ENOENT`  
**Learning:** Setting NODE env var doesn't help child processes spawned by the SDK find the node executable.

---

### 12. **Added Debug Logging to Node.js Wrapper**
**Attempt:** Added extensive console.error logging to wrapper to see what's happening  
**Result:** ❌ No wrapper logs appeared  
**Error:** Still `spawn node ENOENT`  
**Learning:** The wrapper never executed, confirming the SDK couldn't find/execute the wrapper file itself.

---

### 13. **Verified Shell Availability**
**Attempt:** Added `RUN which sh && which bash` to verify shells exist in container  
**Result:** ✅ Both shells exist  
**Error:** Still failed with `spawn /app/claude-wrapper.sh ENOENT`  
**Learning:** The issue isn't missing shells - the wrapper file itself isn't found by the SDK's spawn call.

---

### 14. **Pointed to Original npm-installed Claude**
**Attempt:** Reverted to using `/usr/local/bin/claude` (the original npm global install symlink) with our PATH fixes  
**Result:** ❌ Failed  
**Error:** `spawn /usr/local/bin/claude ENOENT`  
**Learning:** Even the npm-installed version that the SDK expects doesn't work - files in `/usr/local/bin` don't persist to runtime.

---

### 15. **Removed `pathToClaudeCodeExecutable` Entirely**
**Attempt:** Based on `receipting/claude-agent-sdk-container` success, removed the `pathToClaudeCodeExecutable` option to let SDK find Claude automatically  
**Result:** ❌ Failed  
**Error:** Still `spawn node ENOENT`  
**Learning:** Not setting the path didn't help - SDK still couldn't find node. The issue was deeper than path configuration.

---

### 16. **Installed Agent SDK Globally**
**Attempt:** Installed `@anthropic-ai/claude-agent-sdk` globally via `npm install -g` like receipting repo does  
**Result:** ❌ Failed  
**Error:** Still `spawn node ENOENT`  
**Learning:** Global installation doesn't help because our code imports from local `node_modules`, not the global install.

---

### 17. **Used `executable: 'node'` with `require.resolve()`**
**Attempt:** Set `executable: 'node'` and used `require.resolve('@anthropic-ai/claude-code/cli.js')` to get absolute path to CLI JS file  
**Result:** 🟡 Partial Progress  
**Error:** Changed from `spawn node ENOENT` to `Claude Code process exited with code 1`  
**Learning:** **BREAKTHROUGH!** The process now spawns successfully! The CLI runs but exits with error code 1. This is a different problem (likely authentication).

---

### 18. **Fixed Invalid `cwd` Issue**
**Attempt:** Created `getSessionsDir()` helper that creates `/data/.claude_sessions` directory before passing as `cwd`  
**Result:** ✅ Fixed the spawn issue!  
**Error:** None for spawning - but CLI still exits with code 1  
**Learning:** **ROOT CAUSE FOUND:** Node's `spawn()` throws misleading `ENOENT` when the `cwd` doesn't exist, even if the executable is valid. Creating the directory first fixed all spawn errors.

---

### 19. **Added `@anthropic-ai/claude-code` to Runtime Dependencies**
**Attempt:** Moved `@anthropic-ai/claude-code` from global install to `package.json` dependencies so it survives `npm prune --production`  
**Result:** ✅ Helped  
**Learning:** Ensures `require.resolve('@anthropic-ai/claude-code/cli.js')` works reliably in production builds.

---

### 20. **Explicitly Passed `ANTHROPIC_API_KEY` to CLI Process**
**Attempt:** Added `ANTHROPIC_API_KEY: config.claude.apiKey` to the `env` object passed to SDK  
**Result:** ❌ Not sufficient  
**Error:** CLI still exits with code 1  
**Learning:** The CLI receives the API key environment variable, but still fails. The CLI might need credential files, not just env vars.

---

### 21. **Added Claude Code Credential Files**
**Attempt:** Created `/root/.claude/.credentials.json` and `/root/.claude.json` files in Dockerfile with placeholder OAuth tokens  
**Result:** ❌ Failed  
**Error:** CLI still exits with code 1 - validates tokens  
**Learning:** Placeholder OAuth tokens don't work - the CLI actually validates them against Anthropic's servers.

---

### 22. **Discovered `apiKeyHelper` Configuration**
**Attempt:** Found official `apiKeyHelper` setting in Claude Code docs that allows custom script for API key auth. Created `/usr/local/bin/api-key-helper.sh` to echo `$ANTHROPIC_API_KEY`  
**Result:** ❌ Not sufficient alone  
**Error:** CLI still exits with code 1  
**Learning:** The `apiKeyHelper` approach is correct but needs to be combined with other settings. This is the official way for non-interactive server deployment.

---

### 23. **Forced API Key Auth + Added stderr/stdout Capture**
**Attempt:** 
- Created `ensureClaudeUserSettings()` to write `forceLoginMethod: "console"` to `~/.claude/settings.json` 
- Added `stderr` and `stdout` callbacks to SDK options to see CLI output
- Pinned CLI to version 1.0.67 (to avoid auth regressions)
**Result:** 🟡 **MAJOR BREAKTHROUGH** - stderr capture worked!  
**Error:** `error: unknown option '--setting-sources'`  
**Learning:** **CRITICAL:** The stderr capture revealed the actual error! CLI version 1.0.67 doesn't support the `--setting-sources` flag that the SDK was passing. This was invisible before we added output capture.

---

### 24. **Removed `settingSources` Option**
**Attempt:** Removed `settingSources: []` from SDK options since it causes incompatible flag  
**Result:** ❌ Didn't help  
**Error:** SDK still passes `--setting-sources` flag automatically  
**Learning:** The SDK itself adds the flag even when not in options - it's a version incompatibility issue.

---

### 25. **Upgraded CLI to Match SDK Version**
**Attempt:** Upgraded `@anthropic-ai/claude-code` from 1.0.67 to 1.0.117 (latest) to match SDK requirements  
**Result:** 🟡 **BREAKTHROUGH** - Different error!  
**Error:** `--dangerously-skip-permissions cannot be used with root/sudo privileges for security reasons`  
**Learning:** The newer CLI accepts `--setting-sources` flag! But won't run `bypassPermissions` mode as root. This is progress - we're past the option error.

---

### 26. **Run as Non-Root User**
**Attempt:** 
- Created `appuser` (UID 1001) in Dockerfile
- Changed `HOME` to `/home/appuser`
- Switched to `USER appuser` before starting app
**Result:** ✅ **HUGE PROGRESS** - CLI spawns successfully!  
**Error:** `SqliteError: attempt to write a readonly database`  
**Learning:** **MAJOR WIN:** The CLI process now spawns and runs! We're completely past all spawn/authentication issues. The only problem is Railway's volume is root-owned and appuser can't write to it.

---

### 27. **Docker Entrypoint for Volume Permissions**
**Attempt:** 
- Created `docker-entrypoint.sh` that runs as root
- Script fixes `/data` permissions with `chown -R appuser:appuser /data`
- Uses `gosu` to switch to appuser before running Node
**Result:** ❌ Failed - entrypoint never ran  
**Error:** Still getting `--dangerously-skip-permissions cannot be used with root/sudo privileges`  
**Learning:** Railway was completely bypassing our Docker ENTRYPOINT! No debug messages appeared, meaning the entrypoint script wasn't executing at all.

---

### 28. **Removed Railway `startCommand` Override** ✅ **SUCCESS!**
**Attempt:** Discovered `startCommand = "npm start"` in `railway.toml` was overriding our Dockerfile's ENTRYPOINT. Commented it out to let Railway use the Docker ENTRYPOINT.  
**Result:** ✅ **IT WORKS!!!** 🎉  
**Error:** None!  
**Learning:** **FINAL BREAKTHROUGH:** Railway's `startCommand` in railway.toml completely bypasses Docker ENTRYPOINT/CMD. Once removed, the entrypoint ran successfully:
- Started as root
- Fixed `/data` permissions (`chown -R appuser:appuser /data`)
- Switched to appuser with `gosu`
- CLI ran successfully without permission errors
- Query completed with session ID and cost tracking
- Bot responded in Slack!

**Final logs showing success:**
```
[Entrypoint] Running as:
uid=0(root) gid=0(root) groups=0(root)
[Entrypoint] Fixing /data permissions...
[Entrypoint] Switching to appuser...
[queryClaudeAgent] Query completed
[queryClaudeAgent] Session: 180d2562-a0fb-40ea-9328-92151e63497d
[queryClaudeAgent] Cost: $0.03117525
[handleMessage] Successfully processed message
```

---

## Key Findings

### ✅ What We Confirmed Works:
1. **Build-time verification:** All files exist and are executable during Docker build
2. **Application startup:** The Slack bot starts successfully, health checks pass
3. **PATH visibility:** The main process has correct PATH (confirmed via logging)
4. **SDK configuration:** Options are passed correctly to the SDK (confirmed via logging)
5. **Process spawning:** Using `executable: 'node'` with direct CLI path successfully spawns the process (attempts 17-19)
6. **Working directory:** Creating `cwd` directory before spawn eliminates ENOENT errors (attempt 18)

### ❌ What Previously Failed (Now Resolved):
1. ~~**Runtime file access:** Files that exist at build time get `ENOENT` when SDK tries to spawn them~~ **FIXED** by using `executable: 'node'`
2. ~~**PATH inheritance:** Spawned child processes cannot find `node` even with explicit PATH in env~~ **FIXED** by using `executable: 'node'` instead of shebang
3. ~~**Shebang resolution:** `#!/usr/bin/env node` cannot find node in spawned processes~~ **FIXED** by bypassing shebang entirely
4. ~~**Invalid cwd causing ENOENT:** Passing non-existent directory as `cwd`~~ **FIXED** by creating directory first

### ✅ All Issues Resolved!
**Status: WORKING!** The Claude Agent Bot successfully responds to messages in Slack. All spawn, authentication, permission, and database issues have been solved.

### 🔍 Root Cause Analysis (Multiple Issues - All Resolved):

**Issue 1 - ENOENT Mystery (Resolved in #18):**
- **Symptom:** Files verified to exist were returning `ENOENT` at spawn time
- **Actual cause:** Node's `spawn()` throws `ENOENT` when given a non-existent `cwd`, even if the executable exists
- **Solution:** Create the `cwd` directory before calling `spawn()`

**Issue 2 - Version Incompatibility (Resolved in #23-25):**
- **Symptom:** CLI exits with code 1, no error output visible
- **Discovery:** Added stderr capture, revealed `error: unknown option '--setting-sources'`
- **Actual cause:** SDK v0.1.30 requires CLI v1.0.117+, but we pinned to 1.0.67
- **Solution:** Upgraded CLI to 1.0.117 to match SDK requirements

**Issue 3 - Root User Restrictions (Resolved in #26):**
- **Symptom:** `--dangerously-skip-permissions cannot be used with root/sudo privileges`
- **Actual cause:** CLI security feature prevents bypassing permissions as root
- **Solution:** Run as non-root user (appuser UID 1001)

**Issue 4 - Authentication Method (Resolved in #22-23):**
- **Symptom:** CLI couldn't authenticate in non-interactive container
- **Actual cause:** CLI defaulted to OAuth flow which requires browser
- **Solution:** `forceLoginMethod: "console"` + `apiKeyHelper` script for API key auth

---

## Evidence Log

### Build-time Verification (Successful)
```
[22/22] RUN cat /app/claude
#!/bin/sh
exec /usr/local/bin/node /app/claude-code/cli.js "$@"

-rwxr-xr-x 1 root root 64 Oct 31 20:08 /app/claude
```

### Runtime Verification (Successful)
```
🔍 PATH: /app/node_modules/.bin:/node_modules/.bin:/usr/local/lib/node_modules/npm/node_modules/@npmcli/run-script/lib/node-gyp-bin:/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
🔍 NODE: /usr/local/bin/node
```

### SDK Configuration (Confirmed Received)
```json
{
  "pathToClaudeCodeExecutable": "/app/claude",
  "cwd": "/data/.claude_sessions",
  "env": {
    "PATH": "/usr/local/bin:/usr/local/sbin:/usr/bin:/usr/sbin:/bin:/sbin"
  }
}
```

### Runtime Error (Consistent)
```
Error: Failed to spawn Claude Code process: spawn /app/claude ENOENT
    at ChildProcess.<anonymous> (file:///app/node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs:6540:28)
```

---

## Current Status
**Blocked:** Unable to get the Claude Agent SDK to successfully spawn the Claude CLI in Railway's Docker environment, despite the CLI and all dependencies being present and verified during the build process.

## Next Steps to Consider
1. Test locally with Docker to see if the issue is Railway-specific
2. Investigate Railway's container runtime vs build environment differences
3. Contact Anthropic support about SDK spawn behavior in containerized environments
4. Consider alternative deployment approaches (Nixpacks, different hosting platform)
5. Explore if there's a way to bypass the SDK's spawn mechanism entirely
