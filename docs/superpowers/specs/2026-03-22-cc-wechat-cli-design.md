# cc-wechat-cli Design Specification

## Overview

**Project**: Claude Code WeChat CLI (cc-wechat-cli)
**Goal**: Build an enhanced MCP server that enables Claude Code to communicate through WeChat
**Approach**: Hybrid - MCP adapter layer using OpenClaw as backend

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Claude Code                          │
│                      (MCP Client)                           │
└─────────────────────────┬───────────────────────────────────┘
                          │ MCP Protocol
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    cc-wechat-cli                            │
│                    (MCP Server)                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  MCP Tools:                                          │   │
│  │  - /wechat:send      Send message                   │   │
│  │  - /wechat:receive   Poll for messages              │   │
│  │  - /wechat:send_image Send image                    │   │
│  │  - /wechat:send_file  Send file                     │   │
│  │  - /wechat:list_contacts List contacts              │   │
│  │  - /wechat:list_groups   List groups                │   │
│  │  - /wechat:configure    Setup connection            │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP/WebSocket
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   OpenClaw Gateway                          │
│                   (Local Process)                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Built-in channel management, message routing,       │   │
│  │  session handling, multi-account support             │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────┘
                          │ Channel Plugin API
                          ▼
┌─────────────────────────────────────────────────────────────┐
│         @tencent-weixin/openclaw-weixin                     │
│              (Tencent Official Plugin)                      │
└─────────────────────────┬───────────────────────────────────┘
                          │ WeChat Protocol
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      WeChat                                 │
│                   (微信)                                    │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. MCP Server Layer (cc-wechat-cli)

**Responsibility**: Protocol adaptation between Claude Code and OpenClaw

**Key Features**:
- Implements MCP protocol for Claude Code integration
- Provides tools for message sending/receiving
- Handles image and file transfer
- Manages contact and group interactions
- Caches messages for polling-based retrieval

**Technology Stack**:
- TypeScript
- Bun runtime (fast, native TypeScript support)
- MCP SDK (@modelcontextprotocol/sdk)

### 2. OpenClaw Gateway Integration

**Responsibility**: Message routing and WeChat channel management

**Integration Points**:
- Start/stop OpenClaw gateway process
- Register message handlers
- Send messages through WeChat channel
- Handle incoming messages from WeChat

**API Communication**:
- OpenClaw exposes HTTP/WebSocket API on localhost
- MCP server communicates via REST calls
- Long-polling or WebSocket for real-time message reception

### 3. WeChat Channel Plugin

**Responsibility**: Actual WeChat protocol implementation

- Uses Tencent's official `@tencent-weixin/openclaw-weixin` plugin
- Handles QR code login
- Manages WeChat session
- Sends/receives WeChat messages

## MCP Tools Specification

### `/wechat:configure`
Configure WeChat connection settings

**Parameters**:
- `openclaw_host`: OpenClaw gateway host (default: localhost)
- `openclaw_port`: OpenClaw gateway port (default: 3100)

**Behavior**:
- Checks if OpenClaw is running
- Verifies WeChat channel is available
- Returns connection status

### `/wechat:login`
Initiate WeChat login process

**Parameters**: None

**Behavior**:
- Triggers QR code display
- Returns QR code for terminal display
- Waits for scan confirmation
- Returns login status

### `/wechat:send`
Send text message to a contact or group

**Parameters**:
- `to`: Recipient ID (user ID or group ID)
- `message`: Text content to send

**Behavior**:
- Routes message through OpenClaw
- Returns send status with message ID

### `/wechat:receive`
Poll for incoming messages

**Parameters**:
- `timeout`: Max wait time in seconds (default: 30)

**Behavior**:
- Returns list of new messages since last poll
- Each message includes: sender, content, timestamp, type

### `/wechat:send_image`
Send image to a contact or group

**Parameters**:
- `to`: Recipient ID
- `image_path`: Local file path or URL

**Behavior**:
- Uploads image through OpenClaw
- Returns send status

### `/wechat:send_file`
Send file to a contact or group

