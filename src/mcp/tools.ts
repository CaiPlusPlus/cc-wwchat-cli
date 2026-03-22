import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OpenClawClient } from '../openclaw/client.js';
import { WeixinApiClient } from '../weixin/api.js';
import { logger } from '../utils/logger.js';
import type { WeChatConfig } from '../utils/config.js';

export function registerTools(
  server: McpServer,
  openclawClient: OpenClawClient,
  config: WeChatConfig
): void {
  // Weixin API client (lazy loaded)
  let weixinClient: WeixinApiClient | null = null;

  async function getWeixinClient(): Promise<WeixinApiClient> {
    if (!weixinClient) {
      weixinClient = await WeixinApiClient.fromOpenClawConfig();
    }
    return weixinClient;
  }

  // Configure connection
  server.tool(
    'wechat_configure',
    'Configure and verify WeChat connection with OpenClaw',
    {},
    async () => {
      try {
        const isAvailable = await openclawClient.isAvailable();
        if (!isAvailable) {
          return {
            content: [{
              type: 'text' as const,
              text: '❌ OpenClaw is not installed. Please install it first:\n\n```bash\nnpm install -g openclaw\n```',
            }],
          };
        }

        const isGatewayRunning = await openclawClient.isGatewayRunning();
        if (!isGatewayRunning) {
          return {
            content: [{
              type: 'text' as const,
              text: '❌ OpenClaw gateway is not running. Please start it:\n\n```bash\nopenclaw gateway start\n```',
            }],
          };
        }

        const isWeChatConfigured = await openclawClient.isWeChatConfigured();
        if (!isWeChatConfigured) {
          return {
            content: [{
              type: 'text' as const,
              text: '❌ WeChat channel is not configured. Please install it:\n\n```bash\nnpx -y @tencent-weixin/openclaw-weixin-cli install\n```',
            }],
          };
        }

        // Try to load WeChat API client
        let accountInfo = '';
        try {
          const client = await getWeixinClient();
          const info = client.getAccountInfo();
          accountInfo = `\n\n**WeChat Account**: ${info.accountId}`;
        } catch (e) {
          accountInfo = `\n\n⚠️ Direct API access unavailable: ${e instanceof Error ? e.message : 'Unknown error'}`;
        }

        const status = await openclawClient.getStatus();

        return {
          content: [{
            type: 'text' as const,
            text: `✅ OpenClaw + WeChat connection verified!${accountInfo}\n\n\`\`\`\n${status}\n\`\`\``,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `❌ Configuration check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
        };
      }
    }
  );

  // Login to WeChat
  server.tool(
    'wechat_login',
    'Initiate WeChat login with QR code (requires terminal access)',
    {},
    async () => {
      try {
        const isAvailable = await openclawClient.isAvailable();
        if (!isAvailable) {
          return {
            content: [{
              type: 'text' as const,
              text: '❌ OpenClaw is not installed.',
            }],
          };
        }

        const result = await openclawClient.login();

        if (result.success) {
          return {
            content: [{
              type: 'text' as const,
              text: `📱 WeChat login initiated.\n\nPlease scan the QR code in the terminal where OpenClaw is running.\n\nAfter successful login, restart the gateway:\n\`\`\`bash\nopenclaw gateway restart\n\`\`\``,
            }],
          };
        }

        return {
          content: [{
            type: 'text' as const,
            text: `❌ Login failed: ${result.error}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `❌ Login error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
        };
      }
    }
  );

  // Send message (direct API - no AI processing)
  server.tool(
    'wechat_send_direct',
    'Send a message directly via WeChat iLink API (bypasses AI agent)',
    {
      to: z.string().describe('Recipient user ID (e.g., from_user_id from received message, filehelper for file transfer)'),
      message: z.string().describe('Message content to send'),
      context_token: z.string().optional().describe('Context token from received message (for replies)'),
    },
    async ({ to, message, context_token }) => {
      try {
        const client = await getWeixinClient();
        const success = await client.sendTextMessage(to, message, context_token);

        if (success) {
          return {
            content: [{
              type: 'text' as const,
              text: `✅ Message sent directly to ${to}!`,
            }],
          };
        }

        return {
          content: [{
            type: 'text' as const,
            text: `❌ Failed to send message`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `❌ Send error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
        };
      }
    }
  );

  // Receive messages (direct API)
  server.tool(
    'wechat_receive',
    'Poll for new WeChat messages directly via iLink API',
    {
      timeout: z.number().optional().default(5).describe('Poll timeout in seconds'),
    },
    async ({ timeout }) => {
      try {
        const client = await getWeixinClient();
        const response = await client.getUpdates(timeout * 1000);

        if (!response.msgs || response.msgs.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: '📭 No new messages.',
            }],
          };
        }

        const formattedMessages = response.msgs.map(msg => {
          const from = msg.from_user_id || 'unknown';
          const time = msg.create_time_ms ? new Date(msg.create_time_ms).toLocaleString() : 'unknown time';
          let content = '';

          if (msg.item_list) {
            for (const item of msg.item_list) {
              if (item.text_item?.text) {
                content = item.text_item.text;
              } else if (item.image_item) {
                content = '[图片/Image]';
              } else if (item.voice_item) {
                content = `[语音/Voice ${item.voice_item.playtime || 0}s]`;
              } else if (item.file_item) {
                content = `[文件/File: ${item.file_item.file_name || 'unknown'}]`;
              } else if (item.video_item) {
                content = '[视频/Video]';
              }
            }
          }

          const contextInfo = msg.context_token ? `\n   Context: ${msg.context_token.slice(0, 20)}...` : '';
          return `📨 **${from}**\n   ${content}\n   _${time}_${contextInfo}`;
        }).join('\n\n');

        return {
          content: [{
            type: 'text' as const,
            text: `📬 ${response.msgs.length} new message(s):\n\n${formattedMessages}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `❌ Receive error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
        };
      }
    }
  );

  // Send message via AI agent
  server.tool(
    'wechat_send_agent',
    'Send a message through OpenClaw AI agent (message will be processed by AI)',
    {
      to: z.string().describe('Recipient ID'),
      message: z.string().describe('Message content'),
    },
    async ({ to, message }) => {
      try {
        const result = await openclawClient.sendMessage(to, message, true);

        if (result.success) {
          return {
            content: [{
              type: 'text' as const,
              text: `✅ Message sent via AI agent to ${to}!\n\nResponse:\n${result.content?.slice(0, 500) || 'No response'}`,
            }],
          };
        }

        return {
          content: [{
            type: 'text' as const,
            text: `❌ Failed to send message: ${result.error}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `❌ Send error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
        };
      }
    }
  );

  // Get status
  server.tool(
    'wechat_status',
    'Get current WeChat channel and gateway status',
    {},
    async () => {
      try {
        const status = await openclawClient.getStatus();
        const channelStatus = await openclawClient.getChannelStatus();

        // Also show account info
        let accountInfo = '';
        try {
          const accounts = WeixinApiClient.listAccounts();
          accountInfo = `\n\n**Direct API Accounts**: ${accounts.length > 0 ? accounts.join(', ') : 'None'}`;
        } catch {
          accountInfo = '\n\n**Direct API Accounts**: Unable to load';
        }

        return {
          content: [{
            type: 'text' as const,
            text: `📊 **OpenClaw Status**\n\n${status}\n\n**Channel Status:**\n${channelStatus}${accountInfo}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `❌ Status error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
        };
      }
    }
  );

  // List accounts
  server.tool(
    'wechat_accounts',
    'List available WeChat accounts',
    {},
    async () => {
      try {
        const accounts = WeixinApiClient.listAccounts();

        if (accounts.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: '📋 No WeChat accounts found.\n\nPlease login first:\n```bash\nopenclaw channels login --channel openclaw-weixin\n```',
            }],
          };
        }

        return {
          content: [{
            type: 'text' as const,
            text: `📋 **WeChat Accounts** (${accounts.length}):\n\n${accounts.map(a => `- ${a}`).join('\n')}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `❌ List accounts error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
        };
      }
    }
  );

  // Restart gateway
  server.tool(
    'wechat_restart',
    'Restart the OpenClaw gateway',
    {},
    async () => {
      try {
        const result = await openclawClient.restartGateway();

        if (result.success) {
          // Clear cached client after restart
          weixinClient = null;
          return {
            content: [{
              type: 'text' as const,
              text: `✅ Gateway restarted successfully!`,
            }],
          };
        }

        return {
          content: [{
            type: 'text' as const,
            text: `❌ Failed to restart gateway: ${result.error}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `❌ Restart error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
        };
      }
    }
  );

  // Help / guide
  server.tool(
    'wechat_help',
    'Show usage guide for WeChat integration',
    {},
    async () => {
      return {
        content: [{
          type: 'text' as const,
          text: `📖 **cc-wechat-cli 使用指南**

## 两种消息发送模式

### 1. 直接 API 模式 (推荐)
- \`wechat_send_direct\` - 直接通过 iLink API 发送
- \`wechat_receive\` - 直接接收消息
- 不经过 AI 处理，速度更快
- 需要提供 context_token 来回复消息

### 2. AI Agent 模式
- \`wechat_send_agent\` - 通过 OpenClaw AI Agent 发送
- 消息会被 AI 处理后回复
- 适合智能对话场景

## 前置条件

1. **安装 OpenClaw**
   \`\`\`bash
   npm install -g openclaw
   \`\`\`

2. **安装微信插件**
   \`\`\`bash
   npx -y @tencent-weixin/openclaw-weixin-cli install
   \`\`\`

3. **登录微信**
   \`\`\`bash
   openclaw channels login --channel openclaw-weixin
   \`\`\`
   扫描终端中的二维码登录

4. **启动网关**
   \`\`\`bash
   openclaw gateway start
   \`\`\`

## 可用工具

| 工具 | 功能 | 模式 |
|------|------|------|
| wechat_configure | 验证连接状态 | - |
| wechat_login | 发起微信登录 | - |
| wechat_send_direct | 直接发送消息 | 直接 API |
| wechat_receive | 接收消息 | 直接 API |
| wechat_send_agent | AI 发送消息 | AI Agent |
| wechat_status | 查看状态 | - |
| wechat_accounts | 列出账号 | - |
| wechat_restart | 重启网关 | - |

## 使用流程

1. \`wechat_receive\` 接收消息
2. 从消息中获取 \`from_user_id\` 和 \`context_token\`
3. \`wechat_send_direct\` 发送回复

## 故障排除

1. **网关未运行**: \`openclaw gateway start\`
2. **微信未登录**: \`openclaw channels login --channel openclaw-weixin\`
3. **查看日志**: \`openclaw logs\`
`,
        }],
      };
    }
  );

  logger.info('MCP tools registered');
}
