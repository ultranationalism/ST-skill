---
name: st-card-debug
description: 通过 Chrome DevTools MCP + ST REST API 端到端调试角色卡。当用户要求调试卡片、测试卡片、导入卡到 ST、查看卡渲染效果、ST 端到端测试时使用。
---

# SillyTavern 卡片端到端调试 Skill

通过 MCP (Chrome DevTools) + ST REST API 实现角色卡的端到端调试：启动 ST → 导入卡片 → 浏览器打开 → 交互验证 → 查看日志。

## 触发条件

用户要求：调试卡片、测试卡片、端到端测试、导入卡到 ST、查看卡渲染效果、ST 调试。

## 前置条件

### 1. 用户必须完成的手动配置

以下操作无法自动化，**必须提醒用户手动完成**：

- **配置 API 连接**：在 ST 界面中配置至少一个 API（如 OpenRouter、OpenAI 等），填入 API Key
- **勾选"自动连接到上次使用的 API"**：ST 设置 → API Connections → 勾选 auto-connect。否则每次刷新页面后都是断开状态，前端卡的 AI 调用无法工作
- **开启代码块渲染器**：ST 用户设置 → 勾选「启用渲染器」（完全前端卡依赖此功能在 iframe 中执行 JS）

> **为什么需要提醒用户？** 端到端调试的核心是验证 AI 调用链路是否畅通。如果 API 未连接或渲染器未开启，调试无法覆盖完整链路。

### 2. 自动化前置检查

```bash
# 检查 ST 是否运行
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/

# 如果未运行，启动 ST 并将日志导出到文件
cd /path/to/SillyTavern && nohup node server.js --port 8000 > /tmp/st.log 2>&1 &
```

## ST REST API：卡片导入

SillyTavern 的 API 有 CSRF 保护，所有写操作需要两步认证。

### 认证流程

```bash
# 第一步：获取 session cookie
curl -s -c /tmp/st_cookie -b /tmp/st_cookie http://localhost:8000/ > /dev/null

# 第二步：获取 CSRF token
CSRF=$(curl -s -c /tmp/st_cookie -b /tmp/st_cookie http://localhost:8000/csrf-token | jq -r '.token')
```

之后所有请求都需要携带 cookie 和 CSRF header：
```bash
curl -b /tmp/st_cookie -H "X-CSRF-Token: $CSRF" ...
```

### 导入 JSON 格式角色卡

```bash
# 导入 card.json（V2 Spec）
curl -s -b /tmp/st_cookie \
  -H "X-CSRF-Token: $CSRF" \
  -F "avatar=@card.json;type=application/json" \
  -F "file_type=json" \
  http://localhost:8000/api/characters/import
```

### 导入 PNG 格式角色卡

```bash
curl -s -b /tmp/st_cookie \
  -H "X-CSRF-Token: $CSRF" \
  -F "avatar=@character.png;type=image/png" \
  -F "file_type=png" \
  http://localhost:8000/api/characters/import
```

### 导入 CHARX 格式角色卡

```bash
curl -s -b /tmp/st_cookie \
  -H "X-CSRF-Token: $CSRF" \
  -F "avatar=@character.charx;type=application/zip" \
  -F "file_type=charx" \
  http://localhost:8000/api/characters/import
```

### 列出所有角色卡

```bash
curl -s -b /tmp/st_cookie \
  -H "X-CSRF-Token: $CSRF" \
  -H "Content-Type: application/json" \
  -X POST http://localhost:8000/api/characters/all -d '{}'
```

返回 JSON 数组，每个元素包含 `name`、`avatar`、`description` 等字段。

### 导入响应

成功时返回：
```json
{"file_name": "CharacterName.png"}
```

## Chrome DevTools MCP：浏览器端调试

使用 MCP 工具与 ST 浏览器界面交互，实现可视化调试。

### 核心工作流

```
1. navigate_page → 打开 ST (http://localhost:8000/)
2. take_screenshot → 确认页面已加载、API 已连接
3. take_snapshot → 获取页面元素 uid
4. click(uid) → 点击角色卡进入聊天
5. take_screenshot → 查看卡片渲染效果
6. list_console_messages → 检查 JS 错误和日志
```

### 步骤详解

#### 导航到 ST

