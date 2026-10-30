const { _electron: electron } = require('@playwright/test');
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const asar = require('@electron/asar');
const { setTimeout: delay } = require('node:timers/promises');

function run(file, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { windowsHide: true, stdio: 'ignore', env });
    const timeout = setTimeout(() => reject(new Error('Installer test process timed out.')), 90000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); code === 0 ? resolve() : reject(new Error('Installer exited with code ' + code)); });
  });
}
async function main() {
  const system = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "$found = @('HKCU:/Software/Microsoft/Windows/CurrentVersion/Uninstall','HKLM:/Software/Microsoft/Windows/CurrentVersion/Uninstall') | Where-Object { Test-Path $_ } | ForEach-Object { Get-ChildItem $_ | Get-ItemProperty } | Where-Object DisplayName -eq 'CarrotClientLauncher'; @{installed = @($found).Count -gt 0; desktop = [Environment]::GetFolderPath('Desktop'); programs = [Environment]::GetFolderPath('Programs')} | ConvertTo-Json -Compress"], { encoding: 'utf8', windowsHide: true }));
  if (system.installed) throw new Error('CarrotClientLauncher is already installed. Run installer tests in a clean Windows test account.');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'carrot-setup-test-'));
  const directory = path.join(root, 'CarrotClientLauncherApp'), data = path.join(root, 'data');
  await fs.mkdir(data);
  await fs.writeFile(path.join(data, 'preserve-user-data.txt'), 'keep');
  const env = { ...process.env, CARROT_DATA_DIR: data, CARROT_DISABLE_DISCORD: '1', CARROT_DISABLE_UPDATES: '1' };
  const desktop = path.join(system.desktop, 'CarrotClientLauncher.lnk');
  const startMenu = path.join(system.programs, 'CarrotClientLauncher.lnk');
  const backups = [];
  for (const file of [desktop, startMenu].filter(Boolean)) { try { backups.push([file, await fs.readFile(file)]); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
  let app, installed = false;
  try {
    await run(path.resolve('release/carrotclientlaunchersetup.exe'), ['/S', '/currentuser', '/D=' + directory], env);
    installed = true;
    assert.equal(path.basename(directory), 'CarrotClientLauncherApp');
    const executable = path.join(directory, 'carrotclientlauncher.exe');
    await fs.access(executable);
    const archive = path.join(directory, 'resources/app.asar');
    assert.equal(JSON.parse(asar.extractFile(archive, 'package.json')).version, require('../package.json').version);
    const feed = await fs.readFile(path.join(directory, 'resources/app-update.yml'), 'utf8');
    assert.match(feed, /owner: juli22292/); assert.match(feed, /repo: carrotclientlauncher/);
    app = await electron.launch({ executablePath: executable, env, timeout: 60000 });
    const page = await app.firstWindow();
    await page.getByRole('heading', { name: 'Schön, dass du da bist.' }).waitFor();
    const info = await page.evaluate(() => window.carrot.getData());
    assert.equal(info.appVersion, require('../package.json').version); assert.equal(info.update.status, 'disabled');
    await page.getByRole('button', { name: 'Einstellungen', exact: true }).click();
    await page.getByRole('heading', { name: 'Launcher-Updates', exact: true }).waitFor();
    await page.screenshot({ path: 'test-results/installed-updates.png' });
    await app.close(); app = null;
    console.log('PASS: actual Windows installer installed and started version ' + info.appVersion + ' from CarrotClientLauncherApp, including its update configuration.');
  } finally {
    await app?.close().catch(() => {});
    if (installed) {
      assert.equal(path.dirname(directory), root); assert.equal(path.dirname(root), os.tmpdir()); assert.ok(path.basename(root).startsWith('carrot-setup-test-'));
      const files = await fs.readdir(directory).catch(() => []);
      const uninstaller = files.find(file => /^Uninstall.*\.exe$/i.test(file));
      if (uninstaller) {
        const uninstallPath = path.resolve(directory, uninstaller); assert.equal(path.dirname(uninstallPath), directory);
        await run(uninstallPath, ['/S'], env);
        const deadline = Date.now() + 15000;
        while (Date.now() < deadline) { try { await fs.access(path.join(directory, 'carrotclientlauncher.exe')); } catch { break; } await delay(100); }
        await assert.rejects(fs.access(path.join(directory, 'carrotclientlauncher.exe')));
        assert.equal(await fs.readFile(path.join(data, 'preserve-user-data.txt'), 'utf8'), 'keep');
        console.log('PASS: uninstaller removed the test application and preserved its user data.');
      }
    }
    for (const [file, bytes] of backups) await fs.writeFile(file, bytes);
    assert.equal(path.dirname(root), os.tmpdir()); assert.ok(path.basename(root).startsWith('carrot-setup-test-'));
    await fs.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
