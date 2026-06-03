import * as os from "node:os";
import * as path from "node:path";

export interface HermesPaths {
  home: string;
  config: string;
  envFile: string;
  authFile: string;
  skillsDir: string;
  memoryDir: string;
  pluginsDir: string;
  logsDir: string;
}

export interface ResolveHomeOptions {
  hermesHome?: string | null;
  env?: NodeJS.ProcessEnv;
}

function expandTilde(p: string): string {
  if (p.startsWith("~")) {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}

export function resolveHermesHome(options: ResolveHomeOptions = {}): string {
  const env = options.env ?? process.env;
  const explicit = options.hermesHome ?? env.HERMES_HOME ?? null;
  if (explicit && explicit.length > 0) {
    return path.resolve(expandTilde(explicit));
  }
  return path.join(os.homedir(), ".hermes");
}

export function hermesPaths(home: string): HermesPaths {
  return {
    home,
    config: path.join(home, "config.yaml"),
    envFile: path.join(home, ".env"),
    authFile: path.join(home, "auth.json"),
    skillsDir: path.join(home, "skills"),
    memoryDir: path.join(home, "memory"),
    pluginsDir: path.join(home, "plugins"),
    logsDir: path.join(home, "logs"),
  };
}
