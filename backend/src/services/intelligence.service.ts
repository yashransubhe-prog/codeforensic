import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { prisma } from "../config/prisma";

export type IntelligenceIssue = {
  id: string;
  category:
    | "BUG"
    | "ERROR"
    | "SECURITY"
    | "MALWARE"
    | "SECRET"
    | "NETWORK";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  filePath: string;
  line: number | null;
  evidence: string;
  cause: string;
  impact: string;
  recommendation: string;
  author: string | null;
  authorEmail: string | null;
  commitHash: string | null;
  confidence: number;
};

type Rule = {
  category: IntelligenceIssue["category"];
  severity: IntelligenceIssue["severity"];
  title: string;
  regex: RegExp;
  cause: string;
  impact: string;
  recommendation: string;
  confidence: number;
};

const RULES: Rule[] = [
  {
    category: "ERROR",
    severity: "MEDIUM",
    title: "Risky asynchronous operation",
    regex: /\bawait\s+[^;\n]+/i,
    cause:
      "An asynchronous operation can reject or throw and should be reviewed for explicit recovery.",
    impact:
      "A failed API, database, network or file operation can interrupt the current workflow or leave partial state.",
    recommendation:
      "Check the surrounding function for structured try/catch handling and meaningful recovery or propagation.",
    confidence: 0.58,
  },
  {
    category: "SECURITY",
    severity: "CRITICAL",
    title: "Dynamic code execution",
    regex: /\beval\s*\(|new\s+Function\s*\(/i,
    cause:
      "Runtime-generated code can turn data into executable instructions.",
    impact:
      "Attacker-controlled input may become arbitrary code execution.",
    recommendation:
      "Remove dynamic code execution and replace it with explicit parsing and allow-listed behavior.",
    confidence: 0.98,
  },
  {
    category: "SECURITY",
    severity: "CRITICAL",
    title: "Operating-system command execution",
    regex:
      /\b(child_process|execSync|execFileSync|spawnSync|execFile|spawn|exec)\b/i,
    cause:
      "The application can invoke operating-system commands or child processes.",
    impact:
      "Unsanitized arguments can create command-injection or malicious process-execution risk.",
    recommendation:
      "Avoid shell execution where possible. Validate and allow-list every external argument.",
    confidence: 0.94,
  },
  {
    category: "MALWARE",
    severity: "CRITICAL",
    title: "Suspicious PowerShell execution",
    regex:
      /\b(powershell|pwsh)(\.exe)?\b.*(-enc|-encodedcommand|invoke-expression|iex)/i,
    cause:
      "Encoded or dynamically evaluated PowerShell is a common loader and evasion pattern.",
    impact:
      "Potential payload execution, persistence, credential theft or remote compromise.",
    recommendation:
      "Manually review the command and remove encoded/dynamic execution unless explicitly required and trusted.",
    confidence: 0.93,
  },
  {
    category: "MALWARE",
    severity: "HIGH",
    title: "Encoded payload / Base64 pattern",
    regex:
      /(frombase64string|atob\s*\(|Buffer\.from\s*\([^)]*base64)/i,
    cause:
      "Encoded content can hide executable data or staged payloads.",
    impact:
      "Possible obfuscated script, embedded payload or suspicious loader behavior.",
    recommendation:
      "Decode and inspect the content. Never execute decoded data without validation.",
    confidence: 0.78,
  },
  {
    category: "MALWARE",
    severity: "HIGH",
    title: "Remote payload download pattern",
    regex:
      /(curl\s+https?:\/\/|wget\s+https?:\/\/|Invoke-WebRequest|downloadString\s*\(|fetch\s*\(\s*["'`]https?:\/\/)/i,
    cause:
      "The code downloads content from a remote endpoint.",
    impact:
      "Remote content may introduce scripts, binaries, configuration or secondary payloads.",
    recommendation:
      "Verify the domain, enforce TLS, validate content hashes and use trusted allow-listed sources.",
    confidence: 0.74,
  },
  {
    category: "MALWARE",
    severity: "HIGH",
    title: "Persistence / startup modification",
    regex:
      /(CurrentVersion\\Run|Startup\\|schtasks|crontab|systemctl\s+enable)/i,
    cause:
      "The code contains behavior commonly associated with establishing persistence.",
    impact:
      "Software may automatically execute after reboot or user login.",
    recommendation:
      "Confirm the persistence behavior is intentional, documented and authorized.",
    confidence: 0.84,
  },
  {
    category: "SECRET",
    severity: "CRITICAL",
    title: "Possible embedded credential",
    regex:
      /(api[_-]?key|secret|password|token)\s*[:=]\s*["'`][^"'`\s]{8,}/i,
    cause:
      "A credential-like value appears to be stored directly in source code.",
    impact:
      "Source disclosure can expose external services or privileged application access.",
    recommendation:
      "Rotate the credential and move it to environment variables or a secret manager.",
    confidence: 0.89,
  },
  {
    category: "NETWORK",
    severity: "MEDIUM",
    title: "Hard-coded external endpoint",
    regex: /https?:\/\/[^\s"'`)]+/i,
    cause:
      "A network endpoint is embedded directly in source code.",
    impact:
      "Environment changes or endpoint compromise can affect runtime behavior.",
    recommendation:
      "Move environment-specific endpoints into validated configuration.",
    confidence: 0.70,
  },
  {
    category: "SECURITY",
    severity: "HIGH",
    title: "Potential HTML injection sink",
    regex:
      /(dangerouslySetInnerHTML|innerHTML\s*=|document\.write\s*\()/i,
    cause:
      "Untrusted content could reach an HTML execution sink.",
    impact:
      "Possible cross-site scripting if attacker-controlled data reaches this code.",
    recommendation:
      "Avoid raw HTML sinks or sanitize using a trusted allow-list sanitizer.",
    confidence: 0.85,
  },
  {
    category: "SECURITY",
    severity: "HIGH",
    title: "Possible SQL string construction",
    regex:
      /(SELECT|UPDATE|DELETE|INSERT).*(\$\{|\+\s*[a-zA-Z_$])/i,
    cause:
      "SQL appears to be constructed using runtime string values.",
    impact:
      "Potential SQL injection if attacker-controlled values are concatenated.",
    recommendation:
      "Use parameterized queries or ORM query APIs.",
    confidence: 0.79,
  },
];

const TEXT_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".java",
  ".c", ".cpp", ".h", ".hpp", ".cs", ".go", ".rs", ".php", ".rb",
  ".sh", ".ps1", ".html", ".css", ".json", ".yaml", ".yml", ".xml",
  ".md", ".env",
]);

function isReadableSource(filePath: string) {
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function walk(directory: string): string[] {
  const result: string[] = [];
  if (!fs.existsSync(directory)) return result;

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);

    if (
      entry.name === "node_modules" ||
      entry.name === "dist" ||
      entry.name === "build" ||
      entry.name === ".next"
    ) {
      continue;
    }

    if (entry.isDirectory()) result.push(...walk(full));
    else result.push(full);
  }

  return result;
}

function gitBlame(repositoryRoot: string, relativePath: string, line: number) {
  const gitDir = path.join(repositoryRoot, ".git");

  if (!fs.existsSync(gitDir)) {
    return { author: null, authorEmail: null, commitHash: null };
  }

  try {
    const output = execFileSync(
      "git",
      [
        "-C",
        repositoryRoot,
        "blame",
        "-L",
        `${line},${line}`,
        "--porcelain",
        "--",
        relativePath,
      ],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    );

    const lines = output.split(/\r?\n/);
    const commitHash = lines[0]?.split(" ")[0] ?? null;

    const author =
      lines.find((value) => value.startsWith("author "))
        ?.replace(/^author /, "") ?? null;

    const authorEmail =
      lines.find((value) => value.startsWith("author-mail "))
        ?.replace(/^author-mail </, "")
        .replace(/>$/, "") ?? null;

    return { author, authorEmail, commitHash };
  } catch {
    return { author: null, authorEmail: null, commitHash: null };
  }
}

export async function analyzeProjectIntelligence(
  projectId: string,
  ownerId: string,
) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId },
  });

  if (!project) throw new Error("PROJECT_NOT_FOUND");
  if (!project.sourcePath) throw new Error("PROJECT_SOURCE_UNAVAILABLE");

  const root = project.sourcePath;
  const files = walk(root).filter(isReadableSource).slice(0, 2500);
  const issues: IntelligenceIssue[] = [];
  let issueNumber = 0;

  for (const absolutePath of files) {
    let content = "";

    try {
      const stat = fs.statSync(absolutePath);
      if (stat.size > 2_000_000) continue;
      content = fs.readFileSync(absolutePath, "utf8");
    } catch {
      continue;
    }

    const relativePath = path.relative(root, absolutePath).replaceAll("\\", "/");
    const lines = content.split(/\r?\n/);

    for (let index = 0; index < lines.length; index++) {
      const sourceLine = lines[index];
      const lineNumber = index + 1;

      for (const rule of RULES) {
        rule.regex.lastIndex = 0;
        if (!rule.regex.test(sourceLine)) continue;

        const attribution = gitBlame(root, relativePath, lineNumber);
        issueNumber += 1;

        issues.push({
          id: `${projectId}-${issueNumber}`,
          category: rule.category,
          severity: rule.severity,
          title: rule.title,
          filePath: relativePath,
          line: lineNumber,
          evidence: sourceLine.trim().slice(0, 500),
          cause: rule.cause,
          impact: rule.impact,
          recommendation: rule.recommendation,
          author: attribution.author,
          authorEmail: attribution.authorEmail,
          commitHash: attribution.commitHash,
          confidence: rule.confidence,
        });
      }
    }
  }

  const severityWeight = { CRITICAL: 100, HIGH: 70, MEDIUM: 40, LOW: 15 };

  issues.sort(
    (a, b) => severityWeight[b.severity] - severityWeight[a.severity],
  );

  const malware = issues.filter((issue) => issue.category === "MALWARE");
  const bugs = issues.filter(
    (issue) => issue.category === "BUG" || issue.category === "ERROR",
  );
  const security = issues.filter(
    (issue) =>
      issue.category === "SECURITY" ||
      issue.category === "SECRET" ||
      issue.category === "NETWORK",
  );

  const suspiciousFiles = new Map<
    string,
    {
      filePath: string;
      score: number;
      issueCount: number;
      critical: number;
      high: number;
    }
  >();

  for (const issue of issues) {
    const current = suspiciousFiles.get(issue.filePath) ?? {
      filePath: issue.filePath,
      score: 0,
      issueCount: 0,
      critical: 0,
      high: 0,
    };

    current.issueCount += 1;
    current.score +=
      issue.severity === "CRITICAL"
        ? 30
        : issue.severity === "HIGH"
          ? 18
          : issue.severity === "MEDIUM"
            ? 9
            : 3;

    if (issue.severity === "CRITICAL") current.critical += 1;
    if (issue.severity === "HIGH") current.high += 1;

    suspiciousFiles.set(issue.filePath, current);
  }

  const hotspots = [...suspiciousFiles.values()]
    .map((item) => ({ ...item, score: Math.min(100, item.score) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);

  const malwareRisk =
    malware.length === 0
      ? 0
      : Math.min(
          100,
          malware.reduce(
            (sum, item) =>
              sum +
              (item.severity === "CRITICAL"
                ? 30
                : item.severity === "HIGH"
                  ? 18
                  : 8),
            0,
          ),
        );

  return {
    project: {
      id: project.id,
      name: project.name,
      status: project.status,
      sourceType: project.sourceType,
    },
    summary: {
      scannedFiles: files.length,
      totalIssues: issues.length,
      bugSignals: bugs.length,
      securitySignals: security.length,
      malwareSignals: malware.length,
      malwareRisk,
      suspiciousFiles: hotspots.length,
    },
    issues,
    malware,
    bugs,
    security,
    hotspots,
  };
}
