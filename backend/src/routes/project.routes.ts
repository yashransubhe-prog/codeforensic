import fs from "fs";
import path from "path";
import { Router, type Request, type Response } from "express";
import multer from "multer";

import { prisma } from "../config/prisma";
import { analyzeZipProject } from "../services/project-analyzer.service";

const router = Router();

const uploadsRoot = path.resolve(process.cwd(), "../storage/uploads");
const projectsRoot = path.resolve(process.cwd(), "../storage/projects");

fs.mkdirSync(uploadsRoot, { recursive: true });
fs.mkdirSync(projectsRoot, { recursive: true });

const upload = multer({
  dest: uploadsRoot,

  limits: {
    fileSize: 50 * 1024 * 1024,
  },

  fileFilter: (_req, file, callback) => {
    const lowerName = file.originalname.toLowerCase();

    const isZip =
      file.mimetype === "application/zip" ||
      file.mimetype === "application/x-zip-compressed" ||
      lowerName.endsWith(".zip");

    if (!isZip) {
      callback(new Error("Only ZIP files are allowed"));
      return;
    }

    callback(null, true);
  },
});

type AuthenticatedRequest = Request & {
  user?: {
    id?: string;
  };
};

function getUserId(req: Request): string | null {
  const authReq = req as AuthenticatedRequest;

  return authReq.user?.id ?? null;
}

function getStringParam(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    const first = value[0];

    return typeof first === "string" ? first : null;
  }

  return null;
}

async function findOwnedProject(projectId: string, userId: string) {
  return prisma.project.findFirst({
    where: {
      id: projectId,
      ownerId: userId,
    },
  });
}

/* =========================================================
   IMPORT PROJECT
========================================================= */

