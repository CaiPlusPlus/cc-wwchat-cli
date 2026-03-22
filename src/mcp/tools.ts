import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OpenClawClient } from '../openclaw/client.js';
import {
  createMessageCache,
  addMessage,
  getNewMessages,
  fromOpenClawMessage,
} from '../wechat/message.js';
import {
  fromOpenClawContact,
  fromOpenClawGroup,
} from '../wechat/contact.js';
import { logger } from '../utils/logger.js';
import type { WeChatConfig } from '../utils/config.js';
import qrcode from 'qrcode-terminal';

export function registerTools(
  server: McpServer,
  client: OpenClawClient,
  config: WeChatConfig
): void {
  const messageCache = createMessageCache(config.messageCacheSize);
  let lastPollTimestamp = 0;

  // Configure connection
  server.tool(
    'wechat_configure',
    'Configure WeChat connection settings',
    {
      host: z.string().optional().describe('OpenClaw host (default: localhost)'),
      port: z.number().optional().describe('OpenClaw port (default: 3100)'),
    },
    async ({ host, port }) => {
      try {
        const isRunning = await client.isRunning();
        if (!isRunning) {
          return {
            content: [{
              type: 'text' as const,
              text: '❌ OpenClaw gateway is not running. Please start OpenClaw first:\n\n```bash\nopenclaw gateway start\n```',
            }],
          };
        }

        const wechatAvailable = await client.isWeChatAvailable();
        if (!wechatAvailable) {
          return {
            content: [{
              type: 'text' as const,
              text: '❌ WeChat channel is not available. Please install it first:\n\n```bash\nnpx @tencent-weixin/openclaw-weixin-cli install\n```',
            }],
          };
        }

        return {
          content: [{
            type: 'text' as const,
            text: `✅ OpenClaw connection successful!\n\n- Host: ${host || config.openclawHost}\n- Port: ${port || config.openclawPort}\n- WeChat channel: Available`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `❌ Configuration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
        };
      }
    }
  );

  // Login to WeChat
  server.tool(
    'wechat_login',
    'Initiate WeChat login with QR code',
    {},
    async () => {
      try {
        const isRunning = await client.isRunning();
        if (!isRunning) {
          return {
            content: [{
              type: 'text' as const,
              text: '❌ OpenClaw gateway is not running. Please start it first.',
            }],
          };
        }

        const response = await client.login();

        if (response.qrCode) {
          // Display QR code in terminal
          logger.info('Scan the QR code below to login:');
          qrcode.generate(response.qrCode, { small: true });

          return {
            content: [{
              type: 'text' as const,
              text: '📱 QR code displayed in terminal. Please scan with WeChat to login.',
            }],
          };
        }

        return {
          content: [{
            type: 'text' as const,
            text: response.success
              ? '✅ Already logged in or login initiated.'
              : `❌ Login failed: ${response.message || 'Unknown error'}`,
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
    'Send text message to a WeChat contact or group',
    {
      to: z.string().describe('Recipient ID (user ID or group ID)'),
      message: z.string().describe('Text message to send'),
    },
    async ({ to, message }) => {
      try {
        const result = await client.sendMessage({
          channelId: 'openclaw-weixin',
          recipientId: to,
          content: message,
          contentType: 'text',
        });

        if (result.success) {
          return {
            content: [{
              type: 'text' as const,
              text: `✅ Message sent successfully!\n\nTo: ${to}\nMessage: ${message}\nMessage ID: ${result.messageId}`,
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

  // Receive messages
  server.tool(
    'wechat_receive',
    'Poll for new WeChat messages',
    {
      timeout: z.number().optional().default(30).describe('Max wait time in seconds'),
    },
    async ({ timeout }) => {
      try {
        const messages = await client.getMessages(lastPollTimestamp);

        if (messages.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: '📭 No new messages.',
            }],
          };
        }

        // Update last poll timestamp and cache messages
        const wechatMessages = messages.map(fromOpenClawMessage);
        wechatMessages.forEach(msg => addMessage(messageCache, msg));
        lastPollTimestamp = Math.max(...messages.map(m => m.timestamp));

        const formattedMessages = wechatMessages.map(msg => {
          const from = msg.senderName ? `${msg.senderName} (${msg.from})` : msg.from;
          const group = msg.groupId ? ` [Group: ${msg.groupId}]` : '';
          return `📨 **${from}**${group}\n   ${msg.content}\n   _${new Date(msg.timestamp).toLocaleString()}_`;
        }).join('\n\n');

        return {
          content: [{
            type: 'text' as const,
            text: `📬 ${wechatMessages.length} new message(s):\n\n${formattedMessages}`,
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

  // Send image
  server.tool(
    'wechat_send_image',
    'Send image to a WeChat contact or group',
    {
      to: z.string().describe('Recipient ID'),
      image_path: z.string().describe('Local file path or URL to the image'),
    },
    async ({ to, image_path }) => {
      try {
        const result = await client.sendImage(to, image_path);

        if (result.success) {
          return {
            content: [{
              type: 'text' as const,
              text: `✅ Image sent successfully to ${to}!\nImage: ${image_path}`,
            }],
          };
        }

        return {
          content: [{
            type: 'text' as const,
            text: `❌ Failed to send image: ${result.error}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `❌ Send image error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
        };
      }
    }
  );

  // Send file
  server.tool(
    'wechat_send_file',
    'Send file to a WeChat contact or group',
    {
      to: z.string().describe('Recipient ID'),
      file_path: z.string().describe('Local file path'),
      filename: z.string().optional().describe('Display filename'),
    },
    async ({ to, file_path, filename }) => {
      try {
        const result = await client.sendFile(to, file_path, filename);

        if (result.success) {
          return {
            content: [{
              type: 'text' as const,
              text: `✅ File sent successfully to ${to}!\nFile: ${filename || file_path}`,
            }],
          };
        }

        return {
          content: [{
            type: 'text' as const,
            text: `❌ Failed to send file: ${result.error}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `❌ Send file error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
        };
      }
    }
  );

  // List contacts
  server.tool(
    'wechat_list_contacts',
    'List WeChat contacts',
    {
      filter: z.string().optional().describe('Filter contacts by name'),
    },
    async ({ filter }) => {
      try {
        const contacts = await client.getContacts(filter);
        const wechatContacts = contacts.map(fromOpenClawContact);

        if (wechatContacts.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: '📋 No contacts found.',
            }],
          };
        }

        const formattedContacts = wechatContacts
          .filter(c => c.type === 'user')
          .map(c => `- **${c.name}** (${c.id})`)
          .join('\n');

        return {
          content: [{
            type: 'text' as const,
            text: `📋 **Contacts** (${wechatContacts.filter(c => c.type === 'user').length}):\n\n${formattedContacts}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `❌ List contacts error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
        };
      }
    }
  );

  // List groups
  server.tool(
    'wechat_list_groups',
    'List WeChat groups',
    {},
    async () => {
      try {
        const groups = await client.getGroups();
        const wechatGroups = groups.map(fromOpenClawGroup);

        if (wechatGroups.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: '📋 No groups found.',
            }],
          };
        }

        const formattedGroups = wechatGroups
          .map(g => `- **${g.name}** (${g.memberCount} members) - ID: ${g.id}`)
          .join('\n');

        return {
          content: [{
            type: 'text' as const,
            text: `📋 **Groups** (${wechatGroups.length}):\n\n${formattedGroups}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `❌ List groups error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
        };
      }
    }
  );

  // Get group members
  server.tool(
    'wechat_group_members',
    'Get members of a specific WeChat group',
    {
      group_id: z.string().describe('Group ID'),
    },
    async ({ group_id }) => {
      try {
        const members = await client.getGroupMembers(group_id);
        const wechatMembers = members.map(fromOpenClawContact);

        if (wechatMembers.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: '📋 No members found or group not accessible.',
            }],
          };
        }

        const formattedMembers = wechatMembers
          .map(m => `- **${m.name}** (${m.id})`)
          .join('\n');

        return {
          content: [{
            type: 'text' as const,
            text: `👥 **Group Members** (${wechatMembers.length}):\n\n${formattedMembers}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `❌ Get group members error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
        };
      }
    }
  );

  logger.info('MCP tools registered');
}
