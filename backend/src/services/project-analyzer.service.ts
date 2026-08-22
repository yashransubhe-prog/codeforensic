import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { prisma } from "../config/prisma";

type AnalyzeOptions = {
  projectId: string;
  zipPath: string;
  extractRoot: string;
};

type Finding = {
  severity: "HIGH" | "MEDIUM";
  type: string;
  filePath: string;
  line?: number;
  evidence?: string;
  description: string;
  recommendation?: string;
  scanner: string;
  confidence?: number;
};

type DependencyEdge = {
  sourceFile: string;
  targetFile: string;
  type: string;
};

type RiskReason = {
  factor: string;
  value: number;
  evidence: string;
};

const sourceExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".java",
  ".go",
  ".rs",
  ".php",
]);

const textExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".java",
  ".go",
  ".rs",
  ".php",
  ".json",
  ".md",
  ".txt",
  ".yml",
  ".yaml",
  ".env",
  ".sql",
  ".css",
  ".html",
  ".sh",
  ".ps1",
]);

const languageMap: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript React",
  ".js": "JavaScript",
  ".jsx": "JavaScript React",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",
  ".py": "Python",
  ".java": "Java",
  ".go": "Go",
  ".rs": "Rust",
  ".php": "PHP",
  ".json": "JSON",
  ".md": "Markdown",
  ".yml": "YAML",
  ".yaml": "YAML",
  ".sql": "SQL",
  ".css": "CSS",
  ".html": "HTML",
  ".sh": "Shell",
  ".ps1": "PowerShell",
};

function normalizeRelative(base: string, target: string): string {
  return path
    .normalize(path.join(path.dirname(base), target))
    .replace(/\\/g, "/");
}

function resolveImportTarget(
  sourceFile: string,
  request: string,
  knownFiles: Set<string>,
): string | null {
  if (!request.startsWith(".")) return null;

  const base = normalizeRelative(sourceFile, request);

  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}.mjs`,
    `${base}.cjs`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
    `${base}/index.js`,
    `${base}/index.jsx`,
  ];

  return candidates.find((candidate) => knownFiles.has(candidate)) ?? null;
}

function scanSecurity(relativePath: string, text: string): Finding[] {
  const findings: Finding[] = [];

  const rules: Array<{
    severity: "HIGH" | "MEDIUM";
    type: string;
    regex: RegExp;
    description: string;
    recommendation: string;
    confidence: number;
  }> = [
    {
      severity: "HIGH",
      type: "Process execution",
      regex: /\b(child_process|execSync|spawnSync|execFileSync)\b|powershell\s+-enc/i,
      description:
        "Process or shell execution can become dangerous when arguments are influenced by untrusted input.",
      recommendation:
        "Trace all inputs reaching this call and use fixed, allow-listed arguments instead of shell interpolation.",
      confidence: 0.95,
    },
    {
      severity: "HIGH",
      type: "Dynamic code execution",
      regex: /\beval\s*\(|new\s+Function\s*\(/i,
      description:
        "Dynamic code execution can convert data into executable code and increase arbitrary-code-execution risk.",
      recommendation:
        "Remove dynamic evaluation or replace it with explicit parsing and allow-listed behavior.",
      confidence: 0.97,
    },
    {
      severity: "HIGH",
      type: "Potential embedded secret",
      regex:
        /(api[_-]?key|secret[_-]?key|private[_-]?key|password)\s*[:=]\s*["'`][^"'`\s]{6,}/i,
      description:
        "A credential-like value appears to be embedded directly in source code.",
      recommendation:
        "Move secrets to environment variables or a secret manager and rotate exposed credentials.",
      confidence: 0.85,
    },
    {
      severity: "HIGH",
      type: "Potential SQL injection",
      regex: /(query|execute)\s*\(\s*`[^`]*\$\{[^}]+\}[^`]*`/i,
      description:
        "A SQL statement appears to interpolate values directly into query text.",
      recommendation:
        "Use parameterized queries or ORM parameters.",
      confidence: 0.8,
    },
    {
      severity: "MEDIUM",
      type: "Potential HTML injection sink",
      regex: /\binnerHTML\s*=|dangerouslySetInnerHTML/i,
      description:
        "Raw HTML rendering can lead to XSS when the rendered content is not trusted.",
      recommendation:
        "Prefer safe rendering. If raw HTML is required, sanitize with a proven allow-list sanitizer.",
      confidence: 0.9,
    },
    {
      severity: "MEDIUM",
      type: "Hard-coded network endpoint",
      regex:
        /https?:\/\/(?:localhost|127\.0\.0\.1|\d{1,3}(?:\.\d{1,3}){3}|[a-z0-9.-]+\.[a-z]{2,})[^\s"'`]*/i,
      description:
        "A network endpoint is embedded directly in source code.",
      recommendation:
        "Move environment-specific endpoints into validated configuration.",
      confidence: 0.7,
    },
  ];

  const lines = text.split(/\r?\n/);

  lines.forEach((lineText, index) => {
    for (const rule of rules) {
      rule.regex.lastIndex = 0;

      if (!rule.regex.test(lineText)) continue;

      findings.push({
        severity: rule.severity,
        type: rule.type,
        filePath: relativePath,
        line: index + 1,
        evidence: lineText.trim().slice(0, 500),
        description: rule.description,
        recommendation: rule.recommendation,
        scanner: "CodeForensic Static Analyzer",
        confidence: rule.confidence,
      });
    }
  });

  return findings;
}

