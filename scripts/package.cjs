process.env.ELECTRON_BUILDER_COMPRESSION_LEVEL ||= '5';
const { build, Platform, Arch } = require('electron-builder');
build({ targets: Platform.WINDOWS.createTarget(['nsis', 'portable'], Arch.x64), publish: process.env.CARROT_PUBLISH === '1' ? 'always' : 'never' }).catch(e => { console.error(e); process.exitCode = 1; });
