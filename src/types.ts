// Scaffolds are the CLI tools we wrap
export type Scaffold = "claude" | "opencode" | "codex" | "gemini";

// A builtin variant definition
export interface BuiltinVariant {
  name: string;
  description: string;
  env: Record<string, string>;
  defaultArgs?: string[];
  // For opencode, we manage XDG_CONFIG_HOME
  xdgConfigSubdir?: string;
  // Env vars that must exist for this variant to work
  requiredEnvVars?: string[];
}

// A user-defined variant (can extend a builtin)
export interface UserVariant {
  extends?: string; // e.g., "claude.aws" to inherit from builtin
  description?: string;
  env?: Record<string, string>; // merged on top of extended variant
  defaultArgs?: string[];
  requiredEnvVars?: string[];
}

// User config stored in ~/.config/coderouter/config.json
export interface Config {
  // User-defined variants keyed by full name (e.g., "claude.aws.sonnet")
  variants?: Record<string, UserVariant>;

  // Auth credentials with glob patterns (e.g., "claude.glm*")
  auth?: Record<string, Record<string, string>>;
}

// Resolved target to run
export interface ResolvedTarget {
  scaffold: Scaffold;
  variant: string | null;
  command: string;
  env: Record<string, string>;
  defaultArgs: string[];
  requiredEnvVars: string[];
}
