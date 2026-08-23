import { Router, type Request, type Response } from "express";
import { prisma } from "../config/prisma";

const router = Router();

type AIChatBody = {
  message?: string;
  projectId?: string;
};

type AuthenticatedRequest = Request & {
  user?: { id?: string };
};

router.post(
  "/chat",
  async (
    req: Request<Record<string, never>, unknown, AIChatBody>,
    res: Response,
  ) => {
    const message = req.body.message?.trim();

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(503).json({
        success: false,
        message: "Gemini API key is not configured",
      });
    }

    const userId = (req as AuthenticatedRequest).user?.id;
    let evidenceContext = "No project evidence was supplied.";

    if (req.body.projectId && userId) {
      const project = await prisma.project.findFirst({
        where: {
          id: req.body.projectId,
          ownerId: userId,
        },
      });

      if (!project) {
        return res.status(404).json({
          success: false,
          message: "Project not found",
        });
      }

      const [files, findings, risks, dependencies, commits, contributors] =
        await Promise.all([
          prisma.projectFile.findMany({
            where: { projectId: project.id },
            orderBy: { sizeBytes: "desc" },
            take: 40,
          }),
          prisma.securityFinding.findMany({
            where: { projectId: project.id },
            orderBy: [{ filePath: "asc" }, { line: "asc" }],
            take: 40,
          }),
          prisma.riskScore.findMany({
            where: { projectId: project.id },
            orderBy: { score: "desc" },
            take: 20,
          }),
          prisma.dependency.findMany({
            where: { projectId: project.id },
            take: 80,
          }),
          prisma.commit.findMany({
            where: { projectId: project.id },
            orderBy: { committedAt: "desc" },
            take: 20,
          }),
          prisma.contributor.findMany({
            where: { projectId: project.id },
            orderBy: { commitCount: "desc" },
            take: 20,
          }),
        ]);

      evidenceContext = JSON.stringify(
        {
          project: {
            id: project.id,
            name: project.name,
            sourceType: project.sourceType,
            status: project.status,
          },
          largestFiles: files.map((file) => ({
            path: file.path,
            sizeBytes: file.sizeBytes,
            lines: file.lines,
            language: file.language,
          })),
          findings: findings.map((finding) => ({
            severity: finding.severity,
            type: finding.type,
            filePath: finding.filePath,
            line: finding.line,
            evidence: finding.evidence,
            description: finding.description,
            recommendation: finding.recommendation,
            confidence: finding.confidence,
          })),
          highestRiskFiles: risks.map((risk) => ({
            filePath: risk.filePath,
            score: risk.score,
            reasons: risk.reasons,
          })),
          dependencies: dependencies.map((edge) => ({
            source: edge.sourceFile,
            target: edge.targetFile,
            type: edge.type,
          })),
          recentCommits: commits.map((commit) => ({
            hash: commit.hash,
            author: commit.authorName,
            message: commit.message,
            committedAt: commit.committedAt,
          })),
          contributors: contributors.map((person) => ({
            name: person.name,
            email: person.email,
            commits: person.commitCount,
          })),
        },
        null,
        2,
      ).slice(0, 55_000);
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
          apiKey,
        )}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 1800,
            },
            contents: [
              {
                parts: [
                  {
                    text: `You are CodeForensic Forensic AI, a repository investigation assistant.

STRICT RULES:
- Use only the repository evidence provided below for project-specific claims.
- Never invent files, commits, authors, vulnerabilities, dependencies, line numbers or measurements.
- Clearly distinguish FACT, INFERENCE and RECOMMENDATION when useful.
- When discussing a finding, include its file and line when present.
- If contributor attribution is unavailable, explicitly say it is unavailable.
- Explain likely root cause and practical remediation in concise technical language.
- If evidence is insufficient, say so.

REPOSITORY EVIDENCE:
${evidenceContext}

USER QUESTION:
${message}`,
                  },
                ],
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        console.error(
          "Gemini API error:",
          response.status,
          await response.text(),
        );

        return res.status(502).json({
          success: false,
          message: "Gemini request failed",
        });
      }

      const data = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              text?: string;
            }>;
          };
        }>;
      };

      const answer =
        data.candidates?.[0]?.content?.parts
          ?.map((part) => part.text ?? "")
          .join("")
          .trim() ?? "";

      return res.json({
        success: true,
        answer:
          answer ||
          "I don't have enough repository evidence to determine this reliably.",
      });
    } catch (error) {
      console.error("AI route error:", error);

      return res.status(500).json({
        success: false,
        message: "Forensic AI request failed",
      });
    }
  },
);

export default router;