function calculateFileRisk(
  filePath: string,
  findings: Finding[],
  dependencies: DependencyEdge[],
): { score: number; reasons: RiskReason[] } {
  const fileFindings = findings.filter((finding) => finding.filePath === filePath);
  const incoming = dependencies.filter((edge) => edge.targetFile === filePath).length;
  const outgoing = dependencies.filter((edge) => edge.sourceFile === filePath).length;

  const reasons: RiskReason[] = [];

  const highCount = fileFindings.filter((finding) => finding.severity === "HIGH").length;
  const mediumCount = fileFindings.filter((finding) => finding.severity === "MEDIUM").length;

  if (highCount > 0) {
    reasons.push({
      factor: "High-severity findings",
      value: highCount * 18,
      evidence: `${highCount} high-severity finding(s)`,
    });
  }

  if (mediumCount > 0) {
    reasons.push({
      factor: "Medium-severity findings",
      value: mediumCount * 8,
      evidence: `${mediumCount} medium-severity finding(s)`,
    });
  }

  if (incoming > 0) {
    reasons.push({
      factor: "Dependent files",
      value: Math.min(incoming * 4, 20),
      evidence: `${incoming} file(s) directly depend on this file`,
    });
  }

  if (outgoing > 0) {
    reasons.push({
      factor: "Dependency surface",
      value: Math.min(outgoing * 2, 10),
      evidence: `${outgoing} direct outgoing dependency edge(s)`,
    });
  }

  const score = Math.min(
    100,
    reasons.reduce((sum, reason) => sum + reason.value, 0),
  );

  return { score, reasons };
}

