import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '../utils/logger.js';

// Types
export interface WeixinMessage {
  seq?: number;
  message_id?: number;
  from_user_id?: string;
  to_user_id?: string;
  create_time_ms?: number;
  session_id?: string;
  group_id?: string;
  message_type?: number;
  message_state?: number;
  item_list?: MessageItem[];
  context_token?: string;
}

export interface MessageItem {
  type?: number;
  text_item?: { text?: string };
  image_item?: ImageItem;
  file_item?: FileItem;
  voice_item?: VoiceItem;
  video_item?: VideoItem;
}

export interface ImageItem {
  media?: CDNMedia;
  thumb_media?: CDNMedia;
  aeskey?: string;
}

export interface FileItem {
  media?: CDNMedia;
  file_name?: string;
  md5?: string;
  len?: string;
}

export interface VoiceItem {
  media?: CDNMedia;
  playtime?: number;
  text?: string;
}

export interface VideoItem {
  media?: CDNMedia;
  play_length?: number;
  thumb_media?: CDNMedia;
}

export interface CDNMedia {
  encrypt_query_param?: string;
  aes_key?: string;
}

export interface GetUpdatesResponse {
  ret?: number;
  errcode?: number;
  errmsg?: string;
  msgs?: WeixinMessage[];
  get_updates_buf?: string;
  longpolling_timeout_ms?: number;
}

export interface SendMessageRequest {
  to_user_id: string;
  context_token?: string;
  item_list: MessageItem[];
}

// Constants
const DEFAULT_BASE_URL = 'https://ilinkai.weixin.qq.com';
const DEFAULT_TIMEOUT = 35000;
const MESSAGE_ITEM_TYPE = {
  TEXT: 1,
  IMAGE: 2,
  VOICE: 3,
  FILE: 4,
  VIDEO: 5,
};

export class WeixinApiClient {
  private baseUrl: string;
  private token: string;
  private accountId: string;
  private getUpdatesBuf: string = '';

  private constructor(baseUrl: string, token: string, accountId: string) {
    this.baseUrl = baseUrl;
    this.token = token;
    this.accountId = accountId;
  }

  /**
   * Create client from OpenClaw stored credentials
   */
  static async fromOpenClawConfig(accountId?: string): Promise<WeixinApiClient> {
    const stateDir = path.join(os.homedir(), '.openclaw', 'openclaw-weixin');

    // Read accounts index
    const accountsPath = path.join(stateDir, 'accounts.json');
    if (!fs.existsSync(accountsPath)) {
      throw new Error('No WeChat accounts found. Please login first: openclaw channels login --channel openclaw-weixin');
    }

    const accounts = JSON.parse(fs.readFileSync(accountsPath, 'utf-8')) as string[];
    if (accounts.length === 0) {
      throw new Error('No WeChat accounts registered. Please login first.');
    }

    // Use first account if not specified
    const targetAccountId = accountId || accounts[0];
    if (!accounts.includes(targetAccountId)) {
      throw new Error(`Account ${targetAccountId} not found. Available: ${accounts.join(', ')}`);
    }

    // Load account credentials
    const accountPath = path.join(stateDir, 'accounts', `${targetAccountId}.json`);
    if (!fs.existsSync(accountPath)) {
      throw new Error(`Account credentials not found for ${targetAccountId}`);
    }

    const accountData = JSON.parse(fs.readFileSync(accountPath, 'utf-8')) as {
      token?: string;
      baseUrl?: string;
    };

    if (!accountData.token) {
      throw new Error(`No token found for account ${targetAccountId}. Please re-login.`);
    }

    logger.info(`Loaded WeChat account: ${targetAccountId}`);
    return new WeixinApiClient(
      accountData.baseUrl || DEFAULT_BASE_URL,
      accountData.token,
      targetAccountId
    );
  }

