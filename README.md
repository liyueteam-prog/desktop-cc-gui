<div align="center">

# RuYuanAI Desktop Client

<img width="120" alt="RuYuanAI icon" src="./public/app-icon.png" />

**English** · [简体中文](./README.zh-CN.md)

</div>

**RuYuanAI Desktop Client** is a RuYuanAI-branded packaging of `desktop-cc-gui`, a multi-engine AI coding desktop client. It puts Claude Code, Codex CLI, Kimi CLI, Grok CLI, Pi CLI, OMP CLI, DeepSeek Harness (DSH), and other CLI runtimes into one GUI, with built-in **RuYuanAI** provider presets so users can paste their own RuYuanAI API key and start working.

> Security note: use only your own API key. Never commit API keys to code, screenshots, chat logs, or public repositories. This project does not embed any real key.

---

## Use a RuYuanAI API key

1. Open [www.dayueai.fun](https://www.dayueai.fun/sign-up), then register or sign in.
2. Go to the [Keys page](https://www.dayueai.fun/keys/?source=ruyuan-desktop), create an API key, and copy it.
3. Open the desktop client and go to **Settings → provider/channel settings for the engine**.
4. Click **Add channel / Add provider**, then select the **RuYuanAI** preset.
5. The API URL is prefilled. Paste the API key, save, then select the corresponding engine in a new session.

Built-in RuYuanAI compatible endpoints:

| Engine / channel | API URL | Default model | Protocol |
| --- | --- | --- | --- |
| Claude Code | `https://www.dayueai.fun` | `claude-sonnet-4-6` | Anthropic compatible (`/v1/messages`) |
| Codex CLI | `https://www.dayueai.fun/v1` | `claude-sonnet-4-6` | OpenAI Chat compatible |
| Kimi CLI | `https://www.dayueai.fun/v1` | `kimi-k3` | OpenAI compatible |
| Grok CLI | `https://www.dayueai.fun/v1` | `grok-build` | OpenAI compatible |

Most RuYuanAI users do not need to type the API URL manually; select the preset and paste the API key. The client shows a Create API Key shortcut next to the API key field and opens the Keys page at www.dayueai.fun.

---

## Features

- **One GUI for multiple engines**: Claude Code, Codex CLI, Kimi CLI, Grok CLI, Pi/OMP, DSH, and more.
- **RuYuanAI presets**: built-in RuYuanAI channels for Claude, Codex, Kimi, and Grok.
- **Coding-focused chat**: streaming output, thinking traces, tool calls, Git diff views, and terminal results.
- **Developer workspace**: file tree, integrated terminal, Git panel, command palette, session history, and workspace management.
- **Local storage**: provider configs are stored by the app; keep your machine and API key safe.
- **Cross-platform**: built with Tauri 2, React 18, TypeScript, and Rust for Windows / macOS / Linux.

---

## Local development

```bash
pnpm install
pnpm dev
```

Type-check and build the frontend:

```bash
pnpm build
```

Desktop installers require the normal Tauri 2 signing and packaging setup for each platform.

---

## Branding notes

This packaging changes the user-facing brand to **RuYuanAI**, including the app title, sidebar brand, About page, Tauri product name, icon assets, and provider presets.

To replace the logo, update `public/app-icon.png` and the images under `src-tauri/icons/`, then rebuild.

---

## License

This project is adapted from the upstream open-source project and follows the repository `LICENSE` file.
