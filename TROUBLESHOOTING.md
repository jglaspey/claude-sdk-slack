# Claude Agent SDK Docker Deployment Troubleshooting

## Objective
Deploy a Slack bot using the Claude Agent SDK in a Docker container on Railway, resolving `spawn ENOENT` errors.

---

## 📊 Progress Summary

**Status:** 🟡 **Significant Progress - Authentication Issue Remaining**

**Major Breakthroughs:**
- ✅ **Solved spawn ENOENT errors** (attempts 17-18)
- ✅ **Process spawns successfully** 
- ✅ **Working directory issue resolved**
- 🔄 **Current blocker:** Claude Code CLI authentication (exit code 1)

**Key Insights:**
1. The `spawn ENOENT` error was caused by an invalid `cwd`, not missing executables
2. Using `executable: 'node'` with `require.resolve()` bypasses shebang issues
3. The Claude Code CLI requires OAuth credential files, not just API key env vars

**Attempts:** 21 different approaches tried and documented below

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
**Attempt:** Created `/root/.claude/.credentials.json` and `/root/.claude.json` files in Dockerfile (mimicking receipting repo's entrypoint script)  
**Result:** 🔄 In Progress  
**Error:** TBD  
**Learning:** The Claude Code CLI expects OAuth credential files in the home directory, not just environment variables. Testing now.

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

### 🔄 Current Issue:
**Claude Code CLI authentication:** The CLI process spawns successfully but exits with code 1, indicating authentication failure. Working on setting up proper OAuth credentials.

### 🔍 Root Cause Analysis (Resolved):
**The original ENOENT mystery:** Files verified to exist were returning `ENOENT` at spawn time.

**Actual cause (discovered in attempt #18):** Node's `spawn()` throws `ENOENT` when given a non-existent `cwd`, even if the executable exists. The error message is misleading - it looked like the executable wasn't found, but the real problem was the working directory.

**Solution:** Create the `cwd` directory before calling `spawn()`, and use `executable: 'node'` with the direct path to the CLI JS file instead of relying on shebangs.

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
