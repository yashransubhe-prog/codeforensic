const {app,BrowserWindow,ipcMain,screen,shell}=require("electron");
const os=require("os"),path=require("path");
let win,lastCpu=os.cpus();
function cpuUsage(){const now=os.cpus();let idle=0,total=0;now.forEach((c,i)=>{const nt=Object.values(c.times).reduce((a,b)=>a+b,0),pt=Object.values(lastCpu[i].times).reduce((a,b)=>a+b,0);idle+=c.times.idle-lastCpu[i].times.idle;total+=nt-pt});lastCpu=now;return total?Math.round((1-idle/total)*100):0}
function create(){const a=screen.getPrimaryDisplay().workArea;win=new BrowserWindow({width:68,height:68,x:a.x+a.width-92,y:a.y+a.height-100,frame:false,transparent:true,resizable:false,alwaysOnTop:true,skipTaskbar:true,hasShadow:false,webPreferences:{preload:path.join(__dirname,"preload.cjs"),contextIsolation:true,nodeIntegration:false}});win.setAlwaysOnTop(true,"floating");win.loadFile("overlay.html")}
ipcMain.handle("agent:telemetry",()=>({cpu:cpuUsage(),memoryUsed:Math.round((1-os.freemem()/os.totalmem())*100),memoryFreeGB:+(os.freemem()/1073741824).toFixed(1),memoryTotalGB:+(os.totalmem()/1073741824).toFixed(1),uptime:Math.round(os.uptime()),platform:os.version(),host:os.hostname()}));
ipcMain.handle("agent:expand",(_,open)=>{const a=screen.getPrimaryDisplay().workArea,w=open?420:68,h=open?620:68;win.setBounds({x:a.x+a.width-w-24,y:a.y+a.height-h-24,width:w,height:h},true)});
ipcMain.handle("agent:security",()=>shell.openExternal("windowsdefender:"));
app.whenReady().then(create);app.on("window-all-closed",()=>app.quit());