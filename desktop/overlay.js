const api=window.cfAgent,orb=document.querySelector("#orb");let open=false;
orb.onclick=()=>{open=!open;document.body.classList.toggle("open",open);api.expand(open)};
document.querySelector("#close").onclick=()=>orb.click();
async function poll(){const x=await api.telemetry();cpu.textContent=x.cpu+"%";mem.textContent=x.memoryUsed+"%";memd.textContent=x.memoryFreeGB+" GB free / "+x.memoryTotalGB+" GB";def.textContent="WINDOWS";up.textContent=Math.floor(x.uptime/3600)+"h";host.textContent=x.host+" · "+x.platform}
setInterval(poll,1200);poll();
document.querySelectorAll("[data-scan]").forEach(b=>b.onclick=()=>{result.textContent="Opening Windows Security for a real Microsoft Defender scan. CodeForensic does not invent scan results.";api.openSecurity()});
document.querySelector("#security").onclick=()=>api.openSecurity();