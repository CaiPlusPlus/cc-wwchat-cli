import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';

const execAsync = promisify(exec);

const WECHAT_CHANNEL = 'openclaw-weixin';

export interface OpenClawMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'video';
  timestamp: number;
  contextToken?: string;
}

export interface OpenClawContact {
  id: string;
  name: string;
}

export interface OpenClawGroup {
  id: string;
  name: string;
  memberCount: number;
}

export interface AgentResponse {
  success: boolean;
  content?: string;
  error?: string;
}

export class OpenClawClient {
  private openclawPath: string;

  constructor() {
    this.openclawPath = 'openclaw';
  }

  private async runOpenclaw(args: string[], timeout: number = 60000): Promise<string> {
    const cmd = `${this.openclawPath} ${args.join(' ')}`;
    logger.debug(`Running: ${cmd}`);

    try {
      const { stdout, stderr } = await execAsync(cmd, {
        timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      if (stderr && !stdout) {
        throw new Error(stderr);
      }

      return stdout;
    } catch (error: unknown) {
      const err = error as { killed?: boolean; signal?: string; message?: string };
      if (err.killed && err.signal === 'SIGTERM') {
        throw new Error('Command timeout');
      }
      throw error;
    }
  }

  /**
   * Check if OpenClaw is installed and available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.runOpenclaw(['--version']);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if gateway is running
   */
  async isGatewayRunning(): Promise<boolean> {
    try {
      const result = await this.runOpenclaw(['gateway', 'health']);
      return result.includes('OK');
    } catch {
      return false;
    }
  }

  /**
   * Check if WeChat channel is configured
   */
  async isWeChatConfigured(): Promise<boolean> {
    try {
      const result = await this.runOpenclaw(['channels', 'list']);
      return result.includes(WECHAT_CHANNEL);
    } catch {
      return false;
    }
  }

  /**
   * Get gateway status
   */
  async getStatus(): Promise<string> {
    try {
      return await this.runOpenclaw(['status']);
    } catch (error) {
      logger.error('Failed to get status:', error);
      return 'Error getting status';
    }
  }

  /**
   * Send a message through the AI agent (with delivery to channel)
   * This goes through OpenClaw's agent system
   */
  async sendMessage(
    to: string,
    message: string,
    deliver: boolean = true
  ): Promise<AgentResponse> {
    try {
      const args = [
        'agent',
        '--channel', WECHAT_CHANNEL,
        '--to', to,
        '--message', `"${message.replace(/"/g, '\\"')}"`,
      ];

      if (deliver) {
        args.push('--deliver');
      }

      const result = await this.runOpenclaw(args, 120000);

      return {
        success: true,
        content: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send a direct message (bypassing AI agent)
   * Note: OpenClaw doesn't have a direct send command, messages go through agent
   */
  async sendDirectMessage(
    to: string,
    message: string
  ): Promise<AgentResponse> {
    // OpenClaw routes all messages through the agent
    // Use --deliver to send the response back to the channel
    return this.sendMessage(to, message, true);
  }

  /**
   * Trigger WeChat login
   */
  async login(): Promise<AgentResponse> {
    try {
      const result = await this.runOpenclaw([
        'channels', 'login', '--channel', WECHAT_CHANNEL
      ], 180000); // 3 minute timeout for QR scan

      return {
        success: true,
        content: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Restart the gateway
   */
  async restartGateway(): Promise<AgentResponse> {
    try {
      const result = await this.runOpenclaw(['gateway', 'restart']);
      return {
        success: true,
        content: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get channel status
   */
  async getChannelStatus(): Promise<string> {
    try {
      return await this.runOpenclaw(['channels', 'status', '--channel', WECHAT_CHANNEL]);
    } catch (error) {
      logger.error('Failed to get channel status:', error);
      return 'Error getting channel status';
    }
  }

  /**
   * Open the OpenClaw dashboard
   */
  async openDashboard(): Promise<void> {
    try {
      await this.runOpenclaw(['dashboard']);
    } catch (error) {
      logger.error('Failed to open dashboard:', error);
    }
  }
}
