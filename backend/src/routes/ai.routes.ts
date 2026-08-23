import { Router, type Request, type Response } from "express";
import { prisma } from "../config/prisma";

const router = Router();
type AIChatBody = { message?: string; projectId?: string };
type AuthenticatedRequest = Request & { user?: { id?: string } };

type Evidence = {
  project: { id: string; name: string; sourceType: string; status: string };
  files: Array<{ path: string; sizeBytes: number; lines: number | null; language: string | null }>;
  findings: Array<{ severity: string; type: string; filePath: string; line: number | null; description: string; recommendation: string | null }>;
  risks: Array<{ filePath: string; score: number; reasons: unknown }>;
  dependencies: Array<{ source: string; target: string; type: string }>;
  commits: Array<{ hash: string; author: string; message: string; committedAt: Date }>;
  contributors: Array<{ name: string; email: string | null; commits: number }>;
};

function localForensicAnswer(question: string, e: Evidence): string {
  const q = question.toLowerCase();
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  e.dependencies.forEach((d) => {
    incoming.set(d.target, (incoming.get(d.target) ?? 0) + 1);
    outgoing.set(d.source, (outgoing.get(d.source) ?? 0) + 1);
  });
  const blast = e.files.map((f) => ({ path: f.path, links: (incoming.get(f.path) ?? 0) + (outgoing.get(f.path) ?? 0) })).sort((a, b) => b.links - a.links);
  const highestRisk = [...e.risks].sort((a, b) => b.score - a.score);
  const severe = [...e.findings].sort((a, b) => {
    const rank = (s: string) => s.toUpperCase() === "CRITICAL" ? 4 : s.toUpperCase() === "HIGH" ? 3 : s.toUpperCase() === "MEDIUM" ? 2 : 1;
    return rank(b.severity) - rank(a.severity);
  });

  if (q.includes("blast") || q.includes("depend") || q.includes("connected")) {
    const top = blast.filter((x) => x.links > 0).slice(0, 8);
    return top.length
      ? `EVIDENCE-BASED RESULT (local forensic engine)\n\nFiles with the largest observed dependency blast radius:\n${top.map((x, i) => `${i + 1}. ${x.path} — ${x.links} direct relationship(s)`).join("\n")}\n\nThis ranking uses only ${e.dependencies.length} resolved internal dependency links from the analyzed repository.`
      : `EVIDENCE-BASED RESULT (local forensic engine)\n\nNo resolved internal dependency links were found. ${e.files.length} files are indexed, but the available evidence is insufficient to rank blast radius reliably.`;
  }

  if (q.includes("risk") || q.includes("investigate") || q.includes("finding") || q.includes("security")) {
    if (highestRisk.length) {
      const r = highestRisk[0];
      const related = severe.filter((f) => f.filePath === r.filePath).slice(0, 4);
      return `EVIDENCE-BASED RESULT (local forensic engine)\n\nInvestigate ${r.filePath} first. Its calculated risk score is ${r.score}/100.${related.length ? `\n\nObserved findings:\n${related.map((f) => `• [${f.severity}] ${f.type}${f.line ? ` at line ${f.line}` : ""}: ${f.description}`).join("\n")}` : " No scanner finding is attached to this file; its score comes from recorded risk factors/dependency exposure."}`;
    }
    return `EVIDENCE-BASED RESULT (local forensic engine)\n\nNo risk-score evidence is available for ${e.project.name}. I will not invent a risky file.`;
  }

  if (q.includes("architect") || q.includes("summar") || q.includes("repository") || q.includes("project")) {
    const languages = new Map<string, number>();
    e.files.forEach((f) => languages.set(f.language ?? "Other", (languages.get(f.language ?? "Other") ?? 0) + 1));
    const langText = [...languages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k}: ${v}`).join(", ");
    return `EVIDENCE-BASED RESULT (local forensic engine)\n\n${e.project.name} is a ${e.project.sourceType} project with ${e.files.length} indexed files and ${e.dependencies.length} resolved internal dependency relationships. Language/file composition: ${langText || "unavailable"}. Security analysis recorded ${e.findings.length} finding(s), ${e.contributors.length} contributor record(s), and ${e.commits.length} commit record(s).\n\nI am reporting only evidence stored by CodeForensic.`;
  }

  return `EVIDENCE-BASED RESULT (local forensic engine)\n\nProject: ${e.project.name}\nIndexed files: ${e.files.length}\nResolved dependency links: ${e.dependencies.length}\nSecurity findings: ${e.findings.length}\nRisk records: ${e.risks.length}\nCommits: ${e.commits.length}\nContributors: ${e.contributors.length}\n\nGemini is unavailable, so I returned verified repository evidence instead of fabricating an AI answer. Ask about risk, findings, architecture, dependencies, or blast radius for a deeper local analysis.`;
}

router.post("/chat", async (req: Request<Record<string, never>, unknown, AIChatBody>, res: Response) => {
  const message = req.body.message?.trim();
  if (!message) return res.status(400).json({ success: false, message: "Message is required" });

  const userId = (req as AuthenticatedRequest).user?.id;
  if (!req.body.projectId || !userId) return res.status(400).json({ success: false, message: "Authenticated project context is required" });

  try {
    const project = await prisma.project.findFirst({ where: { id: req.body.projectId, ownerId: userId } });
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });

    const [files, findings, risks, dependencies, commits, contributors] = await Promise.all([
      prisma.projectFile.findMany({ where: { projectId: project.id }, orderBy: { sizeBytes: "desc" }, take: 500 }),
      prisma.securityFinding.findMany({ where: { projectId: project.id }, orderBy: [{ filePath: "asc" }, { line: "asc" }], take: 200 }),
      prisma.riskScore.findMany({ where: { projectId: project.id }, orderBy: { score: "desc" }, take: 200 }),
      prisma.dependency.findMany({ where: { projectId: project.id }, take: 1000 }),
      prisma.commit.findMany({ where: { projectId: project.id }, orderBy: { committedAt: "desc" }, take: 100 }),
      prisma.contributor.findMany({ where: { projectId: project.id }, orderBy: { commitCount: "desc" }, take: 100 }),
    ]);

    const evidence: Evidence = {
      project: { id: project.id, name: project.name, sourceType: project.sourceType, status: project.status },
      files: files.map((f) => ({ path: f.path, sizeBytes: f.sizeBytes, lines: f.lines, language: f.language })),
      findings: findings.map((f) => ({ severity: f.severity, type: f.type, filePath: f.filePath, line: f.line, description: f.description, recommendation: f.recommendation })),
      risks: risks.map((r) => ({ filePath: r.filePath, score: r.score, reasons: r.reasons })),
      dependencies: dependencies.map((d) => ({ source: d.sourceFile, target: d.targetFile, type: d.type })),
      commits: commits.map((c) => ({ hash: c.hash, author: c.authorName, message: c.message, committedAt: c.committedAt })),
      contributors: contributors.map((c) => ({ name: c.name, email: c.email, commits: c.commitCount })),
    };

    const fallback = localForensicAnswer(message, evidence);
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) return res.json({ success: true, answer: fallback, engine: "local-forensic", warning: "Gemini API key is not configured" });

    const evidenceContext = JSON.stringify(evidence, null, 2).slice(0, 55_000);
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationConfig: { temperature: 0.2, maxOutputTokens: 1800 },
          contents: [{ parts: [{ text: `You are CodeForensic Forensic AI. Use ONLY the repository evidence below. Never invent files, commits, authors, vulnerabilities, dependencies, line numbers or measurements. Distinguish fact from inference. If evidence is insufficient, say so.\n\nREPOSITORY EVIDENCE:\n${evidenceContext}\n\nUSER QUESTION:\n${message}` }] }],
        }),
      });
      if (response.ok) {
        const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
        const answer = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
        if (answer) return res.json({ success: true, answer, engine: "gemini" });
      } else {
        const detail = (await response.text()).slice(0, 1000);
        console.error("Gemini API error", response.status, detail);
        return res.json({ success: true, answer: fallback, engine: "local-forensic", warning: `Gemini unavailable (${response.status}); verified local analysis used.` });
      }
    } catch (geminiError) {
      console.error("Gemini request error", geminiError);
      return res.json({ success: true, answer: fallback, engine: "local-forensic", warning: "Gemini unreachable; verified local analysis used." });
    }

    return res.json({ success: true, answer: fallback, engine: "local-forensic" });
  } catch (error) {
    console.error("AI route error:", error);
    return res.status(500).json({ success: false, message: "Forensic AI request failed" });
  }
});

export default router;
