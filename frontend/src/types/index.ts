export interface User {
  id: string;
  name: string;
  email: string;
}

export interface ProjectFile {
  id: string;
  path: string;
  name: string;
  extension?: string | null;
  sizeBytes: number;
  lines?: number | null;
  language?: string | null;
  isTest: boolean;
}

export interface Commit {
  id: string;
  hash: string;
  authorName: string;
  authorEmail?: string | null;
  message: string;
  committedAt: string;
  additions: number;
  deletions: number;
}

export interface Contributor {
  id: string;
  name: string;
  email?: string | null;
  commitCount: number;
  linesAdded: number;
  linesRemoved: number;
}

export interface Dependency {
  id: string;
  sourceFile: string;
  targetFile: string;
  type: string;
}

export interface Finding {
  id: string;
  severity: string;
  type: string;
  filePath: string;
  line?: number | null;
  evidence?: string | null;
  description: string;
  recommendation?: string | null;
  scanner: string;
  confidence?: number | null;
}

export interface RiskScore {
  id: string;
  filePath: string;
  score: number;
  reasons: unknown;
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  sourceType: string;
  status: string;
  createdAt: string;
  files: ProjectFile[];
  commits: Commit[];
  contributors: Contributor[];
  dependencies: Dependency[];
  findings: Finding[];
  riskScores: RiskScore[];
}