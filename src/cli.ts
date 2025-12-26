#!/usr/bin/env bun

import { getVariant, getAllVariants, ensureOpencodeConfig, CONFIG_FILE, saveAuth, getAuth } from "./config.ts";
import * as p from "@clack/prompts";
import { run } from "./runner.ts";
import { builtinVariants, isScaffold, SCAFFOLDS } from "./presets.ts";
import { runSetup } from "./setup.ts";
import type { Scaffold, ResolvedTarget } from "./types.ts";
import pkg from "../package.json";

const VERSION = pkg.version;

const HELP = `
\x1b[1mcoderouter\x1b[0m - run AI coding assistants with different configs

\x1b[1mUSAGE\x1b[0m
  cr <scaffold>[.variant] [args...]

\x1b[1mSCAFFOLDS\x1b[0m
  claude      Claude Code CLI
  opencode    OpenCode CLI
  codex       OpenAI Codex CLI
  gemini      Google Gemini CLI

\x1b[1mEXAMPLES\x1b[0m
  cr claude.aws --dangerously-skip-permissions
  cr claude.vertex "fix the tests"
  cr claude.glm
  cr opencode.omoc --resume
  cr opencode
  cr codex
  cr gemini.pro

\x1b[1mVARIANTS\x1b[0m
  claude.aws        AWS Bedrock (Opus)
  claude.vertex     Google Cloud Vertex AI
  claude.azure      Microsoft Azure Foundry
  claude.glm        Z.AI GLM-4.7
  claude.minimax    MiniMax M2.1
  claude.kimi       Moonshot Kimi K2
  claude.openrouter OpenRouter API
  opencode.omoc     oh-my-opencode
  gemini.pro        Gemini Pro model
  gemini.flash      Gemini Flash model

\x1b[1mCOMMANDS\x1b[0m
  cr auth <variant> Set up API key for a variant
  cr setup          Configure a scaffold
  cr list           List available scaffolds and variants
  cr --help         Show this help
  cr --version      Show version

\x1b[1mCONFIG\x1b[0m
  ${CONFIG_FILE}
`;

function parseTarget(input: string): { scaffold: Scaffold; variant: string | null } | null {
  const parts = input.split(".");
  const scaffold = parts[0];

  if (!isScaffold(scaffold)) {
    return null;
  }

  const variant = parts.length > 1 ? parts.slice(1).join(".") : null;
  return { scaffold, variant };
}

async function resolveTarget(
  scaffold: Scaffold,
  variant: string | null
): Promise<ResolvedTarget | null> {
  const env: Record<string, string> = {};
  let defaultArgs: string[] = [];
  let requiredEnvVars: string[] = [];

  if (scaffold === "opencode") {
    // Handle opencode specially - manage XDG_CONFIG_HOME
    const isOmoc = variant === "omoc";
    const xdgDir = await ensureOpencodeConfig(isOmoc ? "omoc" : "vanilla");
    env.XDG_CONFIG_HOME = xdgDir;

    return {
      scaffold,
      variant,
      command: "opencode",
      env,
      defaultArgs: [],
      requiredEnvVars: [],
    };
  }

  if (scaffold === "codex") {
    return {
      scaffold,
      variant: null,
      command: "codex",
      env: {},
      defaultArgs: [],
      requiredEnvVars: [],
    };
  }

  if (scaffold === "gemini") {
    if (variant) {
      const v = await getVariant("gemini", variant);
      if (v) {
        Object.assign(env, v.env);
        defaultArgs = v.defaultArgs || [];
        requiredEnvVars = v.requiredEnvVars || [];
      }
    }
    return {
      scaffold,
      variant,
      command: "gemini",
      env,
      defaultArgs,
      requiredEnvVars,
    };
  }

  // claude scaffold
  if (variant) {
    const v = await getVariant("claude", variant);
    if (!v) {
      return null; // variant not found
    }
    Object.assign(env, v.env);
    defaultArgs = v.defaultArgs || [];
    requiredEnvVars = v.requiredEnvVars || [];
  }

  return {
    scaffold,
    variant,
    command: "claude",
    env,
    defaultArgs,
    requiredEnvVars,
  };
}

