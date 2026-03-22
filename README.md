# cc-wechat-cli

> Claude Code MCP server for WeChat integration via OpenClaw

让 Claude Code 通过微信收发消息的 MCP 服务器。

## 功能特性

- 📝 文本消息收发
- 🖼️ 图片发送
- 📁 文件发送
- 👥 群聊支持
- 📋 联系人管理
- 🔄 多账号支持

## 前置要求

1. 安装 [Bun](https://bun.sh) 或 Node.js 20+
2. 安装并运行 OpenClaw:
   ```bash
   npm install -g openclaw
   npx @tencent-weixin/openclaw-weixin-cli install
   ```

## 安装

### Claude Code 配置

在你的 Claude Code 配置文件中添加:

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

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/CaiPlusPlus/cc-wwchat-cli
cd cc-wwchat-cli

# 安装依赖
bun install

# 开发模式
bun run dev

# 构建
bun run build
```

## 使用方法

### 配置连接
```
/wechat:configure
```

### 登录微信
```
/wechat:login
```

### 发送消息
```
/wechat:send --to "contact_id" --message "你好"
```

### 接收消息
```
/wechat:receive
```

### 发送图片
```
/wechat:send_image --to "contact_id" --image_path "/path/to/image.jpg"
```

### 发送文件
```
/wechat:send_file --to "contact_id" --file_path "/path/to/file.pdf"
```

### 列出联系人
```
/wechat:list_contacts
```

### 列出群组
```
/wechat:list_groups
```

## 架构

```
Claude Code (MCP Client)
       ↓
cc-wechat-cli (MCP Server)
       ↓
OpenClaw Gateway
       ↓
@tencent-weixin/openclaw-weixin
       ↓
微信
```

## 环境变量

| 变量 | 描述 | 默认值 |
|------|------|--------|
| `OPENCLAW_HOST` | OpenClaw 主机 | `localhost` |
| `OPENCLAW_PORT` | OpenClaw 端口 | `3100` |
| `WECHAT_LOG_LEVEL` | 日志级别 | `info` |

## 许可证

MIT
