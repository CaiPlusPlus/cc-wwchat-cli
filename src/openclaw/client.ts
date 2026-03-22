import { logger } from '../utils/logger.js';
import type {
  OpenClawMessage,
  OpenClawContact,
  OpenClawGroup,
  OpenClawSendRequest,
  OpenClawSendResponse,
  OpenClawStatus,
  OpenClawLoginResponse,
} from './types.js';

const WECHAT_CHANNEL_ID = 'openclaw-weixin';

export class OpenClawClient {
  private baseUrl: string;
  private timeout: number;

  constructor(host: string = 'localhost', port: number = 3100) {
    this.baseUrl = `http://${host}:${port}`;
    this.timeout = 30000;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    logger.debug(`Request: ${options.method || 'GET'} ${url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenClaw API error: ${response.status} - ${error}`);
      }

      return response.json() as Promise<T>;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  // Check gateway status
  async getStatus(): Promise<OpenClawStatus> {
    return this.request<OpenClawStatus>('/api/status');
  }

  // Check if OpenClaw is running
  async isRunning(): Promise<boolean> {
    try {
      await this.getStatus();
      return true;
    } catch {
      return false;
    }
  }

  // Check if WeChat channel is available
  async isWeChatAvailable(): Promise<boolean> {
    try {
      const status = await this.getStatus();
      return status.channels.some(c => c.id === WECHAT_CHANNEL_ID);
    } catch {
      return false;
    }
  }

  // Initiate WeChat login
  async login(): Promise<OpenClawLoginResponse> {
    try {
      const response = await this.request<OpenClawLoginResponse>(
        `/api/channels/${WECHAT_CHANNEL_ID}/login`,
        { method: 'POST' }
      );
      return response;
    } catch (error) {
      logger.error('Login failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Get login QR code
  async getLoginQRCode(): Promise<string | null> {
    try {
      const response = await this.request<{ qrCode: string }>(
        `/api/channels/${WECHAT_CHANNEL_ID}/qrcode`
      );
      return response.qrCode;
    } catch {
      return null;
    }
  }

  // Send message
  async sendMessage(request: OpenClawSendRequest): Promise<OpenClawSendResponse> {
    try {
      return await this.request<OpenClawSendResponse>(
        `/api/channels/${WECHAT_CHANNEL_ID}/send`,
        {
          method: 'POST',
          body: JSON.stringify(request),
        }
      );
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Get messages (poll)
  async getMessages(since?: number, limit: number = 50): Promise<OpenClawMessage[]> {
    const params = new URLSearchParams();
    if (since) params.set('since', since.toString());
    params.set('limit', limit.toString());

    try {
      return await this.request<OpenClawMessage[]>(
        `/api/channels/${WECHAT_CHANNEL_ID}/messages?${params}`
      );
    } catch (error) {
      logger.error('Failed to get messages:', error);
      return [];
    }
  }

  // Get contacts
  async getContacts(filter?: string): Promise<OpenClawContact[]> {
    const params = filter ? `?filter=${encodeURIComponent(filter)}` : '';
    try {
      return await this.request<OpenClawContact[]>(
        `/api/channels/${WECHAT_CHANNEL_ID}/contacts${params}`
      );
    } catch (error) {
      logger.error('Failed to get contacts:', error);
      return [];
    }
  }

  // Get groups
  async getGroups(): Promise<OpenClawGroup[]> {
    try {
      return await this.request<OpenClawGroup[]>(
        `/api/channels/${WECHAT_CHANNEL_ID}/groups`
      );
    } catch (error) {
      logger.error('Failed to get groups:', error);
      return [];
    }
  }

  // Get group members
  async getGroupMembers(groupId: string): Promise<OpenClawContact[]> {
    try {
      return await this.request<OpenClawContact[]>(
        `/api/channels/${WECHAT_CHANNEL_ID}/groups/${groupId}/members`
      );
    } catch (error) {
      logger.error('Failed to get group members:', error);
      return [];
    }
  }

  // Send image
  async sendImage(recipientId: string, imagePath: string): Promise<OpenClawSendResponse> {
    try {
      return await this.request<OpenClawSendResponse>(
        `/api/channels/${WECHAT_CHANNEL_ID}/send/image`,
        {
          method: 'POST',
          body: JSON.stringify({
            recipientId,
            imagePath,
          }),
        }
      );
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Send file
  async sendFile(recipientId: string, filePath: string, filename?: string): Promise<OpenClawSendResponse> {
    try {
      return await this.request<OpenClawSendResponse>(
        `/api/channels/${WECHAT_CHANNEL_ID}/send/file`,
        {
          method: 'POST',
          body: JSON.stringify({
            recipientId,
            filePath,
            filename,
          }),
        }
      );
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
