const { spawnSync } = require('node:child_process');
const { version } = require('../package.json');
const repository = 'juli22292/carrotclientlauncher', tag = 'v' + version;
function gh(args, capture = false) {
  const result = spawnSync('gh', args, { encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit', windowsHide: true });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || 'GitHub CLI failed.');
  return result.stdout;
}
async function main() {
  const response = await fetch(`https://api.github.com/repos/${repository}/releases/tags/${tag}`, { headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'CarrotClientLauncher-Release' }, signal: AbortSignal.timeout(30000) });
  if (response.status === 404) {
    gh(['release', 'create', tag, '--repo', repository, '--target', process.env.GITHUB_SHA, '--title', `CarrotClientLauncher ${version}`, '--notes-file', 'RELEASE-NOTES.md', '--draft']);
  } else {
    if (!response.ok) throw new Error('Cannot inspect existing release: HTTP ' + response.status);
    if (!(await response.json()).draft) throw new Error('This version is already public. Published releases are not overwritten.');
  }
  const assets = ['carrotclientlaunchersetup.exe', 'carrotclientlaunchersetup.exe.blockmap', 'carrotclientlauncher.exe', 'latest.yml', 'SHA256SUMS.txt'].map(file => 'release/' + file);
  gh(['release', 'upload', tag, '--repo', repository, ...assets, '--clobber']);
  gh(['release', 'edit', tag, '--repo', repository, '--draft=false', '--latest']);
  console.log(`Published https://github.com/${repository}/releases/tag/${tag}`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
