const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {Store,validateSettings}=require('../electron/store.cjs');
const {translateMessage:t}=require('../electron/localization.cjs');
const messages=require('../electron/locales/en.json');
const {DiscordPresence}=require('../electron/discord.cjs');
const {report}=require('../electron/diagnostics.cjs');

test('language defaults migrate old profiles safely, persist and reject unsupported values',async context=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'carrot-language-'));
 context.after(async()=>{assert.equal(path.dirname(root),os.tmpdir());assert(path.basename(root).startsWith('carrot-language-'));await fs.rm(root,{recursive:true,force:true,maxRetries:5});});
 const store=await new Store(root).init(),instance=await store.create({name:'Startseite',version:'1.21.1',loader:'fabric'});
 assert.equal(store.data.settings.language,'de');await store.settings({language:'en'});assert.equal((await new Store(root).init()).data.settings.language,'en');
 await store.settings({language:'xx',memory:4096});assert.equal(store.data.settings.language,'en');assert.deepEqual(validateSettings({language:'../en'}),{});
 const saved=JSON.parse(await fs.readFile(store.file,'utf8'));delete saved.settings.language;await fs.writeFile(store.file,JSON.stringify(saved));const migrated=await new Store(root).init();assert.equal(migrated.data.settings.language,'de');assert.equal(migrated.instance(instance.id).name,'Startseite');
});

test('every translated message has matching placeholders and preserves inserted values verbatim',()=>{
 const params={0:'Name {0} $& <test>',1:'1.21.1',2:'Fabric',3:'other',4:'data',5:'last'};
 for(const [source,target] of Object.entries(messages)){
  assert.equal(t(source,'de'),source,'Canonical German message changed: '+source);
  assert(source.trim()&&target.trim());assert.deepEqual([...source.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort(),[...target.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort(),source);
  const expected=target.replace(/\{(\d+)\}/g,(_,key)=>params[key]);assert.equal(t(source,'en',params),expected,source);
 }
 assert.equal(t('Für Minecraft {0} ist keine {1}-Version verfügbar.','en',{0:'1.21.1',1:'Quilt'}),'No Quilt version is available for Minecraft 1.21.1.');
 assert.equal(t('Die Datei my.zip ist bereits vorhanden. Entferne zuerst die bisherige Datei oder verwende das Mod-Update.','en'),'The file my.zip already exists. Remove the previous file first or use the mod update.');
 assert.equal(t('  Zugriff auf my-file.zip verweigert.  ','en'),'  Zugriff auf my-file.zip verweigert.  ');
 assert.equal(t('Version 0.0.6 is available.','de'),'Version 0.0.6 ist verfügbar.');assert.equal(t(null,'en'),null);assert.equal(t(42,'en'),42);
 assert.equal(t('Update to 0.0.6','de'),'Update auf 0.0.6');assert.equal(t('Update anzeigen','de'),'Update anzeigen');
});

test('Discord menu and loader activity follow the selected interface language',()=>{
 const p=new DiscordPresence({paths:[]});p.update(null,'en');assert.equal(p.activity.details,'Active in the main menu');p.update({loader:'neoforge',version:'1.21.1'},'en');assert.equal(p.activity.details,'Playing NeoForge 1.21.1');p.update(null,'de');assert.equal(p.activity.details,'Aktiv im Hauptmenü');p.stop();
});

test('diagnostic explanations and exports use English without changing the game log',async context=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'carrot-diagnostic-language-'));context.after(async()=>{assert.equal(path.dirname(root),os.tmpdir());assert(path.basename(root).startsWith('carrot-diagnostic-language-'));await fs.rm(root,{recursive:true,force:true,maxRetries:5});});
 const store=await new Store(root).init(),i=await store.create({name:'World',version:'1.21.1',loader:'vanilla'});await store.settings({language:'en'});i.lastExitCode=1;const raw='java.lang.OutOfMemoryError: original game text';await fs.writeFile(path.join(store.directory(i.id),'launcher-game.log'),raw);const result=await report(store,i.id);assert.equal(result.title,'Not enough memory');assert(result.help.startsWith('Close other programs.'));assert(result.text.includes(raw));assert(result.text.includes('Not enough memory'));
});
