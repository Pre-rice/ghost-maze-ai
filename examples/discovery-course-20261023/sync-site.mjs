import fs from 'node:fs';
const root=new URL('./levels/',import.meta.url),levels=fs.readdirSync(root).filter(name=>/^\d+$/.test(name)).sort().map(id=>{const s=JSON.parse(fs.readFileSync(new URL(`${id}/share.json`,root)));return {id,url:s.url};});
const payload={updated:new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',dateStyle:'short',timeStyle:'short'}).format(new Date()),levels};
fs.writeFileSync('/workspace/sites/ghostmaze-discovery-path/dist/levels.json',JSON.stringify(payload,null,2)+'\n');
console.log(JSON.stringify({levels:levels.length,ids:levels.map(x=>x.id)}));
