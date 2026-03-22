import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OpenClawClient } from '../openclaw/client.js';
import { logger } from '../utils/logger.js';
import type { WeChatConfig } from '../utils/config.js';

export function registerTools(
  server: McpServer,
  client: OpenClawClient,
  config: WeChatConfig
): void {
  // Configure connection
  server.tool(
    'wechat_configure',
    'Configure and verify WeChat connection with OpenClaw',
    {},
    async () => {
      try {
        const isAvailable = await client.isAvailable();
        if (!isAvailable) {
          return {
            content: [{
              type: 'text' as const,
              text: '❌ OpenClaw is not installed. Please install it first:\n\n```bash\nnpm install -g openclaw\n```',
            }],
          };
        }

        const isGatewayRunning = await client.isGatewayRunning();
        if (!isGatewayRunning) {
          return {
            content: [{
              type: 'text' as const,
              text: '❌ OpenClaw gateway is not running. Please start it:\n\n```bash\nopenclaw gateway start\n```',
            }],
          };
        }

        const isWeChatConfigured = await client.isWeChatConfigured();
        if (!isWeChatConfigured) {
          return {
            content: [{
              type: 'text' as const,
              text: '❌ WeChat channel is not configured. Please install it:\n\n```bash\nnpx -y @tencent-weixin/openclaw-weixin-cli install\n```',
            }],
          };
        }

        const status = await client.getStatus();

        return {
          content: [{
            type: 'text' as const,
            text: `✅ OpenClaw + WeChat connection verified!\n\n\`\`\`\n${status}\n\`\`\``,
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
        const isAvailable = await client.isAvailable();
        if (!isAvailable) {
          return {
            content: [{
              type: 'text' as const,
              text: '❌ OpenClaw is not installed.',
            }],
          };
        }

        const result = await client.login();

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

  // Send message
  server.tool(
    'wechat_send',
    'Send a message to a WeChat contact via OpenClaw agent',
    {
      to: z.string().describe('Recipient ID (e.g., "filehelper" for file transfer helper, or user ID)'),
      message: z.string().describe('Message content to send'),
    },
    async ({ to, message }) => {
      try {
        const result = await client.sendMessage(to, message, true);

        if (result.success) {
          return {
            content: [{
              type: 'text' as const,
              text: `✅ Message sent to ${to}!\n\nResponse:\n${result.content?.slice(0, 500) || 'No response'}`,
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
        const status = await client.getStatus();
        const channelStatus = await client.getChannelStatus();

        return {
          content: [{
            type: 'text' as const,
            text: `📊 **OpenClaw Status**\n\n${status}\n\n**Channel Status:**\n${channelStatus}`,
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

  // Restart gateway
  server.tool(
    'wechat_restart',
    'Restart the OpenClaw gateway',
    {},
    async () => {
      try {
        const result = await client.restartGateway();

        if (result.success) {
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

  // Open dashboard
  server.tool(
    'wechat_dashboard',
    'Open the OpenClaw web dashboard in browser',
    {},
    async () => {
      try {
        await client.openDashboard();
        return {
          content: [{
            type: 'text' as const,
            text: `🌐 Opening OpenClaw dashboard in your browser...\n\nURL: http://127.0.0.1:18789/`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `❌ Failed to open dashboard: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

| 工具 | 功能 |
|------|------|
| wechat_configure | 验证连接状态 |
| wechat_login | 发起微信登录 |
| wechat_send | 发送消息 |
| wechat_status | 查看状态 |
| wechat_restart | 重启网关 |
| wechat_dashboard | 打开 Web 控制台 |

## 注意事项

- 消息通过 OpenClaw 的 AI Agent 发送
- 收到的消息会由 AI 处理后回复
- 如需直接收发消息，需要访问 OpenClaw 的 WebSocket API

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