export async function analyzeZipProject({
  projectId,
  zipPath,
  extractRoot,
}: AnalyzeOptions): Promise<void> {
  const projectDir = path.join(extractRoot, projectId);

  fs.rmSync(projectDir, { recursive: true, force: true });
  fs.mkdirSync(projectDir, { recursive: true });

  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const normalized = entry.entryName.replace(/\\/g, "/");

    if (
      normalized.startsWith("/") ||
      normalized.includes("../") ||
      normalized.includes("..\\")
    ) {
      throw new Error(`Unsafe ZIP entry detected: ${normalized}`);
    }

    if (normalized.includes("node_modules/")) continue;
    if (normalized.includes(".git/objects/")) continue;

    const destination = path.resolve(projectDir, normalized);
    const safeRoot = path.resolve(projectDir);

    if (!destination.startsWith(safeRoot + path.sep) && destination !== safeRoot) {
      throw new Error(`ZIP path traversal detected: ${normalized}`);
    }

    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, entry.getData());
  }

  const discoveredFiles: Array<{
    relativePath: string;
    absolutePath: string;
    sizeBytes: number;
    lines: number | null;
    language: string | null;
    extension: string | null;
    isTest: boolean;
    text?: string;
  }> = [];

  function walk(directory: string): void {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      const relativePath = path
        .relative(projectDir, fullPath)
        .replace(/\\/g, "/");

      const stat = fs.statSync(fullPath);
      const extension = path.extname(relativePath).toLowerCase() || null;
      const language = extension ? languageMap[extension] ?? null : null;
      const isText = extension ? textExtensions.has(extension) : false;

      let text: string | undefined;
      let lines: number | null = null;

      if (isText && stat.size <= 1_000_000) {
        try {
          text = fs.readFileSync(fullPath, "utf8");
          lines = text.split(/\r?\n/).length;
        } catch {
          text = undefined;
          lines = null;
        }
      }

      discoveredFiles.push({
        relativePath,
        absolutePath: fullPath,
        sizeBytes: stat.size,
        lines,
        language,
        extension,
        isTest:
          /(^|\/)(__tests__|test|tests|spec)(\/|$)/i.test(relativePath) ||
          /\.(test|spec)\.[^.]+$/i.test(relativePath),
        text,
      });
    }
  }

  walk(projectDir);

  const knownFiles = new Set(discoveredFiles.map((file) => file.relativePath));

  const dependencies: DependencyEdge[] = [];
  const dependencyKeys = new Set<string>();

  const importRegex =
    /(?:import\s+(?:[^"'`]*?\s+from\s+)?|export\s+[^"'`]*?\s+from\s+|require\s*\()\s*["'`]([^"'`]+)["'`]\)?/g;

  for (const file of discoveredFiles) {
    if (!file.text || !file.extension || !sourceExtensions.has(file.extension)) {
      continue;
    }

    let match: RegExpExecArray | null;

    while ((match = importRegex.exec(file.text)) !== null) {
      const resolved = resolveImportTarget(
        file.relativePath,
        match[1],
        knownFiles,
      );

      if (!resolved) continue;

      const key = `${file.relativePath}->${resolved}`;

      if (dependencyKeys.has(key)) continue;

      dependencyKeys.add(key);

      dependencies.push({
        sourceFile: file.relativePath,
        targetFile: resolved,
        type: "IMPORT",
      });
    }
  }

  const findings: Finding[] = [];

  for (const file of discoveredFiles) {
    if (!file.text) continue;
    findings.push(...scanSecurity(file.relativePath, file.text));
  }

  const riskRows = discoveredFiles.map((file) => {
    const risk = calculateFileRisk(file.relativePath, findings, dependencies);

    return {
      filePath: file.relativePath,
      score: risk.score,
      reasons: risk.reasons,
    };
  });

  await prisma.$transaction(async (tx) => {
    await tx.projectFile.deleteMany({ where: { projectId } });
    await tx.dependency.deleteMany({ where: { projectId } });
    await tx.securityFinding.deleteMany({ where: { projectId } });
    await tx.riskScore.deleteMany({ where: { projectId } });

    for (const file of discoveredFiles) {
      await tx.projectFile.create({
        data: {
          projectId,
          path: file.relativePath,
          name: path.basename(file.relativePath),
          extension: file.extension,
          sizeBytes: file.sizeBytes,
          lines: file.lines,
          language: file.language,
          isTest: file.isTest,
        },
      });
    }

    for (const dependency of dependencies) {
      await tx.dependency.create({
        data: {
          projectId,
          sourceFile: dependency.sourceFile,
          targetFile: dependency.targetFile,
          type: dependency.type,
        },
      });
    }

    for (const finding of findings) {
      await tx.securityFinding.create({
        data: {
          projectId,
          severity: finding.severity,
          type: finding.type,
          filePath: finding.filePath,
          line: finding.line,
          evidence: finding.evidence,
          description: finding.description,
          recommendation: finding.recommendation,
          scanner: finding.scanner,
          confidence: finding.confidence,
        },
      });
    }

    for (const risk of riskRows) {
      await tx.riskScore.create({
        data: {
          projectId,
          filePath: risk.filePath,
          score: risk.score,
          reasons: risk.reasons,
        },
      });
    }

    await tx.project.update({
      where: { id: projectId },
      data: {
        status: "COMPLETED",
        sourcePath: projectDir,
      },
    });
  });
}