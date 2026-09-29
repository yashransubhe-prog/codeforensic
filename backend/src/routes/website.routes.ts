import { Router, type Request, type Response } from "express";
import dns from "node:dns/promises";
import net from "node:net";

const router = Router();
const cache = new Map<string, { expires: number; value: any }>();

function score(v: unknown) {
  return typeof v === "number" ? Math.round(v * 100) : null;
}
function privateIp(ip: string) {
  if (net.isIP(ip) === 4) {
    const p = ip.split(".").map(Number);
    return p[0] === 10 || p[0] === 127 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168);
  }
  return ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80:");
}
async function assertPublic(target: URL) {
  if (["localhost", "0.0.0.0"].includes(target.hostname)) throw new Error("Private/local URLs cannot be scanned");
  const records = await dns.lookup(target.hostname, { all: true });
  if (!records.length || records.some(r => privateIp(r.address))) throw new Error("Private/local URLs cannot be scanned");
}
function has(html: string, pattern: RegExp) { return pattern.test(html); }
function count(html: string, pattern: RegExp) { return (html.match(pattern) || []).length; }
function textMatch(html:string, pattern:RegExp) { const m=html.match(pattern); return m?.[1]?.replace(/\s+/g," ").trim() || null; }

async function nativeAudit(target: URL) {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(target, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "CodeForensic-WebAudit/2.0" },
    });
    const ttfb = Math.round(performance.now() - started);
    const html = (await response.text()).slice(0, 3_000_000);
    const totalMs = Math.round(performance.now() - started);
    const bytes = Buffer.byteLength(html, "utf8");
    const headers = response.headers;
    const checks = [
      { id:"https", title:"HTTPS transport", ok: response.url.startsWith("https://"), detail:"Site should use HTTPS." },
      { id:"csp", title:"Content Security Policy", ok: Boolean(headers.get("content-security-policy")), detail:"CSP reduces script-injection exposure." },
      { id:"hsts", title:"Strict Transport Security", ok: Boolean(headers.get("strict-transport-security")), detail:"HSTS forces supported browsers to use HTTPS." },
      { id:"frame", title:"Clickjacking protection", ok: Boolean(headers.get("x-frame-options") || headers.get("content-security-policy")?.includes("frame-ancestors")), detail:"Protect pages from hostile framing." },
      { id:"nosniff", title:"MIME sniffing protection", ok: headers.get("x-content-type-options")?.toLowerCase() === "nosniff", detail:"X-Content-Type-Options: nosniff is recommended." },
      { id:"title", title:"Document title", ok: has(html, /<title[^>]*>[^<]{2,}<\/title>/i), detail:"A descriptive title helps users and search engines." },
      { id:"description", title:"Meta description", ok: has(html, /<meta[^>]+name=["']description["'][^>]+content=["'][^"']+/i) || has(html, /<meta[^>]+content=["'][^"']+["'][^>]+name=["']description["']/i), detail:"Add a useful meta description." },
      { id:"viewport", title:"Responsive viewport", ok: has(html, /<meta[^>]+name=["']viewport["']/i), detail:"Viewport metadata is important for mobile rendering." },
      { id:"lang", title:"Page language", ok: has(html, /<html[^>]+lang=["'][^"']+/i), detail:"Declare the document language for accessibility." },
      { id:"h1", title:"Primary heading", ok: count(html, /<h1\b/gi) > 0, detail:"Use a clear H1 for page structure." },
      { id:"alt", title:"Image alternative text", ok: !has(html, /<img\b(?![^>]*\balt=)[^>]*>/i), detail:"Images should provide alt text where meaningful." },
      { id:"referrer", title:"Referrer Policy", ok: Boolean(headers.get("referrer-policy")), detail:"A Referrer-Policy limits information shared when visitors follow links." },
      { id:"permissions", title:"Permissions Policy", ok: Boolean(headers.get("permissions-policy")), detail:"Permissions-Policy can restrict sensitive browser capabilities." },
      { id:"canonical", title:"Canonical URL", ok: has(html, /<link[^>]+rel=["'][^"']*canonical[^"']*["']/i), detail:"A canonical URL helps search engines understand the preferred page address." },
      { id:"robots", title:"Robots guidance", ok: has(html, /<meta[^>]+name=["']robots["']/i) || has(html, /<meta[^>]+name=["']googlebot["']/i), detail:"Explicit robots guidance makes indexing intent easier to audit." },
      { id:"og", title:"Social sharing metadata", ok: has(html, /<meta[^>]+property=["']og:/i), detail:"Open Graph metadata improves how pages appear when shared." },
    ];
    const passed = checks.filter(c => c.ok).length;
    const securityChecks = checks.filter(c=>["https","csp","hsts","frame","nosniff","referrer","permissions"].includes(c.id));
    const contentChecks = checks.filter(c=>["title","description","viewport","lang","h1","alt","canonical","robots","og"].includes(c.id));
    const security = Math.round(securityChecks.filter(c=>c.ok).length / securityChecks.length * 100);
    const seo = Math.round(contentChecks.filter(c=>c.ok).length / contentChecks.length * 100);
    const performanceScore = Math.max(0, Math.min(100, Math.round(100 - Math.max(0, ttfb - 250) / 20 - Math.max(0, bytes - 500_000) / 50_000)));
    return {
      url: response.url,
      fetchedAt: new Date().toISOString(),
      source: "CodeForensic Direct Web Probe",
      scores: { performance: performanceScore, accessibility: null, bestPractices: security, seo },
      metrics: {
        "server-response-time": { displayValue: `${ttfb} ms`, numericValue: ttfb },
        "total-load-time": { displayValue: `${totalMs} ms`, numericValue: totalMs },
        "transfer-size": { displayValue: `${(bytes/1024).toFixed(1)} KB`, numericValue: bytes },
        "http-status": { displayValue: String(response.status), numericValue: response.status },
      },
      opportunities: checks.filter(c=>!c.ok).map(c=>({ id:c.id, title:c.title, description:c.detail })),
      checks,
      details: {
        response: {
          finalUrl: response.url, status: response.status, statusText: response.statusText,
          contentType: headers.get("content-type"), server: headers.get("server"),
          cacheControl: headers.get("cache-control"), contentEncoding: headers.get("content-encoding")
        },
        securityHeaders: {
          csp: headers.get("content-security-policy"), hsts: headers.get("strict-transport-security"),
          xFrameOptions: headers.get("x-frame-options"), xContentTypeOptions: headers.get("x-content-type-options"),
          referrerPolicy: headers.get("referrer-policy"), permissionsPolicy: headers.get("permissions-policy")
        },
        document: {
          title: textMatch(html, /<title[^>]*>([^<]+)<\/title>/i),
          h1: textMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)?.replace(/<[^>]+>/g,"").trim() || null,
          language: textMatch(html, /<html[^>]+lang=["']([^"']+)/i),
          images: count(html, /<img\b/gi), imagesMissingAlt: count(html, /<img\b(?![^>]*\balt=)[^>]*>/gi),
          links: count(html, /<a\b/gi), scripts: count(html, /<script\b/gi), forms: count(html, /<form\b/gi),
          headings: count(html, /<h[1-6]\b/gi)
        }
      },
      probe: { status: response.status, ttfbMs: ttfb, totalMs, htmlBytes: bytes, passed, total: checks.length },
    };
  } finally { clearTimeout(timer); }
}

async function pageSpeed(target: URL, strategy: string) {
  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", target.toString());
  endpoint.searchParams.set("strategy", strategy);
  ["performance","accessibility","best-practices","seo"].forEach(c=>endpoint.searchParams.append("category",c));
  if (process.env.PAGESPEED_API_KEY) endpoint.searchParams.set("key", process.env.PAGESPEED_API_KEY);
  for (let attempt=0; attempt<2; attempt++) {
    const response = await fetch(endpoint, { headers: { "User-Agent":"CodeForensic/2.0" } });
    if (response.ok) return response.json();
    if (![429,500,503].includes(response.status)) throw new Error("PageSpeed provider rejected this audit");
    if (attempt === 0) await new Promise(r=>setTimeout(r,900));
  }
  return null;
}

router.post("/analyze", async (req: Request, res: Response) => {
  const raw = typeof req.body?.url === "string" ? req.body.url.trim() : "";
  const strategy = req.body?.strategy === "desktop" ? "desktop" : "mobile";
  if (!raw) return res.status(400).json({ success:false, message:"Website URL is required" });
  let target: URL;
  try {
    target = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!["http:","https:"].includes(target.protocol)) throw new Error();
    await assertPublic(target);
  } catch (e) {
    return res.status(400).json({ success:false, message:e instanceof Error && e.message ? e.message : "Enter a valid public website URL" });
  }

  const key = `${strategy}:${target.toString()}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return res.json({ success:true, audit:cached.value, cached:true });

  try {
    const direct = await nativeAudit(target);
    let audit:any = direct;
    try {
      const data:any = await pageSpeed(target,strategy);
      const lr=data?.lighthouseResult;
      if (lr) {
        const audits=lr.audits||{}, categories=lr.categories||{};
        const ids=["first-contentful-paint","largest-contentful-paint","speed-index","total-blocking-time","cumulative-layout-shift","interactive","server-response-time"];
        const metrics:any={...direct.metrics};
        ids.forEach(id=>{const a=audits[id]; if(a) metrics[id]={displayValue:a.displayValue,numericValue:a.numericValue,score:a.score};});
        const opportunities=Object.values(audits).filter((a:any)=>a&&typeof a.score==="number"&&a.score<.9&&a.title).sort((a:any,b:any)=>(a.score??1)-(b.score??1)).slice(0,12).map((a:any)=>({id:a.id,title:a.title,description:a.description,displayValue:a.displayValue}));
        audit={...direct,url:lr.finalDisplayedUrl||lr.finalUrl||direct.url,fetchedAt:lr.fetchTime||direct.fetchedAt,source:"Google Lighthouse + CodeForensic Direct Probe",scores:{performance:score(categories.performance?.score),accessibility:score(categories.accessibility?.score),bestPractices:score(categories["best-practices"]?.score),seo:score(categories.seo?.score)},metrics,opportunities:opportunities.length?opportunities:direct.opportunities};
      }
    } catch (providerError) {
      console.warn("PageSpeed unavailable; using direct probe:", providerError);
    }
    cache.set(key,{expires:Date.now()+5*60_000,value:audit});
    return res.json({success:true,audit});
  } catch (error) {
    console.error("Website analysis error:",error);
    return res.status(502).json({success:false,message:"The target website could not be reached from the audit engine"});
  }
});
export default router;