router.post(
  "/import",
  upload.single("project"),
  async (req: Request, res: Response) => {
    const uploadedFile = req.file;

    if (!uploadedFile) {
      return res.status(400).json({
        success: false,
        message: "ZIP file is required",
      });
    }

    const userId = getUserId(req);

    if (!userId) {
      fs.rmSync(uploadedFile.path, {
        force: true,
      });

      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const rawName =
      typeof req.body?.name === "string"
        ? req.body.name.trim()
        : "";

    const rawDescription =
      typeof req.body?.description === "string"
        ? req.body.description.trim()
        : "";

    const projectName =
      rawName ||
      uploadedFile.originalname.replace(/\.zip$/i, "");

    let createdProjectId: string | null = null;

    try {
      const project = await prisma.project.create({
        data: {
          name: projectName,
          description: rawDescription || null,
          sourceType: "ZIP",
          status: "ANALYZING",
          ownerId: userId,
        },
      });

      createdProjectId = project.id;

      await analyzeZipProject({
        projectId: project.id,
        zipPath: uploadedFile.path,
        extractRoot: projectsRoot,
      });

      const completedProject = await prisma.project.findUnique({
        where: {
          id: project.id,
        },
      });

      const [
        files,
        commits,
        contributors,
        dependencies,
        findings,
        riskScores,
      ] = await Promise.all([
        prisma.projectFile.findMany({
          where: {
            projectId: project.id,
          },
        }),

        prisma.commit.findMany({
          where: {
            projectId: project.id,
          },
          orderBy: {
            committedAt: "desc",
          },
        }),

        prisma.contributor.findMany({
          where: {
            projectId: project.id,
          },
          orderBy: {
            commitCount: "desc",
          },
        }),

        prisma.dependency.findMany({
          where: {
            projectId: project.id,
          },
        }),

        prisma.securityFinding.findMany({
          where: {
            projectId: project.id,
          },
        }),

        prisma.riskScore.findMany({
          where: {
            projectId: project.id,
          },
          orderBy: {
            score: "desc",
          },
        }),
      ]);

      return res.status(201).json({
        success: true,
        message: "Project imported and analyzed successfully",

        project: {
          ...completedProject,
          files,
          commits,
          contributors,
          dependencies,
          findings,
          riskScores,
        },
      });
    } catch (error) {
      console.error("Project import error:", error);

      if (createdProjectId) {
        await prisma.project
          .update({
            where: {
              id: createdProjectId,
            },

            data: {
              status: "FAILED",
            },
          })
          .catch(() => undefined);
      }

      return res.status(500).json({
        success: false,
        message: "Project import or analysis failed",
      });
    } finally {
      fs.rmSync(uploadedFile.path, {
        force: true,
      });
    }
  },
);

/* =========================================================
   LIST USER PROJECTS
========================================================= */

router.get("/", async (req: Request, res: Response) => {
  const userId = getUserId(req);

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  try {
    const projects = await prisma.project.findMany({
      where: {
        ownerId: userId,
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    const result = await Promise.all(
      projects.map(async (project) => {
        const [
          files,
          commits,
          contributors,
          dependencies,
          findings,
          riskScores,
        ] = await Promise.all([
          prisma.projectFile.count({
            where: {
              projectId: project.id,
            },
          }),

          prisma.commit.count({
            where: {
              projectId: project.id,
            },
          }),

          prisma.contributor.count({
            where: {
              projectId: project.id,
            },
          }),

          prisma.dependency.count({
            where: {
              projectId: project.id,
            },
          }),

          prisma.securityFinding.count({
            where: {
              projectId: project.id,
            },
          }),

          prisma.riskScore.count({
            where: {
              projectId: project.id,
            },
          }),
        ]);

        return {
          ...project,

          counts: {
            files,
            commits,
            contributors,
            dependencies,
            findings,
            riskScores,
          },
        };
      }),
    );

    return res.json({
      success: true,
      projects: result,
    });
  } catch (error) {
    console.error("List projects error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not load projects",
    });
  }
});

/* =========================================================
   PROJECT STATISTICS
========================================================= */

router.get(
  "/:id/statistics",
  async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const projectId = getStringParam(req.params.id);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Invalid project id",
      });
    }

    try {
      const project = await findOwnedProject(
        projectId,
        userId,
      );

      if (!project) {
        return res.status(404).json({
          success: false,
          message: "Project not found",
        });
      }

      const [
        files,
        commitCount,
        contributorCount,
        dependencyCount,
        findingCount,
        riskScores,
      ] = await Promise.all([
        prisma.projectFile.findMany({
          where: {
            projectId,
          },
        }),

        prisma.commit.count({
          where: {
            projectId,
          },
        }),

        prisma.contributor.count({
          where: {
            projectId,
          },
        }),

        prisma.dependency.count({
          where: {
            projectId,
          },
        }),

        prisma.securityFinding.count({
          where: {
            projectId,
          },
        }),

        prisma.riskScore.findMany({
          where: {
            projectId,
          },

          select: {
            score: true,
          },
        }),
      ]);

      const totalSizeBytes = files.reduce(
        (sum: number, file) =>
          sum + file.sizeBytes,
        0,
      );

      const totalLines = files.reduce(
        (sum: number, file) =>
          sum + (file.lines ?? 0),
        0,
      );

      const testFiles = files.filter(
        (file) => file.isTest,
      ).length;

      const sourceFiles = files.filter(
        (file) =>
          Boolean(file.language) &&
          !file.isTest,
      ).length;

      const languages: Record<string, number> = {};

      for (const file of files) {
        const language =
          file.language ?? "Unknown";

        languages[language] =
          (languages[language] ?? 0) + 1;
      }

      const highestRisk =
        riskScores.length > 0
          ? Math.max(
              ...riskScores.map(
                (risk) => risk.score,
              ),
            )
          : null;

      return res.json({
        success: true,

        statistics: {
          totalFiles: files.length,
          sourceFiles,
          testFiles,
          totalSizeBytes,
          totalLines,

          commits: commitCount,
          contributors: contributorCount,
          dependencies: dependencyCount,
          securityFindings: findingCount,

          highestRisk,
          languages,
        },
      });
    } catch (error) {
      console.error(
        "Project statistics error:",
        error,
      );

      return res.status(500).json({
        success: false,
        message: "Could not calculate project statistics",
      });
    }
  },
);

/* =========================================================
   PROJECT FILES
========================================================= */

router.get(
  "/:id/files",
  async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const projectId = getStringParam(req.params.id);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Invalid project id",
      });
    }

    const project = await findOwnedProject(
      projectId,
      userId,
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const files =
      await prisma.projectFile.findMany({
        where: {
          projectId,
        },

        orderBy: {
          path: "asc",
        },
      });

    return res.json({
      success: true,
      files,
    });
  },
);

