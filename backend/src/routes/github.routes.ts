import fs from "fs";
import os from "os";
import path from "path";
import { Router, type Request, type Response } from "express";

import { prisma } from "../config/prisma";
import { analyzeZipProject } from "../services/project-analyzer.service";

const router = Router();

const projectsRoot = path.resolve(process.cwd(), "../storage/projects");
fs.mkdirSync(projectsRoot, { recursive: true });

type AuthenticatedRequest = Request & {
  user?: { id?: string };
};

function getUserId(req: Request) {
  return (req as AuthenticatedRequest).user?.id ?? null;
}

function parseGitHubUrl(value: string) {
  const trimmed = value.trim().replace(/\.git$/i, "").replace(/\/$/, "");
  const match = trimmed.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+))?$/i);

  if (!match) {
    throw new Error("INVALID_GITHUB_URL");
  }

  return {
    owner: match[1],
    repo: match[2],
    branch: match[3] || "main",
  };
}

async function fetchGitHubCommits(owner: string, repo: string, branch: string) {
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?sha=${encodeURIComponent(branch)}&per_page=100`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "CodeForensic",
      },
    },
  );

  if (!response.ok) return [];

  const data = (await response.json()) as Array<any>;
  return Array.isArray(data) ? data : [];
}

router.post("/import", async (req: Request, res: Response) => {
  const userId = getUserId(req);

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  const repoUrl = typeof req.body?.url === "string" ? req.body.url : "";

  let parsed: ReturnType<typeof parseGitHubUrl>;

  try {
    parsed = parseGitHubUrl(repoUrl);
  } catch {
    return res.status(400).json({
      success: false,
      message: "Enter a public GitHub repository URL such as https://github.com/owner/repository",
    });
  }

  const { owner, repo, branch } = parsed;
  const tempZip = path.join(os.tmpdir(), `codeforensic-${Date.now()}-${repo}.zip`);
  let createdProjectId: string | null = null;

  try {
    const archiveUrl = `https://codeload.github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/zip/refs/heads/${encodeURIComponent(branch)}`;
    const archiveResponse = await fetch(archiveUrl, {
      headers: { "User-Agent": "CodeForensic" },
      redirect: "follow",
    });

    if (!archiveResponse.ok) {
      return res.status(400).json({
        success: false,
        message: "GitHub repository or branch could not be downloaded. Public repositories are supported.",
      });
    }

    const bytes = Buffer.from(await archiveResponse.arrayBuffer());
    if (bytes.length > 50 * 1024 * 1024) {
      return res.status(413).json({
        success: false,
        message: "Repository archive exceeds the 50 MB analysis limit",
      });
    }

    fs.writeFileSync(tempZip, bytes);

    const project = await prisma.project.create({
      data: {
        name: repo,
        description: `${owner}/${repo} · ${branch}`,
        sourceType: "GITHUB",
        status: "ANALYZING",
        ownerId: userId,
      },
    });

    createdProjectId = project.id;

    await analyzeZipProject({
      projectId: project.id,
      zipPath: tempZip,
      extractRoot: projectsRoot,
    });

    const commits = await fetchGitHubCommits(owner, repo, branch);
    const contributorMap = new Map<
      string,
      { name: string; email: string | null; commitCount: number }
    >();

    for (const item of commits) {
      const hash = typeof item?.sha === "string" ? item.sha : "";
      const authorName = item?.commit?.author?.name || item?.author?.login || "Unknown";
      const authorEmail = item?.commit?.author?.email || null;
      const message = item?.commit?.message || "GitHub commit";
      const committedAtRaw = item?.commit?.author?.date || item?.commit?.committer?.date;
      const committedAt = committedAtRaw ? new Date(committedAtRaw) : new Date();

      if (hash) {
        await prisma.commit.upsert({
          where: {
            projectId_hash: {
              projectId: project.id,
              hash,
            },
          },
          create: {
            projectId: project.id,
            hash,
            authorName,
            authorEmail,
            message,
            committedAt,
            additions: 0,
            deletions: 0,
          },
          update: {},
        });
      }

      const key = (authorEmail || authorName).toLowerCase();
      const existing = contributorMap.get(key) || {
        name: authorName,
        email: authorEmail,
        commitCount: 0,
      };
      existing.commitCount += 1;
      contributorMap.set(key, existing);
    }

    for (const contributor of contributorMap.values()) {
      const emailKey = contributor.email || `github:${contributor.name.toLowerCase()}`;
      await prisma.contributor.upsert({
        where: {
          projectId_email: {
            projectId: project.id,
            email: emailKey,
          },
        },
        create: {
          projectId: project.id,
          name: contributor.name,
          email: emailKey,
          commitCount: contributor.commitCount,
          linesAdded: 0,
          linesRemoved: 0,
        },
        update: {
          commitCount: contributor.commitCount,
        },
      });
    }

    const completedProject = await prisma.project.findUnique({ where: { id: project.id } });
    const [files, projectCommits, contributors, dependencies, findings, riskScores] =
      await Promise.all([
        prisma.projectFile.findMany({ where: { projectId: project.id } }),
        prisma.commit.findMany({ where: { projectId: project.id }, orderBy: { committedAt: "desc" } }),
        prisma.contributor.findMany({ where: { projectId: project.id }, orderBy: { commitCount: "desc" } }),
        prisma.dependency.findMany({ where: { projectId: project.id } }),
        prisma.securityFinding.findMany({ where: { projectId: project.id } }),
        prisma.riskScore.findMany({ where: { projectId: project.id }, orderBy: { score: "desc" } }),
      ]);

    return res.status(201).json({
      success: true,
      message: "GitHub repository imported and analyzed",
      project: {
        ...completedProject,
        files,
        commits: projectCommits,
        contributors,
        dependencies,
        findings,
        riskScores,
      },
    });
  } catch (error) {
    console.error("GitHub import error:", error);

    if (createdProjectId) {
      await prisma.project
        .update({ where: { id: createdProjectId }, data: { status: "FAILED" } })
        .catch(() => undefined);
    }

    return res.status(500).json({
      success: false,
      message: "GitHub repository analysis failed",
    });
  } finally {
    fs.rmSync(tempZip, { force: true });
  }
});

export default router;
