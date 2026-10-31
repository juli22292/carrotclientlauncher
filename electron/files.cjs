const fs = require('node:fs/promises');
const path = require('node:path');
const { safeChild } = require('./network.cjs');
const gameNames = new Set(['mods','config','saves','resourcepacks','shaderpacks','screenshots','schematics','XaeroWaypoints','XaeroWorldMap','journeymap','defaultconfigs','kubejs','scripts','options.txt','optionsof.txt','optionsshaders.txt','servers.dat','servers.dat_old','hotbar.nbt','carrot-content.json','imported-client-settings']);
const privateName = name => /(?:^|[._-])(accounts?|auth|tokens?|sessions?|credentials|secrets?|cookies)(?:[._-]|$)/i.test(name);
function relativePath(value) {
  if (typeof value !== 'string' || !value || value.length > 220 || /[\x00-\x1f:*?"<>|]/.test(value)) throw new Error('Ungültiger Dateipfad.');
  const parts = value.replaceAll('\\','/').split('/');
  if (parts.some(p=>!p || p==='.' || p==='..' || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))) throw new Error('Ungültiger Dateipfad.');
  return parts.join('/');
}
function gamePath(value) { const p = relativePath(value); if (!gameNames.has(p.split('/')[0]) || p.split('/').some(privateName)) throw new Error('Diese Datei gehört nicht zu den übertragbaren Spieldaten: '+p); return p; }
async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }
async function copyTree(source, target, { signal, onFile, skipPrivate = true } = {}) {
  signal?.throwIfAborted(); const stat = await fs.lstat(source);
  if (stat.isSymbolicLink()) throw new Error('Verknüpfungen werden nicht übernommen: '+path.basename(source));
  try { if ((await fs.lstat(target)).isSymbolicLink()) throw new Error('Das Ziel ist eine Verknüpfung.'); } catch(e) { if(e.code!=='ENOENT')throw e; }
  if (stat.isDirectory()) {
    await fs.mkdir(target,{recursive:true});
    for (const entry of await fs.readdir(source)) { relativePath(entry); if (skipPrivate && privateName(entry)) continue; await copyTree(path.join(source,entry),safeChild(target,entry),{signal,onFile,skipPrivate}); }
  } else if (stat.isFile()) { await fs.mkdir(path.dirname(target),{recursive:true}); await fs.copyFile(source,target); onFile?.(stat.size); }
}
async function copyGame(source,target,options={}) {
  for (const name of await fs.readdir(source)) if (gameNames.has(name)) await copyTree(safeChild(source,name),safeChild(target,name),options);
}
// All cleanup targets are derived children of the explicitly supplied private workspace.
async function removeChild(root,target) { const absolute=path.resolve(target); if (safeChild(root,path.relative(root,absolute))!==absolute) throw new Error('Ungültiges Arbeitsverzeichnis.'); await fs.rm(absolute,{recursive:true,force:true,maxRetries:3}); }
async function readJson(file, max=4*1024*1024) { if ((await fs.stat(file)).size>max) throw new Error('Die Profildatei ist zu groß.'); return JSON.parse((await fs.readFile(file,'utf8')).replace(/^\uFEFF/,'')); }
module.exports={gameNames,privateName,relativePath,gamePath,exists,copyTree,copyGame,removeChild,readJson};
