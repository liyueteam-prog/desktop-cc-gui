<div align="center">

# 如愿AI 客户端

<img width="120" alt="如愿AI 图标" src="./public/app-icon.png" />

[English](./README.md) · **简体中文**

</div>

**如愿AI 客户端** 是基于 `desktop-cc-gui` 包装的多引擎 AI 编程桌面客户端。它把 Claude Code、Codex CLI、Kimi CLI、Grok CLI、Pi CLI、OMP CLI、DeepSeek Harness（DSH）等命令行 AI 编程 runtime 放进一个统一图形界面里，并内置 **如愿AI** 渠道预设，让用户可以直接粘贴自己的如愿AI API Key 使用。

> 安全提醒：请只填写你自己的 API Key；不要把 API Key 提交到代码、截图、聊天记录或公开仓库中。本项目不会内置任何真实密钥。

---

## 如愿AI API Key 使用方式

1. 打开 [www.dayueai.fun](https://www.dayueai.fun/sign-up)，注册或登录如愿AI账号。
2. 进入 [令牌/API Key 页面](https://www.dayueai.fun/keys/?source=ruyuan-desktop)，创建并复制自己的 API Key。
3. 打开桌面客户端，进入 **设置 → 对应引擎供应商/渠道**。
4. 点击 **添加渠道 / 添加供应商**，选择 **如愿AI** 预设。
5. API URL 会自动填好；粘贴 API Key，保存后即可在新会话里调用如愿AI兼容接口。

当前内置的如愿AI兼容端点：

| 引擎/渠道 | API URL | 默认模型 | 协议 |
| --- | --- | --- | --- |
| Claude Code | `https://www.dayueai.fun` | `claude-sonnet-4-6` | Anthropic compatible (`/v1/messages`) |
| Codex CLI | `https://www.dayueai.fun/v1` | `claude-sonnet-4-6` | OpenAI Chat compatible |
| Kimi CLI | `https://www.dayueai.fun/v1` | `kimi-k3` | OpenAI compatible |
| Grok CLI | `https://www.dayueai.fun/v1` | `grok-build` | OpenAI compatible |

如愿AI用户通常不需要手动填写 API URL；选择预设后只需要粘贴 API Key。客户端会在 API Key 输入区域提供「去创建 API Key」入口，直接跳转到 www.dayueai.fun 的令牌页面。

---

## 能做什么

- **多引擎统一入口**：Claude Code、Codex CLI、Kimi CLI、Grok CLI、Pi/OMP、DSH 等统一在一个桌面应用里使用。
- **如愿AI预设**：Claude / Codex / Kimi / Grok 渠道内置如愿AI，减少用户配置成本。
- **代码对话体验**：流式输出、思考过程、工具调用、Git diff、终端命令结果都能在界面内查看。
- **项目工作台**：文件树、内置终端、Git 面板、命令面板、会话历史和工作区管理。
- **本机存储**：供应商配置保存在本应用中；请妥善保管本机和 API Key。
- **跨平台**：基于 Tauri 2 + React 18 + TypeScript + Rust，支持 Windows / macOS / Linux。

---

## 本地开发

```bash
pnpm install
pnpm dev
```

前端类型检查和构建：

```bash
pnpm build
```

桌面安装包构建请参考 Tauri 2 的平台签名与打包要求。

---

## 目录结构

```text
desktop-cc-gui/
├── src/                    # React 前端
├── src/features/settings/  # 供应商预设、设置页
├── src-tauri/              # Tauri / Rust 原生能力
├── public/                 # 前端静态资源与应用图标
├── packages/plugin-sdk/    # 插件 SDK
└── docs/                   # 开发文档
```

---

## 品牌与配置说明

本包装版本已将用户可见品牌改为 **如愿AI**，包括：

- 应用标题、侧栏品牌、关于页名称
- Tauri `productName` / 应用 identifier
- 如愿AI应用图标
- Claude / Codex / Kimi / Grok 的如愿AI供应商预设
- 新建 Claude / Codex 渠道时默认优先使用如愿AI配置

如果需要替换成新的正式 Logo，只需替换 `public/app-icon.png` 和 `src-tauri/icons/` 下各尺寸图标，并重新构建即可。

---

## License

本项目基于原开源项目改造，遵循仓库内 `LICENSE` 文件。
