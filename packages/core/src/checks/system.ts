import type { HermesSnapshot } from "../schemas/snapshot.js";
import { evidence, finding, fix, type Check } from "./types.js";

/**
 * Check: System info is collected and reported.
 * VAL-SYS-001: System info collected
 */
export const systemInfoCheck: Check = {
  id: "system-info",
  area: "system",
  title: "System Information",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const sys = snapshot.system;
    const ev: Array<ReturnType<typeof evidence>> = [];
    const messages: string[] = [];

    if (sys.os) {
      ev.push(evidence("os", sys.os, "derived"));
      messages.push(`OS: ${sys.os}`);
    }
    if (sys.arch) {
      ev.push(evidence("arch", sys.arch, "derived"));
      messages.push(`Architecture: ${sys.arch}`);
    }
    if (sys.nodeVersion) {
      ev.push(evidence("node", sys.nodeVersion, "derived"));
      messages.push(`Node.js: ${sys.nodeVersion}`);
    }

    return [
      finding(
        "system-info",
        "system",
        messages.length === 0 ? "unknown" : "info",
        0,
        "System Information",
        messages.length > 0 ? messages.join(", ") : "No system information collected",
        ev,
        [],
      ),
    ];
  },
};

/**
 * Check: Shell environment reported.
 * VAL-SYS-002: Shell environment reported
 */
export const shellEnvCheck: Check = {
  id: "system-shell-env",
  area: "system",
  title: "Shell Environment",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const sys = snapshot.system;
    const ev: Array<ReturnType<typeof evidence>> = [];

    if (sys.shell) {
      ev.push(evidence("shell", sys.shell, "derived"));
    }
    if (sys.path && sys.path.length > 0) {
      ev.push(evidence("path", sys.path.join(":"), "derived"));
    }

    const hasShell = !!sys.shell;
    const hasPath = !!(sys.path && sys.path.length > 0);

    return [
      finding(
        "system-shell-env",
        "system",
        hasShell || hasPath ? "info" : "warning",
        hasShell || hasPath ? 0 : 1,
        "Shell Environment",
        hasShell
          ? `Shell: ${sys.shell}`
          : "No shell environment detected",
        ev,
        !hasShell
          ? [
              fix("Set SHELL environment variable", {
                command: 'export SHELL=$(which bash)',
                risk: "low",
              }),
            ]
          : [],
      ),
    ];
  },
};

/**
 * Check: Docker availability.
 * VAL-SYS-003: Docker availability detected
 */
export const dockerCheck: Check = {
  id: "system-docker",
  area: "system",
  title: "Docker Availability",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const sys = snapshot.system;
    const ev: Array<ReturnType<typeof evidence>> = [];

    if (sys.docker) {
      ev.push(evidence("docker_version", sys.docker, "command", "high"));
      return [
        finding(
          "system-docker",
          "system",
          "ok",
          0,
          "Docker Available",
          `Docker is installed: ${sys.docker}`,
          ev,
        ),
      ];
    }

    return [
      finding(
        "system-docker",
        "system",
        "info",
        0,
        "Docker Not Available",
        "Docker is not installed or not on PATH",
        ev,
        [
          fix("Install Docker", {
            command: "curl -fsSL https://get.docker.com | sh",
            description: "Or visit https://docs.docker.com/get-docker/",
            risk: "high",
            requiresConfirmation: true,
            manualSteps: [
              "Review the Docker installation script at https://get.docker.com",
              "Run: curl -fsSL https://get.docker.com | sh",
              "Add your user to the docker group: sudo usermod -aG docker $USER",
              "Log out and back in for group changes to take effect",
            ],
            rollback: "sudo apt-get purge docker-ce docker-ce-cli containerd.io",
          }),
        ],
      ),
    ];
  },
};

/**
 * Check: Git availability.
 * VAL-SYS-004: Git availability detected
 */
export const gitCheck: Check = {
  id: "system-git",
  area: "system",
  title: "Git Availability",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const sys = snapshot.system;
    const ev: Array<ReturnType<typeof evidence>> = [];

    if (sys.git) {
      ev.push(evidence("git_version", sys.git, "command", "high"));
      return [
        finding(
          "system-git",
          "system",
          "ok",
          0,
          "Git Available",
          `Git is installed: ${sys.git}`,
          ev,
        ),
      ];
    }

    return [
      finding(
        "system-git",
        "system",
        "info",
        0,
        "Git Not Available",
        "Git is not installed or not on PATH",
        ev,
        [
          fix("Install Git", {
            command: "sudo apt-get install git -y",
            description: "Or visit https://git-scm.com/downloads",
            risk: "high",
            requiresConfirmation: true,
            manualSteps: [
              "Run: sudo apt-get install git -y",
              "Verify with: git --version",
            ],
            rollback: "sudo apt-get remove git -y",
          }),
        ],
      ),
    ];
  },
};

/** All system checks */
export const systemChecks: Check[] = [
  systemInfoCheck,
  shellEnvCheck,
  dockerCheck,
  gitCheck,
];
