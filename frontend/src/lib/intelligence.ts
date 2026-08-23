export type IntelligenceIssue = {
  id: string;
  category: "BUG" | "ERROR" | "SECURITY" | "MALWARE" | "SECRET" | "NETWORK";
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

export type IntelligenceResult = {
  project: { id: string; name: string; status: string; sourceType: string };
  summary: {
    scannedFiles: number;
    totalIssues: number;
    bugSignals: number;
    securitySignals: number;
    malwareSignals: number;
    malwareRisk: number;
    suspiciousFiles: number;
  };
  issues: IntelligenceIssue[];
  malware: IntelligenceIssue[];
  bugs: IntelligenceIssue[];
  security: IntelligenceIssue[];
  hotspots: Array<{
    filePath: string;
    score: number;
    issueCount: number;
    critical: number;
    high: number;
  }>;
};

const API = "https://codeforensic.onrender.com/api";

export async function getIntelligence(projectId: string) {
  const token = localStorage.getItem("cf_token");
  if (!token) throw new Error("Authentication required");

  const response = await fetch(`${API}/intelligence/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Could not load forensic intelligence");
  }
  return data as { success: boolean; intelligence: IntelligenceResult };
}
