const { spawn } = require('node:child_process');
const path = require('node:path');
const vite = spawn(process.execPath, [path.join(__dirname, '../node_modules/vite/bin/vite.js')], { stdio: 'inherit' });
let app;
const timer = setInterval(async () => {
  try {
    if (!(await fetch('http://127.0.0.1:5173')).ok) return;
    clearInterval(timer);
    app = spawn(require('electron'), ['.'], { stdio: 'inherit', env: { ...process.env, CARROT_DEV_URL: 'http://127.0.0.1:5173' } });
    app.on('exit', () => { vite.kill(); process.exit(); });
  } catch {}
}, 300);
process.on('SIGINT', () => { vite.kill(); app?.kill(); process.exit(); });
