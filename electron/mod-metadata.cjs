const AdmZip=require('adm-zip');
function modMetadata(file){
  try {
    const archive=new AdmZip(file);
    const read=name=>{const e=archive.getEntry(name);return e&&e.header.size<512000?e.getData().toString('utf8'):'';};
    const fabric=read('fabric.mod.json');if(fabric)return JSON.parse(fabric);
    const quilt=read('quilt.mod.json');if(quilt){const q=JSON.parse(quilt).quilt_loader;return {id:q?.id,name:q?.metadata?.name,version:q?.version};}
    const toml=read('META-INF/neoforge.mods.toml')||read('META-INF/mods.toml');
    if(toml){const first=toml.split('[[mods]]')[1]?.split(/\[\[/)[0]||toml;const field=name=>first.match(new RegExp('^\\s*'+name+'\\s*=\\s*["\']([^"\']+)["\']','m'))?.[1];let version=field('version');if(version?.includes('${'))version=read('META-INF/MANIFEST.MF').match(/^Implementation-Version:\s*(.+)$/m)?.[1]?.trim();return {id:field('modId'),name:field('displayName'),version};}
  }catch{}
  return {};
}
module.exports={modMetadata};
