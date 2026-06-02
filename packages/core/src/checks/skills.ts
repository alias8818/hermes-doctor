import type { HermesSnapshot } from "../schemas/snapshot.js";
import { safeIdentifier, safePath } from "../utils/shell-safe.js";
import { evidence, finding, fix, type Check } from "./types.js";

function parentDir(filePath: string): string {
  const idx = filePath.lastIndexOf("/");
  return idx <= 0 ? "." : filePath.slice(0, idx);
}

/**
 * Check: SKILL.md present in skill directories.
 * VAL-SKILL-001: SKILL.md present in skill directories
 */
export const skillMdPresentCheck: Check = {
  id: "skills-skill-md-present",
  area: "skills",
  title: "SKILL.md Presence",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const skills = snapshot.skills;
    const skillEntries = skills.skills ?? [];
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("skills", JSON.stringify(
        skillEntries.map((s) => ({
          dir: s.dir,
          has_skill_md: s.hasSkillMd,
        })),
      ), "file"),
    ];

    if (skillEntries.length === 0) {
      return [
        finding(
          "skills-skill-md-present",
          "skills",
          "info",
          0,
          "No Skills Found",
          "No skill directories found",
          ev,
        ),
      ];
    }

    const missingMd = skillEntries.filter((s) => !s.hasSkillMd);

    if (missingMd.length === 0) {
      return [
        finding(
          "skills-skill-md-present",
          "skills",
          "ok",
          0,
          "All Skills Have SKILL.md",
          `All ${skillEntries.length} skill(s) have SKILL.md files`,
          ev,
        ),
      ];
    }

    if (missingMd.length === skillEntries.length) {
      return [
        finding(
          "skills-skill-md-present",
          "skills",
          "warning",
          2,
          "No SKILL.md Files Found",
          `None of the ${skillEntries.length} skill director(ies) contain SKILL.md`,
          ev,
          skillEntries.map((s) =>
            fix(`Create SKILL.md in ${s.dir.split("/").pop() ?? s.dir}`, {
              command: `cat > ${safePath(`${s.dir}/SKILL.md`)} <<'EOF'\n---\nname: ${safeIdentifier(s.dir.split("/").pop() ?? "my-skill")}\ndescription: My custom skill\n---\n\n# ${safeIdentifier(s.dir.split("/").pop() ?? "My Skill", "My Skill")}\n\nSkill content here\nEOF`,
              risk: "low",
            }),
          ),
        ),
      ];
    }

    return [
      finding(
        "skills-skill-md-present",
        "skills",
        "warning",
          1,
        "Missing SKILL.md Files",
        `${missingMd.length} skill(s) missing SKILL.md: ${missingMd.map((s) => s.dir.split("/").pop() ?? s.dir).join(", ")}`,
        ev,
        missingMd.map((s) =>
          fix(`Create SKILL.md for ${s.dir.split("/").pop() ?? s.dir}`, {
            command: `touch ${safePath(`${s.dir}/SKILL.md`)}`,
            risk: "low",
          }),
        ),
      ),
    ];
  },
};

/**
 * Check: Broken local references detected.
 * VAL-SKILL-002: Broken local references detected
 */
export const brokenRefsCheck: Check = {
  id: "skills-broken-refs",
  area: "skills",
  title: "Broken Skill References",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const skills = snapshot.skills;
    const brokenRefs = skills.brokenRefs ?? [];
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("broken_refs", JSON.stringify(
        brokenRefs.map((r) => ({
          source_skill: r.sourceSkill,
          referenced_path: r.referencedPath,
          reason: r.reason,
        })),
      ), "file"),
    ];

    if (brokenRefs.length === 0) {
      return [
        finding(
          "skills-broken-refs",
          "skills",
          "ok",
          0,
          "No Broken Skill References",
          "All local references in SKILL.md files resolve correctly",
          ev,
        ),
      ];
    }

    return [
      finding(
        "skills-broken-refs",
        "skills",
        "warning",
          1,
        "Broken Skill References Detected",
        `${brokenRefs.length} broken reference(s) found in SKILL.md files`,
        ev,
        brokenRefs.slice(0, 3).map((r) => {
          const parent = safePath(parentDir(r.referencedPath));
          return fix(`Fix broken reference in ${r.sourceSkill}: ${r.referencedPath}`, {
            command: `mkdir -p ${parent}`,
            description: `The referenced path "${r.referencedPath}" does not exist (reason: ${r.reason}). Either create the missing file or update the link in SKILL.md.`,
            risk: "medium",
            requiresConfirmation: true,
            manualSteps: [
              `Run: mkdir -p ${parent}`,
              "Verify the directory structure matches expectations",
            ],
            rollback: `rm -rf ${parent}`,
          });
        }),
      ),
    ];
  },
};

