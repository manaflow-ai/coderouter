# coderouter

```
cr claude.aws --dangerously-skip-permissions "fix the tests"
```

Route between AI coding CLIs. One command, any provider.

---

## The Problem

You have claude, opencode, codex, gemini installed. Each needs different env vars for different providers. AWS Bedrock wants `CLAUDE_CODE_USE_BEDROCK=1`. Vertex wants `CLAUDE_CODE_USE_VERTEX=1`. OpenRouter wants `ANTHROPIC_BASE_URL`. You're tired of shell aliases and `.envrc` files scattered everywhere.

## The Solution

```bash
cr <scaffold>.<variant> [args...]
```

That's it. coderouter injects the right env vars and runs the command. All your args pass through untouched.

---

## Install

```bash
npm install -g coderouter
```

The CLIs themselves (claude, opencode, codex, gemini) are not included - install them separately.

---

## Usage

### Claude Code

```bash
cr claude.aws           # AWS Bedrock
cr claude.vertex        # Google Cloud Vertex AI
cr claude.azure         # Microsoft Azure Foundry
cr claude.glm           # Z.AI GLM-4.7
cr claude.minimax       # MiniMax M2.1
cr claude.kimi          # Moonshot Kimi K2
cr claude.openrouter    # OpenRouter
cr claude               # No env injection, just run claude
```

Pass any flags through:

```bash
cr claude.aws --dangerously-skip-permissions
cr claude.vertex --model claude-opus-4-20250514
cr claude.glm "refactor the auth module"
```

### OpenCode

coderouter manages vanilla vs [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode) via separate config directories:

```bash
cr opencode        # vanilla opencode
cr opencode.omoc   # oh-my-opencode
```

### Codex

```bash
cr codex           # just runs codex
```

### Gemini

```bash
cr gemini          # default model
cr gemini.pro      # gemini-2.5-pro
cr gemini.flash    # gemini-2.5-flash
```

---

## Variants

| Target | What it does | Required env var |
|--------|-------------|------------------|
| `claude.aws` | AWS Bedrock with Opus 4.5 | AWS credentials |
| `claude.vertex` | Google Cloud Vertex AI (Opus) | `ANTHROPIC_VERTEX_PROJECT_ID` |
| `claude.azure` | Microsoft Azure Foundry | `ANTHROPIC_FOUNDRY_RESOURCE` |
| `claude.glm` | Z.AI GLM-4.7 | `ANTHROPIC_AUTH_TOKEN` |
| `claude.minimax` | MiniMax M2.1 | `ANTHROPIC_AUTH_TOKEN` |
| `claude.kimi` | Moonshot Kimi K2 | `ANTHROPIC_AUTH_TOKEN` |
| `claude.openrouter` | OpenRouter API | `ANTHROPIC_API_KEY` |
| `opencode.omoc` | oh-my-opencode (via XDG_CONFIG_HOME) | - |
| `gemini.pro` | Gemini Pro model | - |
| `gemini.flash` | Gemini Flash model | - |

---

## Commands

```bash
cr auth           # List auth targets
cr auth <target>  # Set up API key for a target
cr setup          # Interactive setup wizard
cr list           # Show all scaffolds and variants
cr --help         # Usage info
```

---

## Config

User config lives at `~/.config/coderouter/config.json`. Override built-in variants or add your own.

OpenCode configs are managed at:
- `~/.config/coderouter/opencode-vanilla/`
- `~/.config/coderouter/opencode-omoc/`

---

## How It Works

1. Parse `scaffold.variant` from first arg
2. Look up variant config (builtin or user-defined)
3. Inject env vars
4. Spawn the scaffold CLI with remaining args
5. Pass through stdio, exit with same code

For opencode, we set `XDG_CONFIG_HOME` to switch between vanilla and oh-my-opencode configs. The opencode binary is the same - only the config directory changes.

---

## Why

Because `export CLAUDE_CODE_USE_BEDROCK=1 && claude` gets old fast.

Because you want to test the same prompt against AWS, Vertex, and direct API without three terminal tabs.

Because your `.zshrc` shouldn't be 200 lines of AI CLI aliases.

---

## License

MIT
