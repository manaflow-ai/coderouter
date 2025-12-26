# coderouter

CLI for running Claude Code on GLM-4.7, MiniMax M2.1, Kimi K2, AWS Bedrock, GCP Vertex, and more.

```bash
cr claude.glm "fix the tests"
cr claude.aws --dangerously-skip-permissions
cr claude.vertex
```

## Install

```bash
npm install -g coderouter
```

## Usage

```bash
cr claude.glm           # Z.AI GLM-4.7
cr claude.minimax       # MiniMax M2.1
cr claude.kimi          # Moonshot Kimi K2
cr claude.aws           # AWS Bedrock
cr claude.vertex        # Google Cloud Vertex AI
cr claude.azure         # Microsoft Azure Foundry
cr claude.openrouter    # OpenRouter
```

Set up credentials:

```bash
cr auth claude.glm      # prompts for API key, saves it
cr auth                 # list all auth targets
```

## Providers

| Provider | Command | Auth |
|----------|---------|------|
| AWS Bedrock | `cr claude.aws` | AWS credentials |
| GCP Vertex | `cr claude.vertex` | `gcloud auth login` + project ID |
| Azure Foundry | `cr claude.azure` | `az login` or API key |
| Z.AI GLM-4.7 | `cr claude.glm` | API key from [z.ai](https://z.ai/manage-apikey/apikey-list) |
| MiniMax M2.1 | `cr claude.minimax` | API key from [minimax.io](https://platform.minimax.io/user-center/basic-information/interface-key) |
| Kimi K2 | `cr claude.kimi` | API key from [moonshot.cn](https://platform.moonshot.cn/console/api-keys) |
| OpenRouter | `cr claude.openrouter` | API key from [openrouter.ai](https://openrouter.ai/settings/keys) |

## How it works

`cr claude.aws` sets `CLAUDE_CODE_USE_BEDROCK=1` and runs `claude`. That's it.

Config at `~/.config/coderouter/config.json`.

## License

MIT
