#!/usr/bin/env bun

import { getVariant, ensureOpencodeConfig } from "./config.ts";
import { isScaffold, SCAFFOLDS } from "./presets.ts";
import type { Scaffold, ResolvedTarget } from "./types.ts";

const SENSITIVE_PATTERNS = [
  /token/i,
  /key/i,
  /secret/i,
  /password/i,
  /credential/i,
  /bearer/i,
];

const PASSTHROUGH_VARS: Record<Scaffold, string[]> = {
  claude: [
    "AWS_BEARER_TOKEN_BEDROCK",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_SESSION_TOKEN",
    "AWS_PROFILE",
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_AUTH_TOKEN",
    "ANTHROPIC_FOUNDRY_RESOURCE",
    "ANTHROPIC_FOUNDRY_API_KEY",
  ],
  opencode: [],
  codex: ["OPENAI_API_KEY"],
  gemini: ["GEMINI_API_KEY"],
};

function isSensitive(key: string): boolean {
  return SENSITIVE_PATTERNS.some((p) => p.test(key));
}

function redact(key: string, value: string): string {
  if (isSensitive(key)) {
    if (value.length <= 8) return "***";
    return value.slice(0, 4) + "..." + value.slice(-4);
  }
  return value;
}

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

  if (variant) {
    const v = await getVariant("claude", variant);
    if (!v) {
      return null;
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

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("usage: crd <scaffold>[.variant] [args...]");
    console.log("debug mode - shows what would be executed without running it");
    return;
  }

  const parsed = parseTarget(args[0]!);

  if (!parsed) {
    console.error(`unknown scaffold: ${args[0]}`);
    console.error("available scaffolds: " + SCAFFOLDS.join(", "));
    process.exit(1);
  }

  const { scaffold, variant } = parsed;
  const target = await resolveTarget(scaffold, variant);

  if (!target) {
    console.error(`unknown variant: ${scaffold}.${variant}`);
    process.exit(1);
  }

  const restArgs = args.slice(1);

  // Find passthrough vars
  const passthroughVars = PASSTHROUGH_VARS[scaffold] || [];
  const passthroughEntries: [string, string][] = [];
  for (const key of passthroughVars) {
    const value = process.env[key];
    if (value && !target.env[key]) {
      passthroughEntries.push([key, value]);
    }
  }

  console.log("\x1b[1m[debug mode - not executing]\x1b[0m\n");
  console.log(`\x1b[36mscaffold:\x1b[0m ${target.scaffold}`);
  console.log(`\x1b[36mvariant:\x1b[0m  ${target.variant || "(none)"}`);
  console.log(`\x1b[36mcommand:\x1b[0m  ${target.command}`);
  console.log();

  // Show required env vars and their status
  if (target.requiredEnvVars.length > 0) {
    console.log("\x1b[36mrequired:\x1b[0m");
    for (const key of target.requiredEnvVars) {
      const value = process.env[key];
      if (value) {
        console.log(`  \x1b[32m✓\x1b[0m ${key}=${redact(key, value)}`);
      } else {
        console.log(`  \x1b[31m✗\x1b[0m ${key} (not set)`);
      }
    }
    console.log();
  }

  if (Object.keys(target.env).length > 0 || passthroughEntries.length > 0) {
    console.log("\x1b[36menv:\x1b[0m");
    for (const [key, value] of Object.entries(target.env)) {
      console.log(`  ${key}=${value}`);
    }
    for (const [key, value] of passthroughEntries) {
      console.log(`  \x1b[90m${key}=${redact(key, value)} (from env)\x1b[0m`);
    }
    console.log();
  }

  const allArgs = [...target.defaultArgs, ...restArgs];
  if (allArgs.length > 0) {
    console.log(`\x1b[36margs:\x1b[0m ${allArgs.join(" ")}`);
    console.log();
  }

  console.log("\x1b[36mfull command:\x1b[0m");
  const envPrefix = Object.entries(target.env)
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");
  const cmdParts = [target.command, ...allArgs].join(" ");
  console.log(`  ${envPrefix ? envPrefix + " " : ""}${cmdParts}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
