import{readFileSync,writeFileSync,existsSync}from'node:fs';
import{createReferenceEnvironment}from'../src/reference/environment.js';
export function updateCatalogReviewOverlay(root,destination){
 const filename=existsSync(root+'data/manifests/optimal-boundaries-20261012.json')?'optimal-boundaries-20261012.json':'rule-boundaries-20261012.json';
 const review=JSON.parse(readFileSync(root+'data/manifests/'+filename));
 const currentPolicy=review.policy==='all_optimal_routes_avoid_overlap_v2';
 const seed=JSON.parse(readFileSync(root+'examples/puzzle-units/unit-01.json'));
 if(createReferenceEnvironment(seed).ruleset!==review.ruleset)throw Error('目录审查规则锁过期，须先更新审查，不能自动重跑历史地图');
 const retired=JSON.parse(readFileSync(root+'data/manifests/retired-puzzles-20261012.json'));
 const start='<!-- current-rule-audit:start -->',end='<!-- current-rule-audit:end -->';
 let previous=readFileSync(destination,'utf8');
 if(previous.includes(start)) previous=previous.slice(previous.indexOf(end)+end.length).trimStart();
 else{
  previous=previous.replace(/^# AI 地图总目录\s*/, '## 历史资料（规则调整前）\n\n');
  previous=previous.replace('正式站已同步当前规则和分享格式。','这是规则调整前的历史状态，不能作为现行验收。');
  previous=previous.replace('下列码全部为当前格式。','下列码为当时格式；历史路线不自动获得现行规则证书。');
 }
 for(const r of retired.records)if(r.mapCode){
  const escaped=r.mapCode.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  previous=previous.replace(new RegExp('\\[([^\\]]*)\\]\\(https?:[^)\\s]*[?&]map='+escaped+'(?:&replay=[^)\\s]*)?\\)','g'),'$1（已退役，不再提供试玩）');
 }
 let current=start+'\n# AI 地图总目录\n\n更新：2026-10-12。以下为新规则的有效审查；后面的旧资料保留真实评述，不能作为已通过当前规则的复用名单。\n\n鬼争位以是否仍能看到玩家新位置决定优先；地位相同者共同入格。用户最新明确：夹击死亡与非最优重合允许；全部并列最优解不得经过鬼重合。玻璃换成实墙仍须保持全部物理策略结果一致。\n\n';
 current+='| 已上架地图 | 原参考路线 | 当前最短 | 原动作与鬼位相同 | 设计边界 |\n| --- | --- | --- | --- | --- |\n';
 for(const r of review.gallery){const b=review.boundaries.find(x=>x.kind==='gallery'&&x.title===r.title).boundary;const title=r.mapCode?'[《'+r.title+'》](https://ghostmaze.novic.cc/?map='+r.mapCode+')':'《'+r.title+'》';current+='| '+title+' | '+r.originalActions.length+' | '+r.currentOptimum+' | '+(r.routePlayerGhostItemStatesIdentical||r.firstDifferentState===-1?'是':'否')+' | '+(b.status==='safe'?(currentPolicy?'全部最优解通过':'旧严格范围通过'):'待维护')+' |\n';}
 current+='\n'+(currentPolicy?'《借影》维护版仅补一扇 A 门，最短恢复 59 步；原动作序列与控距安置环节保留。其余八张原图与原参考码完全保持。维护版见 [说明](../../ghost-maze-ai/examples/borrowed-shelter-overlapfix-20261012/README.md)。':'《借影》原 59 步仍无伤，但旧版新规则 57 步解利用重合；原版尚未维护。')+'\n\n《易位》及两张功能性玻璃精简题已退役；后续复用只允许 [已审查清单](../../ghost-maze-ai/data/manifests/puzzle-library-policy.json) 中通过的地图。其余历史提案不参与呈现或复用，不批量消耗时间审查。\n\n详细结果见 [边界审查](rule-boundaries-20261012.md)。\n'+end+'\n\n';
 writeFileSync(destination,current+previous);
}