// Help text for required env vars, keyed by "variant:envvar" or just "envvar"
const ENV_VAR_HELP: Record<string, string> = {
  // Variant-specific hints
  "glm:ANTHROPIC_AUTH_TOKEN": "Get from https://z.ai/manage-apikey/apikey-list",
  "minimax:ANTHROPIC_AUTH_TOKEN": "Get from https://platform.minimax.io/user-center/basic-information/interface-key",
  "kimi:ANTHROPIC_AUTH_TOKEN": "Get from https://platform.moonshot.cn/console/api-keys",
  "openrouter:ANTHROPIC_AUTH_TOKEN": "Get from https://openrouter.ai/settings/keys",
  "vertex:ANTHROPIC_VERTEX_PROJECT_ID": "Your GCP project ID (run: gcloud config get-value project)",

  // Generic fallbacks
  ANTHROPIC_AUTH_TOKEN: "Get from your provider's API key dashboard",
  ANTHROPIC_API_KEY: "Get from https://console.anthropic.com/settings/keys",
  ANTHROPIC_FOUNDRY_RESOURCE: "Your resource name from the Azure AI Foundry portal",
  ANTHROPIC_VERTEX_PROJECT_ID: "Your GCP project ID",
};

function getEnvVarHint(variant: string | null, envVar: string): string | null {
  // Try variant-specific first
  if (variant) {
    const specific = ENV_VAR_HELP[`${variant}:${envVar}`];
    if (specific) return specific;
  }
  // Fall back to generic
  return ENV_VAR_HELP[envVar] || null;
}

async function checkRequiredEnvVars(target: ResolvedTarget): Promise<string[]> {
  const missing: string[] = [];

  // Get auth for this target (uses glob matching)
  const fullTarget = target.variant
    ? `${target.scaffold}.${target.variant}`
    : target.scaffold;
  const auth = await getAuth(fullTarget);

  for (const key of target.requiredEnvVars) {
    // Check process.env first, then saved auth
    if (!process.env[key] && !auth[key]) {
      missing.push(key);
    }
  }
  return missing;
}

function printMissingEnvVarsError(scaffold: Scaffold, variant: string | null, missing: string[]): void {
  console.error(`\x1b[31mmissing required credentials\x1b[0m`);
  console.error();

  for (const key of missing) {
    const hint = getEnvVarHint(variant, key);
    console.error(`  \x1b[33m${key}\x1b[0m`);
    if (hint) {
      console.error(`  ${hint}`);
    }
    console.error();
  }

  console.error(`\x1b[1mTo fix, run:\x1b[0m`);
  console.error();
  console.error(`  cr auth ${scaffold}.${variant}`);
}

async function showAuthTargets(): Promise<void> {
  console.log("\x1b[1mAuth targets:\x1b[0m\n");

  for (const scaffold of SCAFFOLDS) {
    const variants = await getAllVariants(scaffold);

    for (const [name, variant] of Object.entries(variants)) {
      if (variant.requiredEnvVars && variant.requiredEnvVars.length > 0) {
        const target = `${scaffold}.${name}`;
        const auth = await getAuth(target);
        const allSet = variant.requiredEnvVars.every(
          (v) => process.env[v] || auth[v]
        );
        const status = allSet ? "\x1b[32m✓\x1b[0m" : "\x1b[90m○\x1b[0m";
        console.log(`  ${status} \x1b[36m${target}\x1b[0m`);
      }
    }
  }

  console.log();
  console.log("usage: cr auth <target>");
}