**Parameters**:
- `to`: Recipient ID
- `file_path`: Local file path
- `filename`: Optional display filename

**Behavior**:
- Uploads file through OpenClaw
- Returns send status

### `/wechat:list_contacts`
List WeChat contacts

**Parameters**:
- `filter`: Optional filter string

**Behavior**:
- Returns list of contacts with ID, name, avatar

### `/wechat:list_groups`
List WeChat groups

**Parameters**: None

**Behavior**:
- Returns list of groups with ID, name, member count

### `/wechat:group_members`
Get members of a specific group

**Parameters**:
- `group_id`: Group ID

**Behavior**:
- Returns list of members with ID, name

## Data Models

### Message
```typescript
interface WeChatMessage {
  id: string;
  from: string;        // Sender ID
  to: string;          // Recipient ID (our bot)
  type: 'text' | 'image' | 'file' | 'video' | 'link';
  content: string;     // Text content or file URL
  timestamp: number;
  groupId?: string;    // If from group
  senderName?: string; // Display name
}
```

### Contact
```typescript
interface WeChatContact {
  id: string;
  name: string;
  avatar?: string;
  type: 'user' | 'group';
}
```

### Config
```typescript
interface WeChatConfig {
  openclawHost: string;
  openclawPort: number;
  autoReconnect: boolean;
  messageCacheSize: number;
}
```

## Error Handling

### Connection Errors
- OpenClaw not running → Prompt user to start OpenClaw
- WeChat not logged in → Trigger login flow
- Connection lost → Auto-reconnect with backoff

### Message Errors
- Invalid recipient → Return error with suggestion
- Rate limit → Queue message, retry later
- File too large → Return error with size limit

### API Errors
- Network timeout → Retry with exponential backoff
- Invalid response → Log and return error to user

## Configuration

### Claude Code Integration
Add to Claude Code settings:
```json
{
  "mcpServers": {
    "wechat": {
      "command": "npx",
      "args": ["-y", "cc-wechat-cli"]
    }
  }
}
```

### Environment Variables
- `OPENCLAW_HOST`: Override default host
- `OPENCLAW_PORT`: Override default port
- `WECHAT_LOG_LEVEL`: Logging verbosity

## Project Structure

```
cc-wechat-cli/
├── package.json
├── tsconfig.json
├── bunfig.toml
├── src/
│   ├── index.ts           # Entry point, MCP server
│   ├── mcp/
│   │   ├── server.ts      # MCP server implementation
│   │   └── tools.ts       # Tool definitions
│   ├── openclaw/
│   │   ├── client.ts      # OpenClaw API client
│   │   └── types.ts       # OpenClaw types
│   ├── wechat/
│   │   ├── message.ts     # Message handling
│   │   └── contact.ts     # Contact management
│   └── utils/
│       ├── logger.ts      # Logging utility
│       └── config.ts      # Configuration loader
├── tests/
│   ├── mcp.test.ts
│   └── openclaw.test.ts
└── README.md
```

## Dependencies

### Production
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `@anthropic-ai/sdk` - Anthropic API (optional, for advanced features)
- `zod` - Schema validation
- `qrcode-terminal` - QR code display in terminal

### Development
- `typescript` - TypeScript compiler
- `bun` - Runtime and test framework
- `@types/bun` - Type definitions

## Success Criteria

1. **Basic Messaging**: Can send and receive text messages through Claude Code
2. **Media Support**: Can send images and files
3. **Group Support**: Can interact with WeChat groups
4. **Multi-account**: Can manage multiple WeChat accounts (via OpenClaw)
5. **Reliability**: Auto-reconnects on disconnection
6. **User Experience**: Clear error messages and easy setup

## Future Enhancements (Post-MVP)

- Voice message support
- Video message support
- Link preview cards
- Message recall
- Multi-account switching
- Web dashboard for monitoring
- Upstream contributions to OpenClaw WeChat plugin

## Timeline Estimate

- Phase 1: Core MCP server + basic messaging (MVP)
- Phase 2: Image/file support
- Phase 3: Group support + contact management
- Phase 4: Polish + documentation + publish