/**
 * Check: Duplicate skill names flagged.
 * VAL-SKILL-003: Duplicate skill names flagged
 */
export const duplicateNamesCheck: Check = {
  id: "skills-duplicate-names",
  area: "skills",
  title: "Duplicate Skill Names",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const skills = snapshot.skills;
    const duplicates = skills.duplicates ?? [];
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("duplicates", JSON.stringify(
        duplicates.map((d) => ({
          name: d.name,
          paths: d.paths,
        })),
      ), "file"),
    ];

    if (duplicates.length === 0) {
      return [
        finding(
          "skills-duplicate-names",
          "skills",
          "ok",
          0,
          "No Duplicate Skill Names",
          "All skill names are unique",
          ev,
        ),
      ];
    }

    return [
      finding(
        "skills-duplicate-names",
        "skills",
        "warning",
          1,
        "Duplicate Skill Names Found",
        `${duplicates.length} duplicate skill name(s) detected: ${duplicates.map((d) => `${d.name} (${d.paths.join(", ")})`).join("; ")}`,
        ev,
        duplicates.map((d) =>
          fix(`Rename one of the "${d.name}" skills`, {
            command: `Rename the skill directory for ${d.paths.map((p) => p.split("/").pop()).join(" or ")} to use unique names`,
            description: `Paths: ${d.paths.join(", ")}. Each skill directory must have a unique name.`,
            risk: "low",
          }),
        ),
      ),
    ];
  },
};

/**
 * Check: Large SKILL.md files flagged.
 * VAL-SKILL-004: Large SKILL.md files flagged
 */
export const largeFilesCheck: Check = {
  id: "skills-large-files",
  area: "skills",
  title: "Large SKILL.md Files",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const skills = snapshot.skills;
    const largeFiles = skills.largeFiles ?? [];
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("large_files", JSON.stringify(
        largeFiles.map((f) => ({
          path: f.path,
          size_bytes: f.sizeBytes,
        })),
      ), "file"),
    ];

    if (largeFiles.length === 0) {
      return [
        finding(
          "skills-large-files",
          "skills",
          "info",
          0,
          "No Large SKILL.md Files",
          "All SKILL.md files are within reasonable size limits",
          ev,
        ),
      ];
    }

    return [
      finding(
        "skills-large-files",
        "skills",
        "warning",
          1,
        "Large SKILL.md Files Detected",
        `${largeFiles.length} SKILL.md file(s) exceed recommended size: ${largeFiles.map((f) => `${f.path} (${formatSize(f.sizeBytes)})`).join(", ")}`,
        ev,
        largeFiles.slice(0, 3).map((f) =>
          fix(`Review large file ${f.path}`, {
            command: `du -sh ${safePath(f.path)}`,
            description: `File is ${formatSize(f.sizeBytes)} — split into smaller, focused modules or archive old content`,
            risk: "low",
          }),
        ),
      ),
    ];
  },
};

/**
 * Check: Skill metadata — Hermes SKILL.md files are arbitrary Markdown
 * with no required YAML front matter fields (name/description not required).
 * This check always returns info since metadata requirements don't apply.
 * VAL-SKILL-005: Skill manifest metadata valid (relaxed for Hermes)
 */
export const metadataCheck: Check = {
  id: "skills-metadata",
  area: "skills",
  title: "Skill Metadata (Hermes SKILL.md)",
  run(snapshot: HermesSnapshot): ReturnType<Check["run"]> {
    const skills = snapshot.skills;
    const skillEntries = skills.skills ?? [];
    const ev: Array<ReturnType<typeof evidence>> = [
      evidence("skills", JSON.stringify(
        skillEntries.map((s) => ({
          dir: s.dir,
          name: s.name ?? null,
        })),
      ), "file"),
    ];

    if (skillEntries.length === 0) {
      return [
        finding(
          "skills-metadata",
          "skills",
          "info",
          0,
          "No Skills Metadata to Check",
          "No skill directories found",
          ev,
        ),
      ];
    }

    // Hermes SKILL.md files are arbitrary Markdown — no required YAML front matter
    return [
      finding(
        "skills-metadata",
        "skills",
        "info",
        0,
        "Skill Metadata (No Front Matter Required)",
        "Hermes does not require YAML front matter in SKILL.md files",
        ev,
      ),
    ];
  },
};

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

/** All skills checks */
export const skillsChecks: Check[] = [
  skillMdPresentCheck,
  brokenRefsCheck,
  duplicateNamesCheck,
  largeFilesCheck,
  metadataCheck,
];
