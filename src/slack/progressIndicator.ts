import { WebClient } from '@slack/web-api';

/**
 * Shows honest progress indicators based on elapsed time
 */
export class ProgressIndicator {
  private intervalId?: NodeJS.Timeout;
  private startTime: number;
  private updateCount = 0;

  constructor(
    private client: WebClient,
    private channelId: string,
    private messageTs: string
  ) {
    this.startTime = Date.now();
  }

  /**
   * Start showing progress indicators every 5 seconds
   */
  start(): void {
    // Update immediately
    this.updateProgress();

    // Then update every 5 seconds
    this.intervalId = setInterval(() => {
      this.updateProgress();
    }, 5000);
  }

  /**
   * Stop the progress indicator
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  /**
   * Update the progress message based on elapsed time
   */
  private async updateProgress(): Promise<void> {
    const elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    let message: string;

    if (elapsedSeconds < 10) {
      message = '⏳ _Processing your request..._';
    } else if (elapsedSeconds < 30) {
      message = '🤔 _Still working on your request..._';
    } else if (elapsedSeconds < 60) {
      message = '⚠️ _This is taking longer than usual..._';
    } else if (elapsedSeconds < 90) {
      message = '⏰ _Almost there... (complex queries can take up to 2 minutes)_';
    } else {
      message = '🔄 _Still processing... Please wait a bit longer._';
    }

    try {
      await this.client.chat.update({
        channel: this.channelId,
        ts: this.messageTs,
        text: message,
      });
      this.updateCount++;
      console.log(`[ProgressIndicator] Update #${this.updateCount} at ${elapsedSeconds}s`);
    } catch (error) {
      console.error('[ProgressIndicator] Failed to update:', error);
    }
  }

  /**
   * Get elapsed time in seconds
   */
  getElapsedSeconds(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }
}
