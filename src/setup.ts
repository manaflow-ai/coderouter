import * as p from "@clack/prompts";
import { saveVariant } from "./config.ts";
import type { Scaffold, UserVariant } from "./types.ts";
import { builtinVariants, SCAFFOLDS } from "./presets.ts";

interface ProviderTemplate {
  name: string;
  fields: Array<{
    key: string;
    label: string;
    default: string;
    secret?: boolean;
  }>;
  staticEnv: Record<string, string>;
}

// Provider templates for claude scaffold
const CLAUDE_PROVIDERS: Record<string, ProviderTemplate> = {
  aws: {
    name: "AWS Bedrock",
    fields: [
      { key: "ANTHROPIC_MODEL", label: "Model", default: "us.anthropic.claude-sonnet-4-20250514-v1:0" },
      { key: "ANTHROPIC_SMALL_FAST_MODEL", label: "Small/Fast Model", default: "us.anthropic.claude-haiku-4-5-20251001-v1:0" },
    ],
    staticEnv: { CLAUDE_CODE_USE_BEDROCK: "1" },
  },
  vertex: {
    name: "Google Cloud Vertex AI",
    fields: [
      { key: "CLOUD_ML_REGION", label: "Region", default: "us-east5" },
      { key: "ANTHROPIC_MODEL", label: "Model", default: "claude-sonnet-4@20250514" },
      { key: "ANTHROPIC_SMALL_FAST_MODEL", label: "Small/Fast Model", default: "claude-haiku-4@20250514" },
    ],
    staticEnv: { CLAUDE_CODE_USE_VERTEX: "1" },
  },
  anthropic: {
    name: "Anthropic Direct",
    fields: [
      { key: "ANTHROPIC_API_KEY", label: "API Key", default: "", secret: true },
      { key: "ANTHROPIC_MODEL", label: "Model", default: "claude-sonnet-4-20250514" },
    ],
    staticEnv: {},
  },
  glm: {
    name: "Z.AI (GLM)",
    fields: [
      { key: "ANTHROPIC_API_KEY", label: "API Key", default: "", secret: true },
      { key: "ANTHROPIC_MODEL", label: "Model", default: "glm-4-plus" },
    ],
    staticEnv: { ANTHROPIC_BASE_URL: "https://open.z.ai/api/v1" },
  },
  openrouter: {
    name: "OpenRouter",
    fields: [
      { key: "OPENROUTER_API_KEY", label: "API Key", default: "", secret: true },
      { key: "ANTHROPIC_MODEL", label: "Model", default: "anthropic/claude-sonnet-4" },
    ],
    staticEnv: { ANTHROPIC_BASE_URL: "https://openrouter.ai/api/v1" },
  },
};

export async function runSetup(scaffold?: Scaffold, variantName?: string): Promise<void> {
  p.intro("coderouter setup");

  // If no scaffold specified, ask
  let targetScaffold: Scaffold;
  if (scaffold) {
    targetScaffold = scaffold;
  } else {
    const selected = await p.select({
      message: "Select scaffold",
      options: SCAFFOLDS.map((s) => ({
        value: s,
        label: s,
        hint: s === "claude" ? "Claude Code CLI" :
              s === "opencode" ? "OpenCode CLI" :
              s === "codex" ? "OpenAI Codex CLI" :
              "Google Gemini CLI",
      })),
    });

    if (p.isCancel(selected)) {
      p.cancel("setup cancelled");
      process.exit(0);
    }
    targetScaffold = selected as Scaffold;
  }

  // Handle different scaffolds
  if (targetScaffold === "claude") {
    await setupClaude(variantName);
  } else if (targetScaffold === "opencode") {
    await setupOpencode();
  } else if (targetScaffold === "codex") {
    p.note("codex uses your ChatGPT login or OPENAI_API_KEY.\nNo additional setup needed.");
    p.outro("run with: cr codex");
  } else if (targetScaffold === "gemini") {
    await setupGemini(variantName);
  }
}

async function setupClaude(suggestedVariant?: string): Promise<void> {
  const provider = await p.select({
    message: "Select provider",
    options: Object.entries(CLAUDE_PROVIDERS).map(([value, { name }]) => ({
      value,
      label: name,
    })),
    initialValue: suggestedVariant,
  });

  if (p.isCancel(provider)) {
    p.cancel("setup cancelled");
    process.exit(0);
  }

  const template = CLAUDE_PROVIDERS[provider as string];
  const env: Record<string, string> = { ...template.staticEnv };

  for (const field of template.fields) {
    const value = await p.text({
      message: field.label,
      placeholder: field.default,
      defaultValue: field.default,
    });

    if (p.isCancel(value)) {
      p.cancel("setup cancelled");
      process.exit(0);
    }

    if (value) {
      env[field.key] = value;
    }
  }

  const variant: UserVariant = {
    description: template.name,
    env,
  };

  await saveVariant(`claude.${provider}`, variant);
  p.outro(`saved! run with: cr claude.${provider}`);
}

async function setupOpencode(): Promise<void> {
  p.note(
    "opencode handles provider switching internally.\n" +
    "coderouter manages vanilla vs oh-my-opencode.\n\n" +
    "  cr opencode      -> vanilla opencode\n" +
    "  cr opencode.omoc -> oh-my-opencode"
  );

  const hasOmoc = await p.confirm({
    message: "Do you have oh-my-opencode installed?",
    initialValue: false,
  });

  if (p.isCancel(hasOmoc)) {
    p.cancel("setup cancelled");
    process.exit(0);
  }

  if (!hasOmoc) {
    p.note("Install oh-my-opencode:\n  bunx oh-my-opencode install");
  }

  p.outro("run with: cr opencode or cr opencode.omoc");
}

async function setupGemini(suggestedVariant?: string): Promise<void> {
  const model = await p.select({
    message: "Select model",
    options: [
      { value: "", label: "default", hint: "uses GEMINI_MODEL or gemini default" },
      { value: "pro", label: "pro", hint: "gemini-2.5-pro" },
      { value: "flash", label: "flash", hint: "gemini-2.5-flash" },
    ],
    initialValue: suggestedVariant || "",
  });

  if (p.isCancel(model)) {
    p.cancel("setup cancelled");
    process.exit(0);
  }

  if (model) {
    const variant: UserVariant = {
      description: `Gemini ${model}`,
      env: {
        GEMINI_MODEL: model === "pro" ? "gemini-2.5-pro" : "gemini-2.5-flash",
      },
    };
    await saveVariant(`gemini.${model}`, variant);
    p.outro(`saved! run with: cr gemini.${model}`);
  } else {
    p.outro("run with: cr gemini");
  }
}

// Quick setup prompt when user tries to run unconfigured variant
export async function promptSetup(scaffold: Scaffold, variant: string): Promise<boolean> {
  console.log();
  console.log(`\x1b[33mclaude.${variant}\x1b[0m is not configured.`);
  console.log();

  const shouldSetup = await p.confirm({
    message: `Set up ${scaffold}.${variant} now?`,
    initialValue: true,
  });

  if (p.isCancel(shouldSetup) || !shouldSetup) {
    console.log();
    console.log("run \x1b[36mcr setup\x1b[0m to configure later.");
    return false;
  }

  await runSetup(scaffold, variant);
  return true;
}
