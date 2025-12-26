import type { Scaffold, BuiltinVariant } from "./types.ts";

// Built-in variants organized by scaffold
export const builtinVariants: Record<Scaffold, Record<string, BuiltinVariant>> = {
  claude: {
    aws: {
      name: "aws",
      description: "AWS Bedrock with Opus",
      env: {
        CLAUDE_CODE_USE_BEDROCK: "1",
        AWS_REGION: "us-west-1",
        ANTHROPIC_MODEL: "global.anthropic.claude-opus-4-5-20251101-v1:0",
        ANTHROPIC_SMALL_FAST_MODEL: "us.anthropic.claude-haiku-4-5-20251001-v1:0",
      },
      // AWS SDK handles auth via ~/.aws/credentials, env vars, or IAM roles
    },
    vertex: {
      name: "vertex",
      description: "Google Cloud Vertex AI (Opus)",
      env: {
        CLAUDE_CODE_USE_VERTEX: "1",
        CLOUD_ML_REGION: "global",
        ANTHROPIC_MODEL: "claude-opus-4-5@20251101",
        ANTHROPIC_SMALL_FAST_MODEL: "claude-haiku-4-5@20251001",
      },
      // GCP SDK handles auth via gcloud auth or service account
      requiredEnvVars: ["ANTHROPIC_VERTEX_PROJECT_ID"],
    },
    glm: {
      name: "glm",
      description: "Z.AI GLM models (GLM-4.7)",
      env: {
        ANTHROPIC_BASE_URL: "https://api.z.ai/api/anthropic",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "glm-4.7",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "glm-4.7",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "glm-4.5-air",
      },
      requiredEnvVars: ["ANTHROPIC_AUTH_TOKEN"],
    },
    minimax: {
      name: "minimax",
      description: "MiniMax M2.1",
      env: {
        ANTHROPIC_BASE_URL: "https://api.minimax.io/anthropic",
        ANTHROPIC_MODEL: "MiniMax-M2.1",
        ANTHROPIC_SMALL_FAST_MODEL: "MiniMax-M2.1",
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
        API_TIMEOUT_MS: "3000000",
      },
      requiredEnvVars: ["ANTHROPIC_AUTH_TOKEN"],
    },
    openrouter: {
      name: "openrouter",
      description: "OpenRouter API",
      env: {
        ANTHROPIC_BASE_URL: "https://openrouter.ai/api/v1",
      },
      requiredEnvVars: ["ANTHROPIC_API_KEY"],
    },
    azure: {
      name: "azure",
      description: "Microsoft Azure Foundry",
      env: {
        CLAUDE_CODE_USE_FOUNDRY: "1",
      },
      // Auth via ANTHROPIC_FOUNDRY_API_KEY or `az login` (Entra ID)
      requiredEnvVars: ["ANTHROPIC_FOUNDRY_RESOURCE"],
    },
    kimi: {
      name: "kimi",
      description: "Moonshot Kimi K2",
      env: {
        ANTHROPIC_BASE_URL: "https://api.moonshot.ai/anthropic",
        ANTHROPIC_MODEL: "kimi-k2-thinking-turbo",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "kimi-k2-thinking-turbo",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "kimi-k2-thinking-turbo",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "kimi-k2-thinking-turbo",
        CLAUDE_CODE_SUBAGENT_MODEL: "kimi-k2-thinking-turbo",
      },
      requiredEnvVars: ["ANTHROPIC_AUTH_TOKEN"],
    },
  },

  opencode: {
    omoc: {
      name: "omoc",
      description: "oh-my-opencode",
      env: {},
      xdgConfigSubdir: "opencode-omoc",
    },
  },

  codex: {},

  gemini: {
    pro: {
      name: "pro",
      description: "Gemini Pro model",
      env: {
        GEMINI_MODEL: "gemini-2.5-pro",
      },
    },
    flash: {
      name: "flash",
      description: "Gemini Flash model",
      env: {
        GEMINI_MODEL: "gemini-2.5-flash",
      },
    },
  },
};

// Scaffolds that are valid entry points
export const SCAFFOLDS: Scaffold[] = ["claude", "opencode", "codex", "gemini"];

// Check if a string is a valid scaffold
export function isScaffold(s: string): s is Scaffold {
  return SCAFFOLDS.includes(s as Scaffold);
}
