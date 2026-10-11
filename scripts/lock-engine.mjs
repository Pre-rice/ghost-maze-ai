import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url), engine = new URL('../../ghost-maze/', import.meta.url);
const files={};const digest=createHash('sha256');
for(const file of readdirSync(new URL('src/core/',engine)).filter(n=>n.endsWith('.js')).sort()){
    const path='src/core/'+file;const hash=createHash('sha256').update(readFileSync(new URL(path,engine))).digest('hex');
    files[path]=hash;digest.update(path+':'+hash+'\n');
}
const revision='sha256:'+digest.digest('hex');
writeFileSync(new URL('engine.lock.json',root),JSON.stringify({schemaVersion:1,path:'../ghost-maze',revision,files},null,2)+'\n');
const manifestPath=new URL('data/manifests/seed-units.json',root);const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
manifest.ruleset=revision;manifest.source='原始种子保持不变；当前共同规则的证书验证见 verify:seeds';
writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');console.log(revision);
