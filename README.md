<h1 align="center">coderouter</h1>

CLI for running Claude Code with GLM-4.7, MiniMax M2.1, Kimi K2, AWS Bedrock, GCP Vertex, and more.

[![asciicast](https://asciinema.org/a/5jbd3mcxfZZJnFHR7niaprleI.svg)](https://asciinema.org/a/5jbd3mcxfZZJnFHR7niaprleI)

No more juggling environment variables or hot swapping `~/.claude/settings.json` just to switch providers.

```bash
cr claude.glm "fix the tests"       # runs glm-4.7
cr claude.minimax                   # runs MiniMax-M2.1
cr claude.aws                       # runs claude-opus-4-5 on Bedrock
```

## Install

```bash
npm install -g coderouter
```

## Usage

```bash
cr auth claude.glm                                  # prompts for API key, saves it
cr claude.glm "fix the tests"                       # run with prompt
cr claude.glm --dangerously-skip-permissions        # all claude flags work
```

```bash
cr claude.glm           # Z.AI GLM-4.7
cr claude.minimax       # MiniMax M2.1
cr claude.kimi          # Moonshot Kimi K2
cr claude.aws           # AWS Bedrock
cr claude.vertex        # Google Cloud Vertex AI
cr claude.azure         # Microsoft Azure Foundry
cr claude.openrouter    # OpenRouter
```

## Providers

| Provider | Command | Auth |
|----------|---------|------|
| Z.AI GLM-4.7 | `cr claude.glm` | API key from [z.ai](https://z.ai/manage-apikey/apikey-list) |
| MiniMax M2.1 | `cr claude.minimax` | API key from [minimax.io](https://platform.minimax.io/user-center/basic-information/interface-key) |
| Kimi K2 | `cr claude.kimi` | API key from [moonshot.cn](https://platform.moonshot.cn/console/api-keys) |
| OpenRouter | `cr claude.openrouter` | `cr auth claude.openrouter` |
| AWS Bedrock | `cr claude.aws` | AWS credentials |
| GCP Vertex | `cr claude.vertex` | `gcloud auth login` + project ID |
| Azure Foundry | `cr claude.azure` | `az login` or API key |

## OpenCode

Switch between vanilla opencode and [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode):

```bash
cr opencode             # vanilla opencode
cr opencode.omoc        # oh-my-opencode
```

Each uses a separate config directory (`~/.config/coderouter/opencode-vanilla/` and `~/.config/coderouter/opencode-omoc/`).

## How it works

All flags pass through to the underlying CLI:

```bash
cr claude.glm "fix the tests" --dangerously-skip-permissions --model sonnet -p
# runs: claude "fix the tests" --dangerously-skip-permissions --model sonnet -p
```

Each command sets env vars and runs `claude`:

```bash
# cr claude.aws
CLAUDE_CODE_USE_BEDROCK=1
AWS_REGION=us-west-1
ANTHROPIC_MODEL=global.anthropic.claude-opus-4-5-20251101-v1:0
ANTHROPIC_SMALL_FAST_MODEL=us.anthropic.claude-haiku-4-5-20251001-v1:0

# cr claude.vertex
CLAUDE_CODE_USE_VERTEX=1
CLOUD_ML_REGION=global
ANTHROPIC_MODEL=claude-opus-4-5@20251101
ANTHROPIC_SMALL_FAST_MODEL=claude-haiku-4-5@20251001

# cr claude.glm
ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
ANTHROPIC_DEFAULT_OPUS_MODEL=glm-4.7
ANTHROPIC_DEFAULT_SONNET_MODEL=glm-4.7
ANTHROPIC_DEFAULT_HAIKU_MODEL=glm-4.5-air

# cr claude.minimax
ANTHROPIC_BASE_URL=https://api.minimax.io/anthropic
ANTHROPIC_MODEL=MiniMax-M2.1
ANTHROPIC_SMALL_FAST_MODEL=MiniMax-M2.1
CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
API_TIMEOUT_MS=3000000

# cr claude.kimi
ANTHROPIC_BASE_URL=https://api.moonshot.ai/anthropic
ANTHROPIC_MODEL=kimi-k2-thinking-turbo

# cr claude.openrouter
ANTHROPIC_BASE_URL=https://openrouter.ai/api

# cr claude.azure
CLAUDE_CODE_USE_FOUNDRY=1
```

Config at `~/.config/coderouter/config.json`.

## License

MIT