/* =========================================================
   DEPENDENCIES
========================================================= */

router.get(
  "/:id/dependencies",
  async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const projectId = getStringParam(req.params.id);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Invalid project id",
      });
    }

    const project = await findOwnedProject(
      projectId,
      userId,
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const dependencies =
      await prisma.dependency.findMany({
        where: {
          projectId,
        },

        orderBy: [
          {
            sourceFile: "asc",
          },
          {
            targetFile: "asc",
          },
        ],
      });

    return res.json({
      success: true,
      dependencies,
    });
  },
);

/* =========================================================
   SECURITY FINDINGS
========================================================= */

router.get(
  "/:id/security",
  async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const projectId = getStringParam(req.params.id);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Invalid project id",
      });
    }

    const project = await findOwnedProject(
      projectId,
      userId,
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const findings =
      await prisma.securityFinding.findMany({
        where: {
          projectId,
        },

        orderBy: [
          {
            filePath: "asc",
          },
          {
            line: "asc",
          },
        ],
      });

    return res.json({
      success: true,
      findings,
    });
  },
);

/* =========================================================
   RISK SCORES
========================================================= */

router.get(
  "/:id/risk",
  async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const projectId = getStringParam(req.params.id);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Invalid project id",
      });
    }

    const project = await findOwnedProject(
      projectId,
      userId,
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const riskScores =
      await prisma.riskScore.findMany({
        where: {
          projectId,
        },

        orderBy: {
          score: "desc",
        },
      });

    return res.json({
      success: true,
      riskScores,
    });
  },
);

/* =========================================================
   COMMITS
========================================================= */

router.get(
  "/:id/commits",
  async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const projectId = getStringParam(req.params.id);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Invalid project id",
      });
    }

    const project = await findOwnedProject(
      projectId,
      userId,
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const commits = await prisma.commit.findMany({
      where: {
        projectId,
      },

      orderBy: {
        committedAt: "desc",
      },
    });

    return res.json({
      success: true,
      commits,
    });
  },
);

/* =========================================================
   CONTRIBUTORS
========================================================= */

router.get(
  "/:id/contributors",
  async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const projectId = getStringParam(req.params.id);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Invalid project id",
      });
    }

    const project = await findOwnedProject(
      projectId,
      userId,
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const contributors =
      await prisma.contributor.findMany({
        where: {
          projectId,
        },

        orderBy: {
          commitCount: "desc",
        },
      });

    return res.json({
      success: true,
      contributors,
    });
  },
);

/* =========================================================
   COMPLETE PROJECT
========================================================= */

router.get(
  "/:id",
  async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const projectId = getStringParam(req.params.id);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Invalid project id",
      });
    }

    try {
      const project = await findOwnedProject(
        projectId,
        userId,
      );

      if (!project) {
        return res.status(404).json({
          success: false,
          message: "Project not found",
        });
      }

      const [
        files,
        commits,
        contributors,
        dependencies,
        findings,
        riskScores,
      ] = await Promise.all([
        prisma.projectFile.findMany({
          where: {
            projectId,
          },

          orderBy: {
            path: "asc",
          },
        }),

        prisma.commit.findMany({
          where: {
            projectId,
          },

          orderBy: {
            committedAt: "desc",
          },
        }),

        prisma.contributor.findMany({
          where: {
            projectId,
          },

          orderBy: {
            commitCount: "desc",
          },
        }),

        prisma.dependency.findMany({
          where: {
            projectId,
          },
        }),

        prisma.securityFinding.findMany({
          where: {
            projectId,
          },
        }),

        prisma.riskScore.findMany({
          where: {
            projectId,
          },

          orderBy: {
            score: "desc",
          },
        }),
      ]);

      return res.json({
        success: true,

        project: {
          ...project,
          files,
          commits,
          contributors,
          dependencies,
          findings,
          riskScores,
        },
      });
    } catch (error) {
      console.error("Get project error:", error);

      return res.status(500).json({
        success: false,
        message: "Could not load project",
      });
    }
  },
);

export default router;