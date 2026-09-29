import { Activity, CheckCircle2, Gauge, Globe2, RefreshCw, Search, ShieldCheck, TimerReset, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { analyzeWebsite } from "../lib/api";

type Audit = {
  url:string; fetchedAt:string; source?:string;
  scores:{performance:number|null;accessibility:number|null;bestPractices:number|null;seo:number|null};
  metrics:Record<string,{displayValue?:string;numericValue?:number}>;
  opportunities:Array<{id:string;title:string;description?:string;displayValue?:string}>;
  probe?:{status:number;ttfbMs:number;totalMs:number;htmlBytes:number;passed:number;total:number};
};
function Score({label,value}:{label:string;value:number|null}) {
  const cls=value===null?"neutral":value>=90?"good":value>=50?"warn":"bad";
  return <div className={"web-score "+cls}><div className="score-ring"><strong>{value===null?"—":value}</strong></div><span>{label}</span></div>;
}
export default function WebsiteAudit(){
  const [url,setUrl]=useState(""); const [strategy,setStrategy]=useState<"mobile"|"desktop">("mobile");
  const [audit,setAudit]=useState<Audit|null>(null); const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [watch,setWatch]=useState(false);
  async function run(){if(!url.trim())return;setBusy(true);setError("");try{const r=await analyzeWebsite(url.trim(),strategy);setAudit(r.audit);}catch(e){setError(e instanceof Error?e.message:"Website analysis failed");}finally{setBusy(false);}}
  useEffect(()=>{if(!watch||!audit)return;const id=window.setInterval(run,60000);return()=>window.clearInterval(id);},[watch,audit?.url,strategy]);
  const m=audit?.metrics||{};
  const metricCards=[["server-response-time","Server response"],["total-load-time","Direct fetch"],["transfer-size","HTML size"],["largest-contentful-paint","LCP"],["total-blocking-time","Blocking"],["cumulative-layout-shift","Layout shift"]];
  return <div className="web-audit">
    <section className="web-hero"><div><div className="section-code">CF / WEB INTELLIGENCE</div><h2>Website X-Ray</h2><p>Performance, delivery, security headers, SEO and Lighthouse evidence — measured from the URL you enter.</p></div><div className="web-radar"><span/><span/><Globe2 size={34}/></div></section>
    <div className="web-runner"><div className="web-url"><Search size={18}/><input value={url} onChange={e=>setUrl(e.target.value)} placeholder="Enter a public website — example.com" onKeyDown={e=>e.key==="Enter"&&run()}/></div><select value={strategy} onChange={e=>setStrategy(e.target.value as "mobile"|"desktop")}><option value="mobile">Mobile audit</option><option value="desktop">Desktop audit</option></select><button className="primary" onClick={run} disabled={busy}>{busy?<><RefreshCw className="spin" size={16}/> SCANNING</>:<><Zap size={16}/> ANALYZE</>}</button></div>
    {busy&&<div className="scan-progress"><span/><div><strong>Running live web investigation</strong><small>Connecting → measuring response → checking headers → requesting Lighthouse when available</small></div></div>}
    {error&&<div className="error-banner">{error}</div>}
    {audit&&<>
      <div className="web-audit-head"><div><small>ANALYZED TARGET</small><strong>{audit.url}</strong><span>{audit.source||"CodeForensic Web Engine"} · {new Date(audit.fetchedAt).toLocaleString()}</span></div><label className="watch-toggle"><input type="checkbox" checked={watch} onChange={e=>setWatch(e.target.checked)}/><span/> Live watch · 60 sec</label></div>
      <div className="web-scores"><Score label="Performance" value={audit.scores.performance}/><Score label="Accessibility" value={audit.scores.accessibility}/><Score label="Security / Best practice" value={audit.scores.bestPractices}/><Score label="SEO" value={audit.scores.seo}/></div>
      {audit.source?.startsWith("CodeForensic")&&<div className="audit-note"><ShieldCheck size={17}/><div><strong>Direct forensic probe active</strong><span>Google Lighthouse quota was unavailable, so CodeForensic continued with its own real HTTP, security-header and document checks instead of failing.</span></div></div>}
      <div className="web-metrics">{metricCards.map(([id,label])=><div key={id}><span>{label}</span><strong>{m[id]?.displayValue||"—"}</strong></div>)}</div>
      {audit.probe&&<div className="probe-strip"><div><TimerReset/><span>HTTP status</span><b>{audit.probe.status}</b></div><div><Zap/><span>TTFB</span><b>{audit.probe.ttfbMs} ms</b></div><div><Activity/><span>Probe time</span><b>{audit.probe.totalMs} ms</b></div><div><CheckCircle2/><span>Checks passed</span><b>{audit.probe.passed}/{audit.probe.total}</b></div></div>}
      <div className="web-findings"><div className="web-findings-title"><Gauge size={18}/><div><strong>Evidence & improvement queue</strong><span>Only issues actually observed in this run</span></div></div>{audit.opportunities.length?audit.opportunities.slice(0,12).map((o,i)=><article key={o.id}><span className="finding-index">{String(i+1).padStart(2,"0")}</span><div><strong>{o.title}</strong><p>{o.description||"Review this audit for optimization."}</p></div><b>{o.displayValue||"INVESTIGATE"}</b></article>):<div className="web-empty"><ShieldCheck size={22}/>No major issues were returned by this run.</div>}</div>
    </>}
    {!audit&&!busy&&<div className="web-empty-state"><div className="empty-orbit"><Globe2 size={32}/></div><h3>Point CodeForensic at a website.</h3><p>No sample scores. No fake metrics. The report appears only after a real scan.</p><div><span>HTTP</span><span>SECURITY</span><span>SEO</span><span>LIGHTHOUSE</span></div></div>}
  </div>;
}