  /**
   * Generate X-WECHAT-UIN header
   */
  private randomWechatUin(): string {
    const uint32 = crypto.randomBytes(4).readUInt32BE(0);
    return Buffer.from(String(uint32), 'utf-8').toString('base64');
  }

  /**
   * Build request headers
   */
  private buildHeaders(body: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'AuthorizationType': 'ilink_bot_token',
      'Authorization': `Bearer ${this.token}`,
      'Content-Length': String(Buffer.byteLength(body, 'utf-8')),
      'X-WECHAT-UIN': this.randomWechatUin(),
    };
  }

  /**
   * Make API request
   */
  private async apiFetch(endpoint: string, body: object, timeout: number = DEFAULT_TIMEOUT): Promise<string> {
    const url = `${this.baseUrl}/${endpoint}`;
    const bodyStr = JSON.stringify({ ...body, base_info: { channel_version: 'cc-wechat-cli/0.1.0' } });
    const headers = this.buildHeaders(bodyStr);

    logger.debug(`POST ${url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: bodyStr,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const text = await response.text();

      if (!response.ok) {
        throw new Error(`API error ${response.status}: ${text}`);
      }

      return text;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Get new messages (long-poll)
   */
  async getUpdates(timeout: number = 30000): Promise<GetUpdatesResponse> {
    try {
      const rawText = await this.apiFetch('ilink/bot/getupdates', {
        get_updates_buf: this.getUpdatesBuf,
      }, timeout);

      const resp: GetUpdatesResponse = JSON.parse(rawText);

      // Update buffer for next request
      if (resp.get_updates_buf) {
        this.getUpdatesBuf = resp.get_updates_buf;
      }

      // Handle errors
      if (resp.ret !== 0) {
        logger.warn(`getUpdates returned ret=${resp.ret}, errcode=${resp.errcode}, errmsg=${resp.errmsg}`);
      }

      return resp;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Timeout is normal for long-poll
        return { ret: 0, msgs: [], get_updates_buf: this.getUpdatesBuf };
      }
      throw error;
    }
  }

  /**
   * Send text message
   */
  async sendTextMessage(toUserId: string, text: string, contextToken?: string): Promise<boolean> {
    const body: SendMessageRequest = {
      to_user_id: toUserId,
      context_token: contextToken,
      item_list: [
        { type: MESSAGE_ITEM_TYPE.TEXT, text_item: { text } }
      ],
    };

    try {
      await this.apiFetch('ilink/bot/sendmessage', { msg: body }, 15000);
      logger.info(`Message sent to ${toUserId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to send message:`, error);
      return false;
    }
  }

  /**
   * Get config (includes typing ticket)
   */
  async getConfig(ilinkUserId: string, contextToken?: string): Promise<{ typing_ticket?: string }> {
    const rawText = await this.apiFetch('ilink/bot/getconfig', {
      ilink_user_id: ilinkUserId,
      context_token: contextToken,
    }, 10000);

    return JSON.parse(rawText);
  }

  /**
   * Send typing indicator
   */
  async sendTyping(ilinkUserId: string, typingTicket: string, isTyping: boolean = true): Promise<void> {
    await this.apiFetch('ilink/bot/sendtyping', {
      ilink_user_id: ilinkUserId,
      typing_ticket: typingTicket,
      status: isTyping ? 1 : 2,
    }, 10000);
  }

  /**
   * Get account info
   */
  getAccountInfo(): { accountId: string; baseUrl: string } {
    return {
      accountId: this.accountId,
      baseUrl: this.baseUrl,
    };
  }

  /**
   * List available accounts
   */
  static listAccounts(): string[] {
    const stateDir = path.join(os.homedir(), '.openclaw', 'openclaw-weixin');
    const accountsPath = path.join(stateDir, 'accounts.json');

    if (!fs.existsSync(accountsPath)) {
      return [];
    }

    try {
      return JSON.parse(fs.readFileSync(accountsPath, 'utf-8')) as string[];
    } catch {
      return [];
    }
  }
}
