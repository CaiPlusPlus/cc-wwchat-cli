import type { OpenClawMessage } from '../openclaw/types.js';

export interface WeChatMessage {
  id: string;
  from: string;
  to: string;
  type: 'text' | 'image' | 'file' | 'video' | 'link' | 'audio';
  content: string;
  timestamp: number;
  groupId?: string;
  senderName?: string;
}

export interface MessageCache {
  messages: WeChatMessage[];
  maxSize: number;
  lastTimestamp: number;
}

export function createMessageCache(maxSize: number = 100): MessageCache {
  return {
    messages: [],
    maxSize,
    lastTimestamp: 0,
  };
}

export function addMessage(cache: MessageCache, message: WeChatMessage): void {
  cache.messages.push(message);
  cache.lastTimestamp = message.timestamp;

  // Keep cache size limited
  if (cache.messages.length > cache.maxSize) {
    cache.messages = cache.messages.slice(-cache.maxSize);
  }
}

export function getNewMessages(cache: MessageCache, since: number): WeChatMessage[] {
  return cache.messages.filter(m => m.timestamp > since);
}

export function clearCache(cache: MessageCache): void {
  cache.messages = [];
  cache.lastTimestamp = 0;
}

export function fromOpenClawMessage(msg: OpenClawMessage): WeChatMessage {
  return {
    id: msg.id,
    from: msg.senderId,
    to: msg.channelId,
    type: msg.contentType,
    content: msg.content,
    timestamp: msg.timestamp,
    senderName: msg.senderName,
    groupId: msg.metadata?.groupId as string | undefined,
  };
}
