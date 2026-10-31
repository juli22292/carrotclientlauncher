// Opt-in integration check against the official distribution services.
// Uses only this ignored test workspace; does not read launcher accounts or user worlds.
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const {Store}=require('../electron/store.cjs');
const {Engine}=require('../electron/engine.cjs');
const {offlineSession}=require('../electron/auth.cjs');
const {tail}=require('../electron/diagnostics.cjs');
async function main(){
 const root=path.resolve('test-results/loader-live');await fs.mkdir(root,{recursive:true});
 const store=await new Store(root).init();await store.settings({memory:2048,minimizeOnLaunch:false});
 let last=0;
 const engine=new Engine(store,(event,value)=>{if(event==='status'&&Date.now()-last>5000){last=Date.now();const job=value.jobs.find(j=>j.state==='running');if(job)console.log(job.name,job.progress+'%',job.stage);}});
 const targets=process.env.CARROT_LIVE_LOADERS?.split(',')||['forge','neoforge','quilt'];
 for(const loader of targets){
   const mc=process.env.CARROT_LIVE_MC||'1.21.1';let instance=store.data.instances.find(i=>i.loader===loader&&i.version===mc);
   if(!instance)instance=await store.create({name:'Integration '+loader+' '+mc,version:mc,loader});
   console.log('INSTALL',loader,mc);await engine.install(instance.id);
   const installed=JSON.parse(await fs.readFile(path.join(store.directory(instance.id),'profile.json'),'utf8'));
   assert(installed.profile.mainClass);assert(instance.loaderVersion);assert(instance.installed);
   console.log('PASS installed',loader,instance.loaderVersion,installed.profile.mainClass);
   if(process.argv.includes('--launch')){
     await fs.rm(path.join(store.directory(instance.id),'logs','latest.log'),{force:true});
     const errors=[];const original=engine.emit;engine.emit=(event,value)=>{if(event==='game-error')errors.push(value.message);original(event,value);};
     await engine.launch(instance.id,offlineSession('CarrotTest'));
     const child=engine.running.get(instance.id);let ready=false;
     try{
       const deadline=Date.now()+120000;
       while(Date.now()<deadline&&engine.running.has(instance.id)){
         const log=await tail(path.join(store.directory(instance.id),'logs','latest.log')).catch(()=>'');
         if(/Created:.*minecraft:textures\/atlas\/particles|Created:.*minecraft:particles-atlas|OpenAL initialized/i.test(log)){ready=true;break;}
         await new Promise(resolve=>setTimeout(resolve,1000));
       }
       assert(ready,'Minecraft did not finish initialization: '+errors.join(' ')+'\n'+await tail(path.join(store.directory(instance.id),'launcher-game.log'),5000));
       console.log('PASS game initialized',loader,instance.loaderVersion);
     }finally{child?.kill();await new Promise(resolve=>setTimeout(resolve,1000));engine.emit=original;}
   }
 }
 await store.pending;console.log('Integration data:',root);
}
main().catch(error=>{console.error(error);process.exitCode=1});
