import { WebClient } from '@slack/web-api';

/**
 * Handles progressive updates to a Slack message as content streams in
 */
export class StreamingUpdater {
  private lastUpdateTime = 0;
  private updateIntervalMs: number;
  private accumulated = '';
  private updateCount = 0;

  constructor(
    private client: WebClient,
    private channelId: string,
    private messageTs: string,
    updateIntervalMs = 3000 // Update every 3 seconds by default
  ) {
    this.updateIntervalMs = updateIntervalMs;
  }

  /**
   * Add content to the accumulated message and update Slack if enough time has passed
   */
  async addContent(content: string): Promise<void> {
    this.accumulated += content;

    const now = Date.now();
    if (now - this.lastUpdateTime >= this.updateIntervalMs) {
      await this.update(true); // With "still thinking" indicator
      this.lastUpdateTime = now;
      this.updateCount++;
    }
  }

  /**
   * Finalize the message (remove "thinking" indicator)
   */
  async finalize(): Promise<void> {
    await this.update(false); // Without indicator
  }

  /**
   * Update the Slack message
   */
  private async update(showIndicator: boolean): Promise<void> {
    const text = showIndicator
      ? this.accumulated + '\n\n🔄 _Still thinking..._'
      : this.accumulated;

    try {
      await this.client.chat.update({
        channel: this.channelId,
        ts: this.messageTs,
        text: text,
      });
    } catch (error) {
      console.error('[StreamingUpdater] Failed to update message:', error);
      // Don't throw - we don't want to break the stream over update failures
    }
  }

  /**
   * Get the accumulated content so far
   */
  getAccumulated(): string {
    return this.accumulated;
  }

  /**
   * Get statistics about the streaming session
   */
  getStats() {
    return {
      updateCount: this.updateCount,
      contentLength: this.accumulated.length,
    };
  }
}
