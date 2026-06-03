import * as path from "node:path";
import fg from "fast-glob";
import { parse as parseYaml } from "yaml";
import type { CollectorResult } from "../schemas/collector.js";
import { asRecord, asString, loadHermesConfig, pick, resolveSubpath } from "../utils/config.js";
import { listDir, readTextFile, statSafe } from "../utils/fs.js";
import type { CollectorContext } from "./context.js";
import type { SkillsData } from "./data.js";
import { addEvidence, finalize, newAccumulator, runArea } from "./result.js";

const EMPTY: SkillsData = {};

type SkillEntry = NonNullable<SkillsData["skills"]>[number];
type BrokenRef = NonNullable<SkillsData["brokenRefs"]>[number];
type Duplicate = NonNullable<SkillsData["duplicates"]>[number];
type LargeFile = NonNullable<SkillsData["largeFiles"]>[number];

function parseFrontmatter(content: string): Record<string, unknown> | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match || match[1] === undefined) return null;
  try { return asRecord(parseYaml(match[1])); } catch { return null; }
}

function extractReferences(content: string): string[] {
  const refs = new Set<string>();
  const linkPattern = /\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = linkPattern.exec(content)) !== null) {
    const target = m[1]?.split(/[#?]/)[0]?.trim();
    if (!target) continue;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(target) || target.startsWith("mailto:")) continue;
    refs.add(target);
  }
  return [...refs];
}

export async function collectSkills(ctx: CollectorContext): Promise<CollectorResult<SkillsData>> {
  return runArea("skills", EMPTY, ctx.redaction, async () => {
    const acc = newAccumulator();
    const config = await loadHermesConfig(ctx.paths.config);
    const section = asRecord(pick(config.parsed, "skills"));
    const configuredDir = asString(pick(section, "dir", "path", "directory"));
    let skillsDir: string;
    if (configuredDir) {
      const resolved = resolveSubpath(ctx.paths.home, configuredDir);
      if (resolved !== null) {
        skillsDir = resolved;
      } else {
        skillsDir = ctx.paths.skillsDir;
        acc.warnings.push(`configured skills.dir "${configuredDir}" is outside hermes home; falling back to default: ${ctx.paths.skillsDir}`);
      }
    } else {
      skillsDir = ctx.paths.skillsDir;
    }

    addEvidence(acc, "Skills dir", skillsDir, "config.yaml");

    const entries = await listDir(skillsDir);
    if (entries === null) {
      acc.warnings.push(`skills directory not found: ${skillsDir}`);
      const data: SkillsData = { skillsDir, skills: [], brokenRefs: [], duplicates: [], largeFiles: [] };
      return finalize("skills", "partial", data, acc, ctx.redaction);
    }

    const skills: SkillEntry[] = [];
    const brokenRefs: BrokenRef[] = [];
    const largeFiles: LargeFile[] = [];
    const nameToPaths = new Map<string, string[]>();

    for (const entry of entries) {
      if (!entry.isDirectory) continue;
      const dir = path.join(skillsDir, entry.name);
      const skillMdPath = path.join(dir, "SKILL.md");
      const read = await readTextFile(skillMdPath);
      const hasSkillMd = read.ok && read.content !== null;
      let name: string | null = entry.name;

      if (hasSkillMd) {
        const meta = read.content ? parseFrontmatter(read.content) : null;
        if (meta) name = asString(pick(meta, "name")) ?? entry.name;

        if (read.content) {
          for (const ref of extractReferences(read.content)) {
            const resolved = path.resolve(dir, ref);
            const refStat = await statSafe(resolved);
            if (refStat === null) {
              brokenRefs.push({ sourceSkill: name ?? entry.name, referencedPath: ref, reason: "referenced path does not exist" });
            }
          }
        }
      }

      const key = (name ?? entry.name).toLowerCase();
      nameToPaths.set(key, [...(nameToPaths.get(key) ?? []), dir]);
      skills.push({ dir, name, hasSkillMd });
    }

    let matches: string[] = [];
    try {
      matches = await fg(["**/*"], {
        cwd: skillsDir,
        onlyFiles: true,
        dot: false,
        followSymbolicLinks: false,
      });
    } catch (err) {
      acc.warnings.push(
        `Error scanning skills directory for large files: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    for (const rel of matches) {
      const abs = path.join(skillsDir, rel);
      const stat = await statSafe(abs);
      if (stat && stat.size > ctx.thresholds.skillsLargeFileBytes) {
        largeFiles.push({ path: abs, sizeBytes: stat.size });
      }
    }

    const duplicates: Duplicate[] = [];
    for (const [name, paths] of nameToPaths) {
      if (paths.length > 1) duplicates.push({ name, paths });
    }

    addEvidence(acc, "Skills", `${skills.length} skill(s) found`);

    const data: SkillsData = { skillsDir, skills, brokenRefs, duplicates, largeFiles };
    return finalize("skills", "collected", data, acc, ctx.redaction);
  });
}
