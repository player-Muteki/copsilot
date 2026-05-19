# Copsidian

> Embed the complete [OpenCode](https://opencode.ai) agent inside your Obsidian sidebar.
>
> 将完整的 [OpenCode](https://opencode.ai) AI 编程助手嵌入 Obsidian 侧边栏。

---

## English

### Features

- Full OpenCode agent running inside Obsidian — no browser, no context switching
- Streaming responses with markdown, thinking blocks, tool calls, and plan panels
- Session management with persistence across restarts
- `@mention` notes to inject vault content as context
- Sync engine: tool call results written back to your vault as notes
- Diff rendering for file edit operations
- Drag & drop files and images into the chat
- Session search, message timestamps, and configurable retention
- Auto-reconnect on OpenCode process crash
- Keyboard shortcuts for common actions

### Requirements

- Obsidian 1.7.0 or later (desktop only)
- [OpenCode CLI](https://opencode.ai) installed and accessible

### Installation

**Manual (recommended)**

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](../../releases/latest)
2. Create `.obsidian/plugins/copsidian/` in your vault
3. Copy the three files into that folder
4. Enable the plugin in Obsidian settings

**Via BRAT**

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin
2. Open BRAT settings → **Add Beta Plugin**
3. Enter this repository URL
4. Enable the plugin in Obsidian settings

### Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| OpenCode CLI Path | Path to the `opencode` executable | `opencode` |
| Permission Mode | `yolo` (auto-approve all) / `plan` (approve safe ops) / `safe` (confirm all) | `safe` |
| Max Messages per Session | Truncate session when exceeded | `200` |
| Session Retention Days | Remove empty sessions older than this | `30` |
| Sync Rules | Map tool call results to vault notes | — |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + N` | New session |
| `Ctrl/Cmd + L` | Clear screen |
| `Ctrl/Cmd + Shift + C` | Copy last assistant message |
| `Enter` | Send message |
| `Escape` | Stop generation |
| `@` | Reference a vault note |
| `/` | Slash commands |

### Development

```bash
npm install
npm run dev      # watch mode
npm run build    # production build
npm run check    # TypeScript strict check
```

---

## 中文

### 功能特性

- 在 Obsidian 内直接运行完整的 OpenCode 代理，无需切换窗口
- 流式响应，支持 Markdown、思考块、工具调用和计划面板渲染
- 会话持久化，重启后自动恢复
- `@提及` 笔记，将 Vault 内容注入为上下文
- 同步引擎：工具调用结果自动写回 Vault 作为笔记
- 文件编辑操作的差异（Diff）渲染
- 支持拖拽文件和图片到对话框
- 会话搜索、消息时间戳及可配置的保留策略
- OpenCode 进程崩溃后自动重连
- 常用操作的键盘快捷键

### 系统要求

- Obsidian 1.7.0 或更高版本（仅桌面端）
- 已安装并可访问 [OpenCode CLI](https://opencode.ai)

### 安装方式

**手动安装（推荐）**

1. 从[最新 Release](../../releases/latest) 下载 `main.js`、`manifest.json` 和 `styles.css`
2. 在 Vault 中创建 `.obsidian/plugins/copsidian/` 目录
3. 将三个文件复制到该目录
4. 在 Obsidian 设置中启用插件

**通过 BRAT 安装**

1. 安装 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 插件
2. 打开 BRAT 设置 → **Add Beta Plugin**
3. 输入本仓库地址
4. 在 Obsidian 设置中启用插件

### 配置说明

| 设置项 | 说明 | 默认值 |
|--------|------|--------|
| OpenCode CLI 路径 | `opencode` 可执行文件路径 | `opencode` |
| 权限模式 | `yolo`（全部自动批准）/ `plan`（批准安全操作）/ `safe`（逐一确认） | `safe` |
| 每会话最大消息数 | 超出后截断 | `200` |
| 会话保留天数 | 超出天数的空会话将被清除 | `30` |
| 同步规则 | 将工具调用结果映射为 Vault 笔记 | — |

### 键盘快捷键

| 快捷键 | 操作 |
|--------|------|
| `Ctrl/Cmd + N` | 新建会话 |
| `Ctrl/Cmd + L` | 清空屏幕 |
| `Ctrl/Cmd + Shift + C` | 复制最后一条助手消息 |
| `Enter` | 发送消息 |
| `Escape` | 停止生成 |
| `@` | 引用 Vault 笔记 |
| `/` | 斜杠命令 |

### 开发

```bash
npm install
npm run dev      # 监听模式
npm run build    # 生产构建
npm run check    # TypeScript 严格检查
```

---

## License / 许可证

MIT
