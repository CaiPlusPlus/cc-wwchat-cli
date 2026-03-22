import { z } from 'zod';

const ConfigSchema = z.object({
  openclawHost: z.string().default('localhost'),
  openclawPort: z.number().default(3100),
  autoReconnect: z.boolean().default(true),
  messageCacheSize: z.number().default(100),
});

export type WeChatConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(): WeChatConfig {
  return ConfigSchema.parse({
    openclawHost: process.env.OPENCLAW_HOST || 'localhost',
    openclawPort: parseInt(process.env.OPENCLAW_PORT || '3100', 10),
    autoReconnect: process.env.WECHAT_AUTO_RECONNECT !== 'false',
    messageCacheSize: parseInt(process.env.WECHAT_CACHE_SIZE || '100', 10),
  });
}
