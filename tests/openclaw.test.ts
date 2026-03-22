import { describe, test, expect, mock } from 'bun:test';
import { OpenClawClient } from '../src/openclaw/client.js';

describe('OpenClawClient', () => {
  test('should create client with default config', () => {
    const client = new OpenClawClient();
    expect(client).toBeDefined();
  });

  test('should create client with custom config', () => {
    const client = new OpenClawClient('192.168.1.1', 8080);
    expect(client).toBeDefined();
  });
});

describe('Message utilities', () => {
  test('should create message cache', async () => {
    const { createMessageCache } = await import('../src/wechat/message.js');
    const cache = createMessageCache(50);
    expect(cache.messages).toEqual([]);
    expect(cache.maxSize).toBe(50);
    expect(cache.lastTimestamp).toBe(0);
  });

  test('should add message to cache', async () => {
    const { createMessageCache, addMessage } = await import('../src/wechat/message.js');
    const cache = createMessageCache(50);
    addMessage(cache, {
      id: 'test-1',
      from: 'user1',
      to: 'bot',
      type: 'text',
      content: 'Hello',
      timestamp: Date.now(),
    });
    expect(cache.messages.length).toBe(1);
  });

  test('should respect max cache size', async () => {
    const { createMessageCache, addMessage } = await import('../src/wechat/message.js');
    const cache = createMessageCache(3);

    for (let i = 0; i < 5; i++) {
      addMessage(cache, {
        id: `test-${i}`,
        from: `user${i}`,
        to: 'bot',
        type: 'text',
        content: `Message ${i}`,
        timestamp: Date.now() + i,
      });
    }

    expect(cache.messages.length).toBe(3);
    expect(cache.messages[0].id).toBe('test-2');
  });

  test('should get new messages since timestamp', async () => {
    const { createMessageCache, addMessage, getNewMessages } = await import('../src/wechat/message.js');
    const cache = createMessageCache(50);
    const baseTime = Date.now();

    addMessage(cache, {
      id: 'test-1',
      from: 'user1',
      to: 'bot',
      type: 'text',
      content: 'Old message',
      timestamp: baseTime - 1000,
    });

    addMessage(cache, {
      id: 'test-2',
      from: 'user2',
      to: 'bot',
      type: 'text',
      content: 'New message',
      timestamp: baseTime + 1000,
    });

    const newMessages = getNewMessages(cache, baseTime);
    expect(newMessages.length).toBe(1);
    expect(newMessages[0].id).toBe('test-2');
  });
});

describe('Contact utilities', () => {
  test('should convert OpenClaw contact', async () => {
    const { fromOpenClawContact } = await import('../src/wechat/contact.js');
    const contact = fromOpenClawContact({
      id: 'wx123',
      name: 'Test User',
      type: 'user',
    });
    expect(contact.id).toBe('wx123');
    expect(contact.name).toBe('Test User');
    expect(contact.type).toBe('user');
  });

  test('should convert OpenClaw group', async () => {
    const { fromOpenClawGroup } = await import('../src/wechat/contact.js');
    const group = fromOpenClawGroup({
      id: 'group123',
      name: 'Test Group',
      memberCount: 10,
    });
    expect(group.id).toBe('group123');
    expect(group.name).toBe('Test Group');
    expect(group.memberCount).toBe(10);
  });
});

describe('Config loader', () => {
  test('should load default config', async () => {
    const { loadConfig } = await import('../src/utils/config.js');
    const config = loadConfig();
    expect(config.openclawHost).toBe('localhost');
    expect(config.openclawPort).toBe(3100);
  });
});
