import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { OpenClawClient } from '../openclaw/client.js';
import { registerTools } from './tools.js';
import { loadConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';

export async function createServer(): Promise<McpServer> {
  const config = loadConfig();
  const client = new OpenClawClient();

  const server = new McpServer({
    name: 'cc-wechat-cli',
    version: '0.1.0',
  }, {
    capabilities: {
      tools: {},
    },
  });

  // Register all WeChat tools
  registerTools(server, client, config);

  logger.info('MCP server created');
  return server;
}

export async function startServer(): Promise<void> {
  const server = await createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
  logger.info('cc-wechat-cli MCP server started');
}
