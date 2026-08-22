import {
  Router,
  type Request,
  type Response,
} from "express";

import { analyzeProjectIntelligence } from "../services/intelligence.service";

type AuthenticatedRequest = Request & {
  user?: {
    id?: string;
  };
};

const router = Router();

function getUserId(req: Request) {
  return (req as AuthenticatedRequest).user?.id ?? null;
}

router.get(
  "/projects/:projectId",
  async (req: Request, res: Response) => {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const projectId =
      typeof req.params.projectId === "string"
        ? req.params.projectId
        : null;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Invalid project id",
      });
    }

    try {
      const intelligence = await analyzeProjectIntelligence(
        projectId,
        userId,
      );

      return res.json({
        success: true,
        intelligence,
      });
    } catch (error) {
      console.error("Intelligence analysis error:", error);

      if (
        error instanceof Error &&
        error.message === "PROJECT_NOT_FOUND"
      ) {
        return res.status(404).json({
          success: false,
          message: "Project not found",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Could not complete forensic intelligence analysis",
      });
    }
  },
);

export default router;
