# cc-wechat-cli

> Claude Code MCP server for WeChat integration via OpenClaw

让 Claude Code 通过微信收发消息的 MCP 服务器。

## 工作原理

```
Claude Code (MCP Client)
       ↓ MCP Protocol
cc-wechat-cli (MCP Server)
       ↓ CLI Commands
OpenClaw Gateway
       ↓ iLink Bot API
微信 (WeChat)
```

**注意**: 本项目使用 OpenClaw CLI 命令进行集成。消息通过 OpenClaw 的 AI Agent 处理后发送。

## 功能特性

- ✅ 连接状态验证
- ✅ 微信登录（二维码）
- ✅ 消息发送（通过 AI Agent）
- ✅ 网关状态查询
- ✅ 网关重启
- ✅ Web Dashboard

## 前置要求

### 1. 安装 OpenClaw

```bash
npm install -g openclaw
```

### 2. 安装微信插件

```bash
npx -y @tencent-weixin/openclaw-weixin-cli install
```

### 3. 登录微信

```bash
openclaw channels login --channel openclaw-weixin
```

扫描终端中的二维码登录微信。

### 4. 启动网关

```bash
openclaw gateway start
```

## 安装

### 在 Claude Code 中配置

在你的 Claude Code 配置文件中添加:

```json
{
  "mcpServers": {
    "wechat": {
      "command": "npx",
      "args": ["-y", "cc-wwchat-cli"]
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
npm install

# 构建
npm run build

# 运行
node dist/index.js
```

## 可用工具

| 工具 | 功能 |
|------|------|
| `wechat_configure` | 验证 OpenClaw + 微信连接状态 |
| `wechat_login` | 发起微信登录（需要在终端执行） |
| `wechat_send` | 发送消息到微信联系人 |
| `wechat_status` | 查看网关和通道状态 |
| `wechat_restart` | 重启 OpenClaw 网关 |
| `wechat_dashboard` | 打开 Web 控制台 |
| `wechat_help` | 显示使用指南 |

## 使用示例

### 验证连接
```
/wechat_configure
```

### 发送消息
```
/wechat_send --to "filehelper" --message "测试消息"
```

### 查看状态
```
/wechat_status
```

## 环境变量

| 变量 | 描述 | 默认值 |
|------|------|--------|
| `WECHAT_LOG_LEVEL` | 日志级别 (debug/info/warn/error) | `info` |

## 技术栈

- TypeScript
- MCP SDK (@modelcontextprotocol/sdk)
- OpenClaw CLI

## 相关项目

- [OpenClaw](https://github.com/openclaw/openclaw) - 多通道 AI 网关
- [@tencent-weixin/openclaw-weixin](https://www.npmjs.com/package/@tencent-weixin/openclaw-weixin) - 腾讯官方微信插件

## 许可证

MIT
