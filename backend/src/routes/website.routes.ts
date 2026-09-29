import { Router, type Request, type Response } from "express";

const router = Router();

function score(v: unknown) {
  return typeof v === "number" ? Math.round(v * 100) : null;
}

router.post("/analyze", async (req: Request, res: Response) => {
  const raw = typeof req.body?.url === "string" ? req.body.url.trim() : "";
  const strategy = req.body?.strategy === "desktop" ? "desktop" : "mobile";
  if (!raw) return res.status(400).json({ success: false, message: "Website URL is required" });

  let target: URL;
  try {
    target = new URL(raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`);
    if (!["http:", "https:"].includes(target.protocol)) throw new Error("protocol");
  } catch {
    return res.status(400).json({ success: false, message: "Enter a valid public http/https URL" });
  }

  try {
    const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
    endpoint.searchParams.set("url", target.toString());
    endpoint.searchParams.set("strategy", strategy);
    ["performance", "accessibility", "best-practices", "seo"].forEach(c => endpoint.searchParams.append("category", c));

    const response = await fetch(endpoint, { headers: { "User-Agent": "CodeForensic/1.0" } });
    const data: any = await response.json();
    if (!response.ok) {
      return res.status(response.status === 429 ? 429 : 502).json({
        success: false,
        message: response.status === 429 ? "Website audit quota is busy. Try again shortly." : (data?.error?.message || "Website audit provider failed"),
      });
    }

    const lr = data?.lighthouseResult || {};
    const audits = lr.audits || {};
    const categories = lr.categories || {};
    const metricIds = ["first-contentful-paint","largest-contentful-paint","speed-index","total-blocking-time","cumulative-layout-shift","interactive","server-response-time"];
    const metrics: Record<string, any> = {};
    metricIds.forEach(id => {
      const a = audits[id];
      if (a) metrics[id] = { displayValue: a.displayValue, numericValue: a.numericValue, score: a.score };
    });

    const opportunities = Object.values(audits)
      .filter((a: any) => a && a.scoreDisplayMode !== "notApplicable" && typeof a.score === "number" && a.score < 0.9 && a.title)
      .sort((a: any,b: any) => (a.score ?? 1) - (b.score ?? 1))
      .slice(0, 15)
      .map((a: any) => ({ id: a.id, title: a.title, description: a.description, displayValue: a.displayValue }));

    return res.json({
      success: true,
      audit: {
        url: lr.finalDisplayedUrl || lr.finalUrl || target.toString(),
        fetchedAt: lr.fetchTime || new Date().toISOString(),
        strategy,
        scores: {
          performance: score(categories.performance?.score),
          accessibility: score(categories.accessibility?.score),
          bestPractices: score(categories["best-practices"]?.score),
          seo: score(categories.seo?.score),
        },
        metrics,
        opportunities,
      },
    });
  } catch (error) {
    console.error("Website analysis error:", error);
    return res.status(502).json({ success: false, message: "Could not reach the website audit service" });
  }
});

export default router;
