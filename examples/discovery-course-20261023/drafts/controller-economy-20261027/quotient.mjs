import assert from'node:assert/strict';import{createReferenceEnvironment}from'../../../../src/reference/environment.js';import{WALL_TYPES as W}from'../../../../src/reference/engine.js';
// 只比较无鬼题的事件可达性；所有后继均由本体生成，不模拟通行规则。
export function buildEventGraph(map,{outerGate,outerButton,layout='51'}){
 assert(['50','51'].includes(layout),'只核对本轮两个指定骨架');
 assert.equal(map.layers.length,1);assert.equal(map.stairs.length,0);assert.equal(map.layers[0].ghosts.length,0);assert.equal(map.layers[0].buttons.length,3);
 const env=createReferenceEnvironment(map),delta={U:[0,-1],R:[1,0],D:[0,1],L:[-1,0]},layer=map.layers[0];
 const gates=layout==='51'?[['v',4,4],['v',2,2],['h',4,5],outerGate,['h',2,3],['h',1,2]]:[['v',3,3],['h',3,4],outerGate,['h',1,2]];
 const anchors=layout==='51'?[[4,3],[4,4],[4,5],[3,2],[3,3],[3,4],[3,5],[2,2],[2,3],[2,4],[2,5],[1,1],[1,2]]:[[3,2],[3,3],[3,4],[2,1],[2,2],[2,3],[1,1],[1,2],[1,3]];
 assert.deepEqual(layer.items.map(i=>[i.x,i.y,i.type]),layout==='51'?[[4,5,'key']]:[]);
 const actualButtons=layer.buttons.map(b=>[b.x,b.y,b.direction.dx,b.direction.dy,b.letter].join(',')).sort();
 const expectedButtons=layout==='51'?[[2,2,0,-1,'A'],[1,2,-1,0,'B']]:[[1,1,0,-1,'A'],[1,1,-1,0,'B']];
 expectedButtons.push([...outerButton,1,0,'B']);assert.deepEqual(actualButtons,expectedButtons.map(b=>b.join(',')).sort());
 const mutable=[];for(const a of['h','v'])layer[a+'Walls'].forEach((row,y)=>row.forEach((w,x)=>{if([W.LOCKED,W.LETTER_DOOR].includes(w.type))mutable.push([a,x,y].join(','));}));
 assert.deepEqual(mutable.sort(),gates.map(g=>g.join(',')).sort(),'全部可变墙必须按坐标完整纳入，不能仅比较数量');
 const world=s=>JSON.stringify({hp:s.player.hp,keys:s.player.keys,dead:s.isDead,won:s.isWon,items:s.layerStates[0].items.map(i=>[i.x,i.y,i.type]),gates:gates.map(([a,x,y])=>{const w=s.layerStates[0].wallStates[a][y][x];return[w.type,w.keys??0,w.currentState??null];})});
 const wallBetween=(b,n)=>{const dx=n.player.x-b.player.x,dy=n.player.y-b.player.y;if(!dx&&!dy)return null;assert.equal(Math.abs(dx)+Math.abs(dy),1);const axis=dx?'v':'h',x=Math.max(b.player.x,n.player.x),y=Math.max(b.player.y,n.player.y);return{axis,x,y,wall:b.layerStates[0].wallStates[axis][y][x]};};
 const quiet=(b,n)=>world(b)===world(n)&&wallBetween(b,n)?.wall.type!==W.ONE_WAY;
 const abstractCache=new Map();
 function abstract(state){const key=env.stateKey(state);if(abstractCache.has(key))return abstractCache.get(key);const seen=new Set([key]),queue=[state],positions=new Set([state.player.x+','+state.player.y]);for(let i=0;i<queue.length;i++){for(const a of env.actions){const n=env.step(queue[i],a);if(n===queue[i]||n.isDead||!quiet(queue[i],n))continue;const k=env.stateKey(n);if(!seen.has(k)){seen.add(k);queue.push(n);positions.add(n.player.x+','+n.player.y);}}}const labels=anchors.filter(p=>positions.has(p.join(','))).map(p=>p.join(','));assert(labels.length,'静走区域必须有保留的语义锚点');const result=JSON.stringify({world:JSON.parse(world(state)),anchors:labels});for(const k of seen)abstractCache.set(k,result);return result;}
 function event(b,a,n){const labels=[],d=delta[a],button=d&&map.layers[0].buttons.find(x=>x.x===b.player.x&&x.y===b.player.y&&x.direction.dx===d[0]&&x.direction.dy===d[1]);if(button&&b.player.x===n.player.x&&b.player.y===n.player.y){const role=button.x===outerButton[0]&&button.y===outerButton[1]?'outer_B':button.letter==='A'?'A':'inner_B';labels.push('button:'+role);}const edge=wallBetween(b,n);if(edge?.wall.type===W.ONE_WAY)labels.push(`arrow:${edge.axis}${edge.x},${edge.y}:${a}`);if(n.player.keys>b.player.keys)labels.push('pickup:4,5');if(edge?.wall.type===W.LOCKED)labels.push('open:goal_1');if(n.isWon)labels.push('win');assert(labels.length,'非静走后继必须有事件标签');return labels.join('|');}
 const initial=env.initialState(),queue=[initial],seen=new Set([env.stateKey(initial)]),nodes=new Set(),edges=new Set();let transitions=0;for(let i=0;i<queue.length;i++){assert(i<200000,'完整遍历超出显式预算');const b=queue[i],from=abstract(b);nodes.add(from);if(b.isWon||b.isDead)continue;for(const a of env.actions){const n=env.step(b,a);transitions++;if(n===b||n.isDead)continue;const to=abstract(n);nodes.add(to);if(quiet(b,n))assert.equal(from,to);else edges.add(JSON.stringify([from,event(b,a,n),to]));const k=env.stateKey(n);if(!seen.has(k)){seen.add(k);queue.push(n);}}}
 const sorted=[...nodes].sort(),index=new Map(sorted.map((x,i)=>[x,i])),pairs=[...edges].map(x=>{const[f,a,t]=JSON.parse(x);return[index.get(f),a,index.get(t)];}).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 return{mapId:env.mapId,physicalStates:queue.length,physicalTransitions:transitions,graph:{initial:index.get(abstract(initial)),nodes:sorted.map(x=>JSON.parse(x)),edges:pairs}};
}
