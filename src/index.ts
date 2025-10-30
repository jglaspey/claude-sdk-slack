// ABOUTME: Main entry point for the Claude Slack Agent backend
// ABOUTME: Initializes Express server, Slack Bolt app, and handles webhook routing

import express from 'express';
import { config } from 'dotenv';
import { slackApp } from './slack/slackApp.js';
import { PORT } from './config.js';

// Load environment variables
config();

const app = express();

// Health check endpoint for Railway
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Slack events endpoint - Bolt handles this at /slack/events internally
// @ts-ignore - receiver.app is accessible but TypeScript doesn't recognize it
app.use(slackApp.receiver.app);

// Start server
app.listen(PORT, () => {
  console.log(`⚡️ Claude Slack Agent is running on port ${PORT}`);
  console.log(`🔗 Webhook URL: https://<your-railway-domain>/slack/events`);
});
