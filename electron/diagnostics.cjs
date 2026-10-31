const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {exists}=require('./files.cjs');
function redact(text,secrets=[]){
 let value=String(text);for(const s of secrets.filter(s=>typeof s==='string'&&s.length>3))value=value.split(s).join('[ENTFERNT]');
 for(const folder of [os.homedir(),process.env.APPDATA,process.env.LOCALAPPDATA].filter(Boolean))value=value.split(folder).join('[BENUTZERORDNER]');
 return value.replace(/\bBearer\s+\S+/gi,'Bearer [ENTFERNT]').replace(/((?:access[_-]?token|refresh[_-]?token|client[_-]?secret|authorization|password|session[_-]?id)["']?\s*[:=]\s*["']?)[^\s,"'}]+/gi,'$1[ENTFERNT]').replace(/(--(?:accessToken|username|uuid|xuid)\s+)\S+/gi,'$1[ENTFERNT]').replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[TOKEN ENTFERNT]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[E-MAIL ENTFERNT]').replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g,'[IP ENTFERNT]').replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,'[UUID ENTFERNT]').replace(/C:\\Users\\[^\\\s]+/gi,'[BENUTZERORDNER]');
}
function explain(log,code){
 if(/OutOfMemoryError|Could not reserve enough space|insufficient memory|Native memory allocation.*failed/i.test(log))return {title:'Zu wenig Arbeitsspeicher',help:'Schließe andere Programme. Prüfe die RAM-Zuweisung unter Einstellungen; lass auch Windows genügend Arbeitsspeicher.'};
 if(/Incompatible mod set|incompatible mods|Mod resolution encountered|requires.*(?:version|fabric|minecraft)|depends on/i.test(log))return {title:'Mods passen nicht zusammen',help:'Prüfe Minecraft-Version und Mod-Abhängigkeiten. Deaktiviere zuletzt hinzugefügte Mods oder stelle die Sicherung vor der Änderung wieder her.'};
 if(/UnsupportedClassVersionError|class file version|requires Java|Unrecognized VM option/i.test(log))return {title:'Die Java-Version passt nicht',help:'Wähle unter Einstellungen bei Java „Automatisch“. Der Launcher lädt die zur Minecraft-Version passende Laufzeit.'};
 if(/GLFW error|Pixel format not accelerated|Failed to create.*window|OpenGL/i.test(log))return {title:'Grafik konnte nicht gestartet werden',help:'Prüfe den Grafiktreiber und teste die Instanz ohne Shader. Starte anschließend Windows neu.'};
 return {title:'Minecraft wurde unerwartet beendet',help:`Das Spiel hat Fehlercode ${code ?? 'unbekannt'} gemeldet. Im bereinigten Protokoll findest du weitere Hinweise. Prüfe zuletzt geänderte Mods oder nutze ein Backup.`};
}
async function tail(file,max=512*1024){if(!await exists(file))return '';const h=await fs.open(file,'r');try{const size=(await h.stat()).size,length=Math.min(size,max),buffer=Buffer.alloc(length);await h.read(buffer,0,length,size-length);return buffer.toString('utf8');}finally{await h.close();}}
async function report(store,id,secrets=[]){const i=store.instance(id),game=store.directory(id);const sections=[];for(const name of ['launcher-game.log','logs/latest.log']){const text=await tail(path.join(game,name));if(text)sections.push(`--- ${name} ---\n${text}`);}const crashDir=path.join(game,'crash-reports');if(await exists(crashDir)){const files=(await fs.readdir(crashDir)).filter(n=>/^crash-[\w.-]+\.txt$/.test(n)).sort();if(files.length)sections.push('--- Letzter Absturzbericht ---\n'+await tail(path.join(crashDir,files.at(-1))));}
 const raw=sections.join('\n\n'),diagnosis=!raw?{title:'Noch kein Spielprotokoll vorhanden',help:'Nach dem ersten Spielstart findest du hier das Protokoll und bei einem Absturz mögliche Ursachen.'}:i.lastExitCode===0?{title:'Minecraft wurde regulär beendet',help:'Im Protokoll kannst du den letzten Spielstart nachlesen.'}:explain(raw,i.lastExitCode);return {...diagnosis,text:redact(`CarrotClientLauncher ${require('../package.json').version}\nMinecraft ${i.version} / ${i.loader}\n${diagnosis.title}\n${diagnosis.help}\n\n${raw||'Noch kein Spielprotokoll vorhanden.'}`,secrets),hasLogs:!!raw};}
module.exports={redact,explain,tail,report};
