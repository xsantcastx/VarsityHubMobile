# VarsityHub — Skills & Plugins

## Currently Enabled

| Plugin                              | Status  | Useful?                                            |
| ----------------------------------- | ------- | -------------------------------------------------- |
| `swift-lsp@claude-plugins-official` | Enabled | No — project is TypeScript/React Native, not Swift |

**Action needed:** Disable `swift-lsp` and enable the plugins below.

---

## Recommended Plugins to Install

Run `/claude install <plugin-name>` or enable via Claude Code settings.

### commit-commands

**Adds:** `/commit`, `/commit-push-pr` slash commands
**Why useful:** One-command commits with smart messages. Useful for quick OTA fix deploys.

### code-review

**Adds:** `/code-review` slash command
**Why useful:** Pre-push review of any diff, catches issues before they hit Railway auto-deploy.

### feature-dev

**Adds:** `/feature-dev` slash command + code-architect, code-explorer, code-reviewer agents
**Why useful:** Multi-agent feature planning for bigger additions (new onboarding step, new payment flow, etc.)

### claude-md-management

**Adds:** `/revise-claude-md` slash command
**Why useful:** Keeps `CLAUDE.md` up to date as the app evolves. Run after major feature releases, then mirror any shared product-fact changes into `AGENTS.md` so Claude and Codex stay aligned.

---

## Available Slash Commands (Built-in)

| Command    | What it does                           |
| ---------- | -------------------------------------- |
| `/help`    | Show all available commands            |
| `/clear`   | Clear conversation context             |
| `/compact` | Summarize conversation to save context |
| `/status`  | Show current session status            |
| `/memory`  | View/manage memory entries             |

---

## How to Update Settings

Settings file: `~/.claude/settings.json`

```json
{
  "permissions": {
    "allow": ["Bash(railway run:*)", "Bash(npm test:*)"]
  },
  "enabledPlugins": {
    "commit-commands@claude-plugins-official": true,
    "code-review@claude-plugins-official": true,
    "feature-dev@claude-plugins-official": true,
    "claude-md-management@claude-plugins-official": true
  }
}
```

---

## Permissions Already Granted

- `Bash(railway run:*)` — run local server commands via Railway CLI
- `Bash(npm test:*)` — run test suite

### Suggested additions

- `Bash(npx expo run:ios)` — approve dev client builds without prompt
- `Bash(npx expo run:android)` — same for Android
- `Bash(npx tsc --noEmit*)` — type-check without prompting

---

## MCP Servers (Not Configured)

MCP servers extend Claude Code with external tool access. None are configured.

**Potentially useful:**

- A Railway MCP server (if it exists) — would allow querying Railway logs directly in chat instead of opening the dashboard
