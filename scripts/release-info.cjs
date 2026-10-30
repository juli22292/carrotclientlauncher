const fs = require('node:fs');
const { version } = require('../package.json');
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Releases require a stable major.minor.patch version.');
const repository = 'juli22292/carrotclientlauncher';
const tag = 'v' + version;
async function main() {
  const response = await fetch(`https://api.github.com/repos/${repository}/releases/tags/${tag}`, {
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${process.env.GH_TOKEN}`, 'User-Agent': 'CarrotClientLauncher-Release' }, signal: AbortSignal.timeout(30000)
  });
  if (!response.ok && response.status !== 404) throw new Error('Cannot inspect release: HTTP ' + response.status);
  const release = response.ok ? await response.json() : null;
  const publish = !release || release.draft;
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `publish=${publish}\nversion=${version}\ntag=${tag}\n`);
  console.log(publish ? `Building ${tag}.` : `${tag} is already published; increase package.json version to release another update.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
