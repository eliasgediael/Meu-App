const path=require('path'),esbuild=require('esbuild');
const {ok}=require('../harness/carregar.js');
for(const [entry,platform,format] of [['src/motor/index.js','browser','iife'],['src/native-bridge.js','browser','iife'],['worker/src/index.js','node','esm']]) {
  try {
    const r=esbuild.buildSync({entryPoints:[path.resolve(entry)],bundle:true,platform,format,write:false,charset:'utf8'});
    ok(r.outputFiles[0].contents.length>0,'bundle '+entry+' compila sem sobrescrever www/');
  }catch(e){ok(false,'bundle '+entry+': '+e.message);}
}
