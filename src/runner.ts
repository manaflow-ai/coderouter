import { spawn } from "node:child_process";
import type { ResolvedTarget, Scaffold } from "./types.ts";
import { getAuth } from "./config.ts";

const SENSITIVE_PATTERNS = [
  /token/i,
  /key/i,
  /secret/i,
  /password/i,
  /credential/i,
  /bearer/i,
];

// Env vars to show from user's environment (if they exist)
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

function logEnvVars(
  injected: Record<string, string>,
  scaffold: Scaffold
): void {
  const injectedEntries = Object.entries(injected);
  const passthroughVars = PASSTHROUGH_VARS[scaffold] || [];

  // Find passthrough vars that exist in environment
  const passthroughEntries: [string, string][] = [];
  for (const key of passthroughVars) {
    const value = process.env[key];
    if (value && !injected[key]) {
      passthroughEntries.push([key, value]);
    }
  }

  if (injectedEntries.length === 0 && passthroughEntries.length === 0) return;

  console.log("\x1b[90m[cr]\x1b[0m");

  if (injectedEntries.length > 0) {
    for (const [key, value] of injectedEntries) {
      console.log(`  \x1b[36m${key}\x1b[0m=${redact(key, value)}`);
    }
  }

  if (passthroughEntries.length > 0) {
    for (const [key, value] of passthroughEntries) {
      console.log(`  \x1b[90m${key}=${redact(key, value)} (from env)\x1b[0m`);
    }
  }

  console.log();
}

export async function run(target: ResolvedTarget, args: string[]): Promise<number> {
  // Get auth credentials for this target (uses glob matching)
  const fullTarget = target.variant
    ? `${target.scaffold}.${target.variant}`
    : target.scaffold;
  const auth = await getAuth(fullTarget);

  logEnvVars(target.env, target.scaffold);

  const env = {
    ...process.env,
    ...auth, // Inject auth credentials
    ...target.env,
  };

  const finalArgs = [...target.defaultArgs, ...args];

  return new Promise((resolve) => {
    const proc = spawn(target.command, finalArgs, {
      env,
      stdio: "inherit",
    });

    proc.on("close", (code) => resolve(code ?? 0));
    proc.on("error", (err) => {
      console.error(`\x1b[31mfailed to execute ${target.command}:\x1b[0m ${err.message}`);
      resolve(1);
    });
  });
}
