import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.routes";
import aiRoutes from "./routes/ai.routes";
import projectRoutes from "./routes/project.routes";
import intelligenceRoutes from "./routes/intelligence.routes";

import { requireAuth } from "./middleware/auth.middleware";

const app = express();

const PORT = Number(process.env.PORT) || 5000;

app.use(helmet());

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://codeforensic.vercel.app",
    ],
    credentials: true,
  }),
);

app.use(
  express.json({
    limit: "2mb",
  }),
);

app.use(cookieParser());
app.use(morgan("dev"));

app.get("/", (_req, res) => {
  res.json({
    success: true,
    product: "CodeForensic",
    tagline: "Investigate. Trace. Explain.",
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    service: "CodeForensic API",
    status: "operational",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);

app.use(
  "/api/projects",
  requireAuth,
  projectRoutes,
);

app.use(
  "/api/ai",
  requireAuth,
  aiRoutes,
);

app.use(
  "/api/intelligence",
  requireAuth,
  intelligenceRoutes,
);

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
  });
});

app.listen(PORT, () => {
  console.log("");
  console.log("======================================");
  console.log("          CODEFORENSIC API");
  console.log("======================================");
  console.log(`Server   : http://localhost:${PORT}`);
  console.log(`Health   : http://localhost:${PORT}/api/health`);
  console.log(`Auth     : http://localhost:${PORT}/api/auth`);
  console.log(`Projects : http://localhost:${PORT}/api/projects`);
  console.log(`AI       : http://localhost:${PORT}/api/ai/chat`);
  console.log(`Intel    : http://localhost:${PORT}/api/intelligence`);
  console.log("======================================");
  console.log("");
});