async function runAuth(target: string): Promise<void> {
  const parsed = parseTarget(target);

  if (!parsed) {
    console.error(`\x1b[31munknown target:\x1b[0m ${target}`);
    console.error("usage: cr auth <scaffold>.<variant>");
    console.error("example: cr auth claude.glm");
    process.exit(1);
  }

  const { scaffold, variant } = parsed;

  if (!variant) {
    console.error(`\x1b[31mvariant required:\x1b[0m ${target}`);
    console.error("usage: cr auth <scaffold>.<variant>");
    console.error("example: cr auth claude.glm");
    process.exit(1);
  }

  const v = await getVariant(scaffold, variant);
  if (!v) {
    console.error(`\x1b[31munknown variant:\x1b[0m ${target}`);
    console.error(`run \x1b[36mcr list\x1b[0m to see available variants`);
    process.exit(1);
  }

  const requiredEnvVars = v.requiredEnvVars || [];
  if (requiredEnvVars.length === 0) {
    console.log(`\x1b[32m${target}\x1b[0m doesn't require any API keys.`);
    return;
  }

  console.log();

  for (const envVar of requiredEnvVars) {
    const hint = getEnvVarHint(variant, envVar);
    if (hint) {
      console.log(`\x1b[90m${hint}\x1b[0m`);
    }

    const value = await p.password({
      message: envVar,
      mask: "*",
      validate: (v) => {
        if (!v.trim()) return "API key is required";
      },
    });

    if (p.isCancel(value)) {
      p.cancel("cancelled");
      process.exit(0);
    }

    await saveAuth(`${scaffold}.${variant}`, envVar, value.trim());
  }

  console.log();
  console.log(`\x1b[32mSaved!\x1b[0m Run with: cr ${target}`);
}

async function listAll(): Promise<void> {
  console.log("\x1b[1mAvailable scaffolds and variants:\x1b[0m\n");

  for (const scaffold of SCAFFOLDS) {
    console.log(`\x1b[36m${scaffold}\x1b[0m  \x1b[90mcr ${scaffold}\x1b[0m`);

    const variants = await getAllVariants(scaffold);
    const variantNames = Object.keys(variants);

    for (const name of variantNames) {
      const v = variants[name]!;
      console.log(`  .${name}  ${v.description}  \x1b[90mcr ${scaffold}.${name}\x1b[0m`);
    }
    console.log();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(HELP.trim());
    return;
  }

  if (args[0] === "--version" || args[0] === "-v") {
    console.log(`coderouter v${VERSION}`);
    return;
  }

  if (args[0] === "setup") {
    await runSetup();
    return;
  }

  if (args[0] === "auth") {
    if (!args[1]) {
      await showAuthTargets();
      return;
    }
    await runAuth(args[1]);
    return;
  }

  if (args[0] === "list" || args[0] === "ls") {
    await listAll();
    return;
  }

  // Parse scaffold.variant
  const parsed = parseTarget(args[0]!);

  if (!parsed) {
    console.error(`\x1b[31munknown scaffold:\x1b[0m ${args[0]}`);
    console.error();
    console.error("available scaffolds: " + SCAFFOLDS.join(", "));
    console.error("run \x1b[36mcr --help\x1b[0m for usage");
    process.exit(1);
  }

  const { scaffold, variant } = parsed;
  const target = await resolveTarget(scaffold, variant);

  if (!target) {
    console.error(`\x1b[31munknown variant:\x1b[0m ${scaffold}.${variant}`);
    console.error();
    console.error(`run \x1b[36mcr list\x1b[0m to see available variants`);
    console.error(`run \x1b[36mcr setup\x1b[0m to configure a new variant`);
    process.exit(1);
  }

  // Check for required env vars (considers saved secrets)
  const missing = await checkRequiredEnvVars(target);
  if (missing.length > 0) {
    printMissingEnvVarsError(scaffold, variant, missing);
    process.exit(1);
  }

  const restArgs = args.slice(1);
  const exitCode = await run(target, restArgs);
  process.exit(exitCode);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
