const fs = require('node:fs');
const path = require('node:path');
async function main() {
  let sharp;
  try { sharp = require('sharp'); } catch { sharp = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp')); }
  const png = await sharp('assets/icon.svg').resize(256,256).png().toBuffer();
  fs.writeFileSync('assets/icon.png', png);
  const header = Buffer.alloc(22); header.writeUInt16LE(1,2); header.writeUInt16LE(1,4); header.writeUInt16LE(1,10); header.writeUInt16LE(32,12); header.writeUInt32LE(png.length,14); header.writeUInt32LE(22,18);
  fs.writeFileSync('assets/icon.ico',Buffer.concat([header,png]));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
