import { Activity, Gauge, Globe2, RefreshCw, Search, ShieldCheck, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { analyzeWebsite } from "../lib/api";

type Audit = {
  url: string;
  fetchedAt: string;
  scores: { performance: number | null; accessibility: number | null; bestPractices: number | null; seo: number | null };
  metrics: Record<string, { displayValue?: string; numericValue?: number }>;
  opportunities: Array<{ id: string; title: string; description?: string; displayValue?: string }>;
};

function Score({label,value}:{label:string;value:number|null}) {
  const cls=value===null?"neutral":value>=90?"good":value>=50?"warn":"bad";
  return <div className={"web-score "+cls}><strong>{value===null?"—":value}</strong><span>{label}</span></div>;
}

export default function WebsiteAudit(){
  const [url,setUrl]=useState("");
  const [strategy,setStrategy]=useState<"mobile"|"desktop">("mobile");
  const [audit,setAudit]=useState<Audit|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [watch,setWatch]=useState(false);

  async function run(){
    if(!url.trim()) return;
    setBusy(true); setError("");
    try { const r=await analyzeWebsite(url.trim(),strategy); setAudit(r.audit); }
    catch(e){ setError(e instanceof Error?e.message:"Website analysis failed"); }
    finally{ setBusy(false); }
  }

  useEffect(()=>{
    if(!watch || !audit) return;
    const id=window.setInterval(()=>{ run(); },60000);
    return ()=>window.clearInterval(id);
  },[watch,audit?.url,strategy]);

  const m=audit?.metrics||{};
  return <div className="web-audit">
    <section className="web-hero">
      <div><div className="section-code">LIVE WEBSITE INTELLIGENCE</div><h2>Analyze any public website.</h2>
      <p>Real Lighthouse/PageSpeed evidence for performance, accessibility, best practices and SEO.</p></div>
      <Globe2 size={42}/>
    </section>
    <div className="web-runner">
      <div className="web-url"><Search size={18}/><input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://your-website.com" onKeyDown={e=>e.key==="Enter"&&run()}/></div>
      <select value={strategy} onChange={e=>setStrategy(e.target.value as "mobile"|"desktop")}><option value="mobile">Mobile</option><option value="desktop">Desktop</option></select>
      <button className="primary" onClick={run} disabled={busy}>{busy?<><RefreshCw className="spin" size={16}/> ANALYZING</>:<><Zap size={16}/> RUN AUDIT</>}</button>
    </div>
    {error&&<div className="error-banner">{error}</div>}
    {audit&&<>
      <div className="web-audit-head"><div><strong>{audit.url}</strong><span>Last tested {new Date(audit.fetchedAt).toLocaleString()}</span></div>
      <label className="watch-toggle"><input type="checkbox" checked={watch} onChange={e=>setWatch(e.target.checked)}/><span/> Background watch · every 60s</label></div>
      <div className="web-scores">
        <Score label="Performance" value={audit.scores.performance}/><Score label="Accessibility" value={audit.scores.accessibility}/>
        <Score label="Best practices" value={audit.scores.bestPractices}/><Score label="SEO" value={audit.scores.seo}/>
      </div>
      <div className="web-metrics">
        {[
          ["first-contentful-paint","FCP"],["largest-contentful-paint","LCP"],["speed-index","Speed Index"],
          ["total-blocking-time","Blocking"],["cumulative-layout-shift","Layout Shift"],["interactive","Interactive"]
        ].map(([id,label])=><div key={id}><span>{label}</span><strong>{m[id]?.displayValue||"—"}</strong></div>)}
      </div>
      <div className="web-findings">
        <div className="web-findings-title"><Gauge size={18}/><div><strong>Improvement opportunities</strong><span>Evidence returned by the audit engine</span></div></div>
        {audit.opportunities.length?audit.opportunities.slice(0,10).map(o=><article key={o.id}><Activity size={16}/><div><strong>{o.title}</strong><p>{o.description||"Review this audit for optimization."}</p></div><b>{o.displayValue||""}</b></article>):<div className="web-empty"><ShieldCheck size={22}/>No major opportunities were returned by this run.</div>}
      </div>
    </>}
    {!audit&&!busy&&<div className="web-empty-state"><Globe2 size={30}/><h3>Paste a public URL to begin</h3><p>CodeForensic will request a real performance audit. No demo scores are shown.</p></div>}
  </div>
}
