import { WebClient } from '@slack/web-api';

/**
 * Handles progressive updates to a Slack message as content streams in
 */
export class StreamingUpdater {
  private lastUpdateTime = 0;
  private updateIntervalMs: number;
  private accumulated = '';
  private updateCount = 0;
  private SLACK_MAX_LENGTH = 3900; // Leave buffer for indicator
  private hasOverflowed = false;

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
   * If message is too long, post continuation as thread replies
   */
  async finalize(): Promise<void> {
    await this.update(false); // Without indicator
    
    // If we had overflow, post the remaining content as thread replies
    if (this.accumulated.length > this.SLACK_MAX_LENGTH) {
      await this.postOverflowMessages();
    }
  }

  /**
   * Post continuation messages for content that exceeded Slack's limit
   */
  private async postOverflowMessages(): Promise<void> {
    const remaining = this.accumulated.substring(this.SLACK_MAX_LENGTH);
    const chunks: string[] = [];
    
    // Split remaining into chunks
    for (let i = 0; i < remaining.length; i += this.SLACK_MAX_LENGTH) {
      chunks.push(remaining.substring(i, i + this.SLACK_MAX_LENGTH));
    }
    
    // Post each chunk as a threaded reply
    for (let i = 0; i < chunks.length; i++) {
      try {
        await this.client.chat.postMessage({
          channel: this.channelId,
          thread_ts: this.messageTs,
          text: `_[Continued ${i + 1}/${chunks.length}]_\n\n${chunks[i]}`,
        });
      } catch (error) {
        console.error(`[StreamingUpdater] Failed to post continuation ${i + 1}:`, error);
      }
    }
    
    console.log(`[StreamingUpdater] Posted ${chunks.length} continuation message(s)`);
  }

  /**
   * Update the Slack message
   */
  private async update(showIndicator: boolean): Promise<void> {
    let text = this.accumulated;

    // Truncate if too long for Slack
    if (text.length > this.SLACK_MAX_LENGTH) {
      text = text.substring(0, this.SLACK_MAX_LENGTH) + '\n\n_[Continued in thread...]_';
      this.hasOverflowed = true;
      if (showIndicator) {
        text += '\n\n🔄 _Still thinking..._';
      }
    } else if (showIndicator) {
      text += '\n\n🔄 _Still thinking..._';
    }

    try {
      await this.client.chat.update({
        channel: this.channelId,
        ts: this.messageTs,
        text: text,
      });
    } catch (error: any) {
      // If it's still too long, try posting as a follow-up thread message
      if (error.data?.error === 'msg_too_long') {
        console.error('[StreamingUpdater] Message too long, will post full response as file');
        // Note: We could implement file upload here, but for now just log it
      } else {
        console.error('[StreamingUpdater] Failed to update message:', error);
      }
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
