import { config, validateConfig } from './config.js';
import { initializeSlackApp } from './slack/slackApp.js';
import { initializeSessionManager } from './agent/sessionManager.js';
import { ensureClaudeUserSettings } from './utils/claudeSettings.js';

async function main() {
  try {
    // Configure Claude Code CLI for API key authentication
    ensureClaudeUserSettings();
    
    // Validate configuration
    console.log('Validating configuration...');
    validateConfig();

    // Initialize session manager
    console.log('Initializing session manager...');
    await initializeSessionManager();

    // Initialize Slack app
    console.log('Initializing Slack app...');
    const slackApp = await initializeSlackApp();

    // Start Slack app (webhook mode)
    await slackApp.start(config.app.port);

    console.log(`⚡️ Slack bot is running on port ${config.app.port}`);
    console.log(`📊 Health check available at http://localhost:${config.app.port}/health`);
    console.log(`🔍 PATH: ${process.env.PATH}`);
    console.log(`🔍 NODE: ${process.env.NODE}`);
    console.log(`🤖 Claude Agent SDK ready`);
    console.log(`💾 Session data directory: ${config.session.dataDir}`);

  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
let isShuttingDown = false;

async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log(`\n${signal} received - starting graceful shutdown...`);
  
  try {
    // Give ongoing operations time to complete
    const timeout = setTimeout(() => {
      console.log('Shutdown timeout reached, forcing exit');
      process.exit(1);
    }, config.app.shutdownTimeoutSeconds * 1000);
    
    // Clean up resources here if needed
    // e.g., close database connections, finish in-flight requests
    
    clearTimeout(timeout);
    console.log('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
main();
