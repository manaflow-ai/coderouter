import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, access, readFile, writeFile, cp } from "node:fs/promises";
import type { Config, Scaffold, BuiltinVariant, UserVariant } from "./types.ts";
import { builtinVariants } from "./presets.ts";

export const CONFIG_DIR = join(homedir(), ".config", "coderouter");
export const CONFIG_FILE = join(CONFIG_DIR, "config.json");

// Directories for opencode configs
export const OPENCODE_VANILLA_DIR = join(CONFIG_DIR, "opencode-vanilla");
export const OPENCODE_OMOC_DIR = join(CONFIG_DIR, "opencode-omoc");

export async function ensureConfigDir(): Promise<void> {
  try {
    await access(CONFIG_DIR);
  } catch {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
}

export async function loadConfig(): Promise<Config> {
  try {
    await access(CONFIG_FILE);
  } catch {
    return {};
  }

  try {
    const content = await readFile(CONFIG_FILE, "utf-8");
    const config = JSON.parse(content) as Config;
    return migrateConfig(config);
  } catch {
    return {};
  }
}

// Migrate old config format to new format
function migrateConfig(config: Config & { secrets?: Record<string, string>; variants?: unknown }): Config {
  // Migrate old secrets format to new auth format
  if (config.secrets && typeof config.secrets === "object") {
    if (!config.auth) config.auth = {};

    for (const [key, value] of Object.entries(config.secrets)) {
      // Old format: "claude.glm:ANTHROPIC_AUTH_TOKEN" -> "sk-..."
      const match = key.match(/^([^:]+):(.+)$/);
      if (match) {
        const [, target, envVar] = match;
        const authKey = `${target}*`;
        if (!config.auth[authKey]) config.auth[authKey] = {};
        config.auth[authKey][envVar] = value;
      }
    }

    delete config.secrets;
  }

  // Migrate old variants format (nested by scaffold) to new flat format
  if (config.variants && typeof config.variants === "object") {
    const oldVariants = config.variants as Record<string, Record<string, BuiltinVariant>>;
    const newVariants: Record<string, UserVariant> = {};

    for (const [scaffold, variants] of Object.entries(oldVariants)) {
      if (typeof variants === "object" && variants !== null) {
        // Check if it's old format (has nested scaffold keys)
        const firstValue = Object.values(variants)[0];
        if (firstValue && typeof firstValue === "object" && "name" in firstValue) {
          // Old format - migrate
          for (const [name, variant] of Object.entries(variants)) {
            const fullName = `${scaffold}.${name}`;
            newVariants[fullName] = {
              description: variant.description,
              env: variant.env,
              defaultArgs: variant.defaultArgs,
              requiredEnvVars: variant.requiredEnvVars,
            };
          }
        }
      }
    }

    if (Object.keys(newVariants).length > 0) {
      config.variants = newVariants;
    }
  }

  return config;
}

export async function saveConfig(config: Config): Promise<void> {
  await ensureConfigDir();
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

// Check if a target matches a glob pattern (simple prefix* matching)
function matchesGlob(target: string, pattern: string): boolean {
  if (pattern.endsWith("*")) {
    const prefix = pattern.slice(0, -1);
    return target.startsWith(prefix);
  }
  return target === pattern;
}

// Get auth for a target, trying progressively shorter prefixes
// e.g., for "claude.aws.sonnet", tries:
//   1. auth["claude.aws.sonnet*"]
//   2. auth["claude.aws*"]
//   3. auth["claude*"]
export async function getAuth(target: string): Promise<Record<string, string>> {
  const config = await loadConfig();
  if (!config.auth) return {};

  // Try exact match first, then progressively shorter prefixes
  const parts = target.split(".");

  for (let i = parts.length; i >= 1; i--) {
    const prefix = parts.slice(0, i).join(".");

    // Check all auth patterns for matches
    for (const [pattern, secrets] of Object.entries(config.auth)) {
      if (matchesGlob(prefix, pattern) || matchesGlob(target, pattern)) {
        return secrets;
      }
    }
  }

  return {};
}

// Save auth for a target with glob pattern
export async function saveAuth(
  target: string,
  envVar: string,
  value: string
): Promise<void> {
  const config = await loadConfig();
  if (!config.auth) config.auth = {};

  const authKey = `${target}*`;
  if (!config.auth[authKey]) config.auth[authKey] = {};
  config.auth[authKey][envVar] = value;

  await saveConfig(config);
}

// Get a builtin variant
function getBuiltinVariant(scaffold: Scaffold, variantName: string): BuiltinVariant | undefined {
  const scaffoldVariants = builtinVariants[scaffold];
  return scaffoldVariants?.[variantName];
}

// Resolve a variant (handles extends for user variants)
export async function getVariant(
  scaffold: Scaffold,
  variantName: string
): Promise<BuiltinVariant | undefined> {
  const config = await loadConfig();
  const fullName = `${scaffold}.${variantName}`;

  // Check for user variant first
  const userVariant = config.variants?.[fullName];
  if (userVariant) {
    // If it extends another variant, merge them
    if (userVariant.extends) {
      const [baseScaffold, ...baseParts] = userVariant.extends.split(".");
      const baseVariantName = baseParts.join(".");
      const baseVariant = getBuiltinVariant(baseScaffold as Scaffold, baseVariantName);

      if (baseVariant) {
        return {
          name: variantName,
          description: userVariant.description || baseVariant.description,
          env: { ...baseVariant.env, ...userVariant.env },
          defaultArgs: userVariant.defaultArgs || baseVariant.defaultArgs,
          requiredEnvVars: userVariant.requiredEnvVars || baseVariant.requiredEnvVars,
        };
      }
    }

    // User variant without extends
    return {
      name: variantName,
      description: userVariant.description || fullName,
      env: userVariant.env || {},
      defaultArgs: userVariant.defaultArgs,
      requiredEnvVars: userVariant.requiredEnvVars,
    };
  }

  // Fall back to builtin
  return getBuiltinVariant(scaffold, variantName);
}

// Get all variants for a scaffold (builtins + user-defined)
export async function getAllVariants(
  scaffold: Scaffold
): Promise<Record<string, BuiltinVariant>> {
  const config = await loadConfig();
  const builtins = builtinVariants[scaffold] || {};

  // Get user variants for this scaffold
  const userVariants: Record<string, BuiltinVariant> = {};
  if (config.variants) {
    const prefix = `${scaffold}.`;
    for (const [fullName, userVariant] of Object.entries(config.variants)) {
      if (fullName.startsWith(prefix)) {
        const variantName = fullName.slice(prefix.length);
        // Resolve the variant (handles extends)
        const resolved = await getVariant(scaffold, variantName);
        if (resolved) {
          userVariants[variantName] = resolved;
        }
      }
    }
  }

  return {
    ...builtins,
    ...userVariants,
  };
}

// Save a user variant
export async function saveVariant(
  fullName: string,
  variant: UserVariant
): Promise<void> {
  const config = await loadConfig();
  if (!config.variants) config.variants = {};
  config.variants[fullName] = variant;
  await saveConfig(config);
}

// Delete a user variant
export async function deleteVariant(fullName: string): Promise<boolean> {
  const config = await loadConfig();

  if (config.variants?.[fullName]) {
    delete config.variants[fullName];
    await saveConfig(config);
    return true;
  }
  return false;
}

// Legacy: get secrets for a variant (now uses getAuth)
export async function getSecrets(
  scaffold: Scaffold,
  variantName: string
): Promise<Record<string, string>> {
  return getAuth(`${scaffold}.${variantName}`);
}

// Legacy: save secret (now uses saveAuth)
export async function saveSecret(
  scaffold: Scaffold,
  variantName: string,
  envVar: string,
  value: string
): Promise<void> {
  return saveAuth(`${scaffold}.${variantName}`, envVar, value);
}

// Ensure opencode config directories exist
export async function ensureOpencodeConfig(variant: "vanilla" | "omoc"): Promise<string> {
  const dir = variant === "omoc" ? OPENCODE_OMOC_DIR : OPENCODE_VANILLA_DIR;
  const opencodeDir = join(dir, "opencode");

  try {
    await access(opencodeDir);
  } catch {
    await mkdir(opencodeDir, { recursive: true });

    // Create minimal config
    const configPath = join(opencodeDir, "opencode.json");
    const config: Record<string, unknown> = {
      "$schema": "https://opencode.ai/config.json",
      theme: "opencode",
      plugin: variant === "omoc" ? ["oh-my-opencode"] : [],
      autoupdate: false,
    };

    await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");

    // If omoc, copy node_modules from user's opencode config if it exists
    if (variant === "omoc") {
      const userOpencodeDir = join(homedir(), ".config", "opencode");
      const userNodeModules = join(userOpencodeDir, "node_modules");

      try {
        await access(userNodeModules);
        await cp(userNodeModules, join(opencodeDir, "node_modules"), { recursive: true });
      } catch {
        // node_modules doesn't exist, user needs to install oh-my-opencode
      }
    }
  }

  return dir;
}
