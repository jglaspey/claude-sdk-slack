import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Ensure Claude Code CLI settings are configured for API key authentication
 * This forces the CLI to use ANTHROPIC_API_KEY instead of trying OAuth login
 */
export function ensureClaudeUserSettings(): void {
  const userDir = path.join(os.homedir(), '.claude');
  const settingsPath = path.join(userDir, 'settings.json');
  
  // Create directory if it doesn't exist
  fs.mkdirSync(userDir, { recursive: true });
  
  // Load existing settings or start fresh
  let settings: any = {};
  try {
    const existing = fs.readFileSync(settingsPath, 'utf8');
    settings = JSON.parse(existing);
  } catch {
    // File doesn't exist or is invalid, start fresh
  }
  
  // Force console (API key) auth mode - prevents OAuth prompts in containers
  settings.forceLoginMethod = 'console';
  settings.hasCompletedOnboarding = true;
  settings.subscriptionNoticeCount = 0;
  settings.hasAvailableSubscription = true;
  
  // Write settings
  const settingsJson = JSON.stringify(settings, null, 2);
  fs.writeFileSync(settingsPath, settingsJson);
  console.log('[Claude Settings] Configured for API key authentication');
  console.log(`[Claude Settings] Settings file: ${settingsPath}`);
  console.log(`[Claude Settings] Content: ${settingsJson}`);
}
