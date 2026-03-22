// OpenClaw API Types

export interface OpenClawMessage {
  id: string;
  channelId: string;
  channelType: string;
  senderId: string;
  senderName?: string;
  content: string;
  contentType: 'text' | 'image' | 'file' | 'video' | 'link' | 'audio';
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface OpenClawContact {
  id: string;
  name: string;
  avatar?: string;
  type: 'user' | 'group' | 'channel';
  metadata?: Record<string, unknown>;
}

export interface OpenClawGroup {
  id: string;
  name: string;
  memberCount: number;
  avatar?: string;
  members?: OpenClawContact[];
}

export interface OpenClawSendRequest {
  channelId: string;
  recipientId: string;
  content: string;
  contentType?: 'text' | 'image' | 'file';
  metadata?: Record<string, unknown>;
}

export interface OpenClawSendResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface OpenClawStatus {
  running: boolean;
  channels: Array<{
    id: string;
    name: string;
    status: 'connected' | 'disconnected' | 'connecting';
  }>;
}

export interface OpenClawLoginResponse {
  qrCode?: string;
  success: boolean;
  message?: string;
}
