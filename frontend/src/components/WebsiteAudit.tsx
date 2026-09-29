import { Activity, AlertTriangle, CheckCircle2, Gauge, Globe2, Info, RefreshCw, Search, ShieldCheck, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { analyzeWebsite } from "../lib/api";

type Check={id:string;title:string;ok:boolean;detail:string};
type Audit={
  url:string;fetchedAt:string;source?:string;
  scores:{performance:number|null;accessibility:number|null;bestPractices:number|null;seo:number|null};
  metrics:Record<string,{displayValue?:string;numericValue?:number}>;
  opportunities:Array<{id:string;title:string;description?:string;displayValue?:string}>;
  checks?:Check[];
  probe?:{status:number;ttfbMs:number;totalMs:number;htmlBytes:number;passed:number;total:number};
  details?:{response?:Record<string,string|number|null>;securityHeaders?:Record<string,string|null>;document?:Record<string,string|number|null>};
};
const grade=(v:number|null)=>v===null?"Not measured":v>=90?"Excellent":v>=75?"Good":v>=50?"Needs work":"Poor";
function Score({label,value,help}:{label:string;value:number|null;help:string}){
  const cls=value===null?"neutral":value>=90?"good":value>=50?"warn":"bad";
  return <div className={"web-score "+cls}><div className="score-ring"><strong>{value===null?"—":value}</strong></div><div><b>{label}</b><span>{grade(value)}</span><small>{help}</small></div></div>;
}
export default function WebsiteAudit(){
  const [url,setUrl]=useState(""); const [strategy,setStrategy]=useState<"mobile"|"desktop">("mobile");
  const [audit,setAudit]=useState<Audit|null>(null); const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [watch,setWatch]=useState(false);
  async function run(){if(!url.trim())return;setBusy(true);setError("");try{const r=await analyzeWebsite(url.trim(),strategy);setAudit(r.audit);}catch(e){setError(e instanceof Error?e.message:"Website analysis failed");}finally{setBusy(false);}}
  useEffect(()=>{if(!watch||!audit)return;const id=window.setInterval(run,60000);return()=>window.clearInterval(id);},[watch,audit?.url,strategy]);
  const m=audit?.metrics||{};
  const failed=(audit?.checks||[]).filter(c=>!c.ok), passed=(audit?.checks||[]).filter(c=>c.ok);
  const securityChecks=(audit?.checks||[]).filter(c=>["https","csp","hsts","frame","nosniff","referrer","permissions"].includes(c.id));
  const seoChecks=(audit?.checks||[]).filter(c=>["title","description","viewport","lang","h1","alt","canonical","robots","og"].includes(c.id));
  const statusMeaning=useMemo(()=>{const s=audit?.probe?.status;if(!s)return"";if(s>=200&&s<300)return"Target responded successfully.";if(s===403)return"The target refused this automated probe. Other observed headers and document evidence may still be useful.";if(s>=300&&s<400)return"The target returned a redirect response.";if(s>=400)return"The target returned an HTTP error to the probe.";return"HTTP response received.";},[audit?.probe?.status]);
  return <div className="web-audit web-audit-v2">
    <section className="web-hero"><div><div className="section-code">CODEFORENSIC / WEBSITE INTELLIGENCE</div><h2>Website X-Ray</h2><p>Inspect a public URL and turn technical web signals into a readable report: response health, security headers, document quality, SEO evidence and Lighthouse metrics when available.</p></div><div className="web-radar"><span/><span/><Globe2 size={34}/></div></section>
    <section className="web-how"><strong>WHAT THIS DOES</strong><span><b>1</b> Fetches the public page</span><span><b>2</b> Checks response + security headers</span><span><b>3</b> Inspects document structure</span><span><b>4</b> Explains what to improve</span></section>
    <div className="web-runner"><div className="web-url"><Search size={18}/><input value={url} onChange={e=>setUrl(e.target.value)} placeholder="Enter a public website — example.com" onKeyDown={e=>e.key==="Enter"&&run()}/></div><select value={strategy} onChange={e=>setStrategy(e.target.value as "mobile"|"desktop")}><option value="mobile">Mobile audit</option><option value="desktop">Desktop audit</option></select><button className="primary" onClick={run} disabled={busy}>{busy?<><RefreshCw className="spin" size={16}/> SCANNING</>:<><Zap size={16}/> ANALYZE WEBSITE</>}</button></div>
    {busy&&<div className="scan-progress"><span/><div><strong>Running a real website investigation</strong><small>Connecting → measuring response → inspecting headers → reading document evidence → requesting Lighthouse when available</small></div></div>}
    {error&&<div className="error-banner"><AlertTriangle size={16}/>{error}</div>}
    {audit&&<>
      <div className="web-audit-head"><div><small>ANALYZED TARGET</small><strong>{audit.url}</strong><span>{audit.source||"CodeForensic Web Engine"} · {new Date(audit.fetchedAt).toLocaleString()}</span></div><label className="watch-toggle"><input type="checkbox" checked={watch} onChange={e=>setWatch(e.target.checked)}/><span/> Re-run every 60 sec while this page is open</label></div>
      <section className="web-reading-guide"><Info size={18}/><div><strong>How to read this report</strong><p>Scores summarize observed evidence. Open the sections below for the exact checks. A dash means that metric was not measured in this run — it is not treated as zero.</p></div></section>
      <div className="web-scores">
        <Score label="Performance" value={audit.scores.performance} help="Response and Lighthouse speed evidence"/>
        <Score label="Accessibility" value={audit.scores.accessibility} help="Available only when Lighthouse returns it"/>
        <Score label="Security" value={audit.scores.bestPractices} help="Protection headers observed by CodeForensic"/>
        <Score label="SEO" value={audit.scores.seo} help="Document and search-readiness checks"/>
      </div>
      {audit.source?.startsWith("CodeForensic")&&<div className="audit-note"><ShieldCheck size={17}/><div><strong>Direct CodeForensic probe used</strong><span>Lighthouse was unavailable for this run. CodeForensic is showing only evidence it measured itself; unavailable browser metrics remain blank rather than being invented.</span></div></div>}
      <div className="web-metrics web-metrics-v2">
        <div><span>HTTP STATUS</span><strong>{audit.probe?.status??"—"}</strong><small>{statusMeaning}</small></div>
        <div><span>SERVER RESPONSE (TTFB)</span><strong>{m["server-response-time"]?.displayValue||"—"}</strong><small>Time until the server began responding.</small></div>
        <div><span>HTML TRANSFER</span><strong>{m["transfer-size"]?.displayValue||"—"}</strong><small>HTML bytes read by this probe, not all page assets.</small></div>
        <div><span>DIRECT PROBE</span><strong>{m["total-load-time"]?.displayValue||"—"}</strong><small>Server-side fetch duration; not browser page-load time.</small></div>
      </div>
      <section className="audit-narrative">
        <div><span>INVESTIGATION INTERPRETATION</span><h3>What this run actually tells you</h3></div>
        <p>The target returned HTTP <b>{audit.probe?.status??"—"}</b>. {statusMeaning} The server began responding in <b>{m["server-response-time"]?.displayValue||"an unmeasured time"}</b>, and this probe received <b>{m["transfer-size"]?.displayValue||"an unmeasured amount"}</b> of HTML. CodeForensic observed <b>{securityChecks.filter(c=>c.ok).length}/{securityChecks.length}</b> configured security controls and <b>{seoChecks.filter(c=>c.ok).length}/{seoChecks.length}</b> document/search checks passing.</p>
        <p>{audit.source?.startsWith("CodeForensic")?"This was a server-side direct probe, so it is evidence about the HTTP response and fetched HTML—not a simulation of a real visitor rendering the page. Browser-only metrics such as LCP, CLS and accessibility remain unreported unless Lighthouse completes successfully.":"Lighthouse evidence was available for this run, so browser-oriented scores can be read alongside CodeForensic's direct HTTP evidence."}</p>
      </section>
      <div className="web-detail-grid">
        <section className="audit-section"><header><div><ShieldCheck/><span><b>Security & headers</b><small>{passed.filter(c=>["https","csp","hsts","frame","nosniff","referrer","permissions"].includes(c.id)).length} protections observed</small></span></div></header><div className="check-grid">{(audit.checks||[]).filter(c=>["https","csp","hsts","frame","nosniff","referrer","permissions"].includes(c.id)).map(c=><div className={c.ok?"check-ok":"check-miss"} key={c.id}>{c.ok?<CheckCircle2/>:<AlertTriangle/>}<div><strong>{c.title}</strong><p>{c.ok?c.detail+" CodeForensic observed the expected signal on this response.":c.detail+" This signal was not observed and should be reviewed in the site configuration."}</p></div><b>{c.ok?"PASS":"REVIEW"}</b></div>)}</div></section>
        <section className="audit-section"><header><div><Globe2/><span><b>Document & SEO</b><small>What search engines and users can understand</small></span></div></header><div className="check-grid">{(audit.checks||[]).filter(c=>["title","description","viewport","lang","h1","alt","canonical","robots","og"].includes(c.id)).map(c=><div className={c.ok?"check-ok":"check-miss"} key={c.id}>{c.ok?<CheckCircle2/>:<AlertTriangle/>}<div><strong>{c.title}</strong><p>{c.ok?c.detail+" The fetched HTML contains this signal.":c.detail+" The fetched HTML did not expose this signal."}</p></div><b>{c.ok?"PASS":"IMPROVE"}</b></div>)}</div></section>
      </div>
      {audit.details?.document&&<section className="audit-section web-inventory"><header><div><Activity/><span><b>Page inventory</b><small>Observed HTML structure from this fetch</small></span></div></header><div className="inventory-grid">{Object.entries(audit.details.document).map(([k,v])=><div key={k}><span>{k.replace(/([A-Z])/g," $1")}</span><strong>{v??"Not found"}</strong></div>)}</div></section>}
      <section className="audit-section evidence-raw"><header><div><Info/><span><b>Observed response evidence</b><small>Values returned by the target or derived directly from this fetch</small></span></div></header><div className="raw-evidence-grid">{Object.entries(audit.details?.response||{}).map(([k,v])=><div key={k}><span>{k.replace(/([A-Z])/g," $1")}</span><code>{String(v??"Not returned")}</code></div>)}</div></section>
      <div className="web-findings"><div className="web-findings-title"><Gauge size={18}/><div><strong>Improvement plan</strong><span>{failed.length} direct checks need attention · ordered from observed evidence only</span></div></div>{audit.opportunities.length?audit.opportunities.slice(0,14).map((o,i)=><article key={o.id}><span className="finding-index">{String(i+1).padStart(2,"0")}</span><div><strong>{o.title}</strong><p>{o.description||"Review this audit for optimization."}</p></div><b>{o.displayValue||"REVIEW"}</b></article>):<div className="web-empty"><ShieldCheck size={22}/>No major issues were returned by this run.</div>}</div>
    </>}
    {!audit&&!busy&&<div className="web-empty-state"><div className="empty-orbit"><Globe2 size={32}/></div><h3>Analyze a real public website.</h3><p>Enter a URL above. CodeForensic will explain what it can measure and clearly mark anything it cannot.</p><div><span>HTTP</span><span>SECURITY</span><span>SEO</span><span>LIGHTHOUSE</span></div></div>}
  </div>;
}