```
mcp__chrome-devtools__navigate_page(type: "url", url: "http://localhost:8000/")
```

刷新页面（如需触发自动连接）：
```
mcp__chrome-devtools__navigate_page(type: "reload")
```

#### 截图验证

```
mcp__chrome-devtools__take_screenshot()
```

检查要点：
- 底部是否显示输入框（"Type a message"）→ 说明 API 已连接
- 如果显示 "Not connected to API" → 提醒用户配置 API 并勾选自动连接

#### 获取页面元素

```
mcp__chrome-devtools__take_snapshot()
```

返回带 uid 的 a11y 树，用于定位可点击元素（角色卡头像、按钮等）。

#### 点击角色卡

从 snapshot 中找到角色卡的 image 或 text 元素 uid，然后：
```
mcp__chrome-devtools__click(uid: "1_19")
```

等待 2 秒后截图查看渲染效果。

#### 卡内交互

对于完全前端卡，可以点击卡内的按钮：
1. `take_snapshot()` 获取 iframe 内元素的 uid
2. `click(uid)` 点击按钮
3. `take_screenshot()` 查看交互结果

#### 检查控制台日志

```
mcp__chrome-devtools__list_console_messages(types: ["error", "warn"])
```

常见问题诊断：
- `[object Event]` 加载失败 → 构建产物路径错误（检查 import depth）
- `TavernHelper is not defined` → 不在 iframe 环境中（检查渲染器是否开启）
- CORS 错误 → 自定义 API 端点的跨域问题
- 401/403 → API Key 无效或过期

#### 在控制台执行脚本

```
mcp__chrome-devtools__evaluate_script(expression: "document.querySelector('#chat .mes').textContent")
```

可用于读取卡片状态、检查 DOM 结构等。

## 服务端日志

ST 启动时将日志导出到文件后，可以实时查看：

```bash
# 查看最新日志
tail -50 /tmp/st.log

# 实时跟踪
tail -f /tmp/st.log
```

服务端日志包含：API 请求路由、扩展加载、文件操作等信息。

## 端到端调试完整流程

### 首次调试清单

```
□ 提醒用户：配置 API Key + 勾选自动连接 + 开启代码块渲染器
□ 启动 ST（日志导出到 /tmp/st.log）
□ 通过 REST API 导入卡片
□ MCP navigate 到 ST
□ 截图确认 API 已自动连接（底部有输入框）
□ 点击角色卡进入聊天
□ 截图验证渲染效果
□ 检查 console 有无错误
□ 测试卡内交互（点击按钮等）
□ 如果卡有 AI 调用，发送消息验证 AI 链路
```

### 调试卡片更新

卡片修改后重新导入的流程：

```bash
# 1. 构建卡片
cd cards/my-card && npm run build

# 2. 重新获取 CSRF（token 可能过期）
curl -s -c /tmp/st_cookie -b /tmp/st_cookie http://localhost:8000/ > /dev/null
CSRF=$(curl -s -c /tmp/st_cookie -b /tmp/st_cookie http://localhost:8000/csrf-token | jq -r '.token')

# 3. 重新导入（会覆盖同名卡片）
curl -s -b /tmp/st_cookie \
  -H "X-CSRF-Token: $CSRF" \
  -F "avatar=@dist/card.json;type=application/json" \
  -F "file_type=json" \
  http://localhost:8000/api/characters/import

# 4. MCP 刷新页面查看效果
```

然后在浏览器端：
```
navigate_page(type: "reload") → take_screenshot() → 验证更新
```

### 常见问题排查

| 现象 | 原因 | 解决方案 |
|---|---|---|
| "Not connected to API" | 未配置 API 或未勾选自动连接 | 提醒用户手动配置 |
| 卡导入 403 | CSRF token 过期 | 重新获取 cookie + token |
| 前端卡显示源码不渲染 | 未开启代码块渲染器 | 提醒用户开启 |
| 扩展加载失败 `[object Event]` | JS 构建产物 import 路径错误 | 检查 `ST_IMPORT_DEPTH` |
| 卡内按钮无响应 | DOMPurify 剥离了 script | 确认 HTML 包裹在 ` ```html ` 代码块中 |
| AI 调用超时 | API 未连接或 Key 无效 | 检查 API 连接状态 |
