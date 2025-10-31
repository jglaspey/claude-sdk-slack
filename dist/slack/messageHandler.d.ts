import { WebClient } from '@slack/web-api';
export interface MessageContext {
    text: string;
    userId: string;
    channelId: string;
    threadTs: string;
    ts: string;
    teamId: string;
    client: WebClient;
}
/**
 * Handle incoming Slack message and query Claude Agent SDK
 */
export declare function handleMessage(context: MessageContext): Promise<void>;
//# sourceMappingURL=messageHandler.d.ts.map