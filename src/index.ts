#!/usr/bin/env node

import { startServer } from './mcp/server.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  try {
    logger.info('Starting cc-wechat-cli...');
    await startServer();
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
