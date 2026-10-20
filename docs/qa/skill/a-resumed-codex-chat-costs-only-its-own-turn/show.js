const fs=require('fs');const d=process.argv[2];
const c=JSON.parse(fs.readFileSync(d+'/chats/card-2.json','utf8'));
console.log('chats/card-2.json — agent replies:');
for(const m of c.messages.filter(m=>m.role==='agent'))console.log(`  ${m.text}  usage=${JSON.stringify(m.usage)}  costUsd=${m.costUsd}`);
const u=JSON.parse(fs.readFileSync(d+'/usage.json','utf8'));
console.log('usage.json — ledger:');
let sum=0;for(const e of u.entries){sum+=e.costUsd;console.log(`  ${e.kind}  usage=${JSON.stringify(e.usage)}  costUsd=${e.costUsd}`)}
console.log(`  sum costUsd=${Math.round(sum*1e6)/1e6}`);
