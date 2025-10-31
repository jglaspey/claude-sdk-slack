import { config, validateConfig } from './config.js';
import { initializeSlackApp } from './slack/slackApp.js';
import { initializeSessionManager } from './agent/sessionManager.js';

async function main() {
  try {
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
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start the application
main();
// Force rebuild
