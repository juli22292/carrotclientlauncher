const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { createWriteStream } = require('node:fs');
const USER_AGENT = `CarrotClientLauncher/${require('../package.json').version} (Windows desktop launcher)`;
const allowed = ['piston-meta.mojang.com', 'piston-data.mojang.com', 'launchermeta.mojang.com', 'launcher.mojang.com', 'libraries.minecraft.net', 'resources.download.minecraft.net', 'meta.fabricmc.net', 'maven.fabricmc.net', 'api.modrinth.com', 'cdn.modrinth.com', 'api.adoptium.net', 'github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'];
function checkUrl(url) { const u = new URL(url); if (u.protocol !== 'https:' || !allowed.includes(u.hostname) || u.username || u.password) throw new Error('Diese Download-Adresse ist nicht zugelassen.'); return u.href; }
function safeChild(root, relative) { const target = path.resolve(root, relative); if (!target.startsWith(path.resolve(root) + path.sep)) throw new Error('Ungültiger Dateipfad.'); return target; }
async function request(url, signal) {
  let current = checkUrl(url);
  for (let n = 0; n < 8; n++) {
    const response = await fetch(current, { redirect: 'manual', signal: AbortSignal.any([AbortSignal.timeout(120000), ...(signal ? [signal] : [])]), headers: { 'User-Agent': USER_AGENT } });
    if ([301, 302, 303, 307, 308].includes(response.status)) { current = checkUrl(new URL(response.headers.get('location'), current).href); await response.body?.cancel(); continue; }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`Download fehlgeschlagen (${response.status}, ${new URL(current).hostname}).`); }
    return response;
  }
  throw new Error('Zu viele Weiterleitungen beim Download.');
}
async function json(url, signal) { return (await request(url, signal)).json(); }
async function hashFile(file, algorithm) { const hash = crypto.createHash(algorithm); const { createReadStream } = require('node:fs'); for await (const chunk of createReadStream(file)) hash.update(chunk); return hash.digest('hex'); }
async function download(item, file, signal, onBytes) {
  const algorithm = item.sha512 ? 'sha512' : item.sha256 ? 'sha256' : 'sha1', expected = item.sha512 || item.sha256 || item.sha1;
  try { const s = await fs.stat(file); if ((item.size == null || s.size === item.size) && (!expected || await hashFile(file, algorithm) === expected)) return; } catch {}
  await fs.mkdir(path.dirname(file), { recursive: true });
  for (let attempt = 0; attempt < 3; attempt++) {
    signal?.throwIfAborted();
    const temp = file + '.' + crypto.randomBytes(5).toString('hex') + '.part';
    try {
      const response = await request(item.url, signal);
      if(item.maxSize && Number(response.headers.get('content-length'))>item.maxSize){await response.body?.cancel();throw new Error('Die Download-Datei ist zu groß.');}
      const stream = Readable.fromWeb(response.body);
      let received=0;
      stream.on('data', chunk => { received+=chunk.length;if(item.maxSize&&received>item.maxSize)stream.destroy(new Error('Die Download-Datei ist zu groß.'));onBytes?.(chunk.length); });
      await pipeline(stream, createWriteStream(temp), { signal });
      if (item.size != null && (await fs.stat(temp)).size !== item.size) throw new Error('Der Download ist unvollständig.');
      if (expected && await hashFile(temp, algorithm) !== expected) throw new Error('Die Prüfsumme des Downloads stimmt nicht.');
      await fs.rename(temp, file); return;
    } catch (e) { await fs.rm(temp, { force: true }).catch(() => {}); if (signal?.aborted || attempt === 2) throw e; }
  }
}
async function pool(items, task, count = 8) {
  let index = 0, failure;
  await Promise.all(Array.from({ length: Math.min(count, items.length) }, async () => { while (!failure && index < items.length) { const item = items[index++]; try { await task(item); } catch (e) { failure = e; } } }));
  if (failure) throw failure;
}
module.exports = { json, download, hashFile, pool, safeChild, checkUrl };
