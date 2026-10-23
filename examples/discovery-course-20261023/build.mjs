import {WALL_TYPES as W, normalizeMapData, normalizeVoidWalls} from '../../src/reference/engine.js';

// 设计定义保持人工可读；归一化、校验、行动和编码均使用本体。
export const wall=(type,extra={})=>({type,keys:0,...extra});
export function room(width,height,{start,end,ghosts=[],items=[],buttons=[],edges=[],cells=null}={}){
 const active=(x,y)=>x>=0&&y>=0&&x<width&&y<height&&(!cells||cells.some(p=>p[0]===x&&p[1]===y));
 const l={activeCells:Array.from({length:8},(_,y)=>Array.from({length:8},(_,x)=>active(x,y))),hWalls:Array.from({length:9},()=>Array.from({length:8},()=>wall(W.SOLID))),vWalls:Array.from({length:8},()=>Array.from({length:9},()=>wall(W.SOLID))),ghosts:ghosts.map(([x,y],id)=>({x,y,id})),items:items.map(([x,y])=>({x,y,type:'key'})),buttons:buttons.map(([x,y,dx,dy,letter])=>({x,y,direction:{dx,dy},letter})),customStartPos:{x:start[0],y:start[1]},endPos:{x:end[0],y:end[1]}};
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(active(x,y)){
  if(active(x+1,y))l.vWalls[y][x+1]=wall(W.EMPTY);
  if(active(x,y+1))l.hWalls[y+1][x]=wall(W.EMPTY);
 }
 for(const [axis,x,y,type,extra={}]of edges)l[axis+'Walls'][y][x]=wall(type,extra);
 return normalizeVoidWalls(normalizeMapData({width:8,height:8,editorMode:'free',gameMode:'death-loop',initialHealth:5,multiLayerMode:false,layerCount:1,layers:[l],stairs:[]}));
}
export const definitions=[
 {id:'04',title:'04',width:5,height:3,params:{start:[2,2],end:[4,0],ghosts:[[0,1]],edges:[['v',3,0,W.SOLID],['v',3,1,W.DOOR],['v',3,2,W.SOLID]]},knowledgeBefore:['移动与终点','直线追击','遮挡'],newDiscovery:'普通门允许自己通过，鬼不能穿过，且会遮挡视线。',evidence:'先向上使左鬼追近；向右穿门后，鬼停在门的左侧。右房可安全移动观察。',transfer:'把能通过的门当作脱离追击的保护，而非只当墙的缺口。',risk:'不能借终点提前判胜掩盖鬼是否追到；终点放在门后再转一步的位置。',familyGroup:'discovery-ordinary-door-20261023-v1'},
 {id:'03',title:'03',width:4,height:4,params:{start:[0,3],end:[3,0],ghosts:[[3,0]],cells:[[0,0],[1,0],[2,0],[3,0],[0,1],[3,1],[0,2],[3,2],[0,3],[1,3],[2,3],[3,3]]},knowledgeBefore:['移动与终点','鬼会追击'],newDiscovery:'先让守在目标的鬼离开，再借转角与遮挡摆脱视线；鬼不会隔墙持续追踪。',evidence:'目标起初由鬼占据，两个方向接近都会引动它；退到转角后可观察它最后追一格再停下。',transfer:'需要主动引鬼、离开其视线，从另一侧回到终点。',risk:'不把转弯就立即停止教成规则；必须保留失去视线当步的最后一步追击。',familyGroup:'discovery-corner-and-sight-20261023-v1'},
 {id:'02',title:'02',width:4,height:3,params:{start:[0,2],end:[3,0],ghosts:[[3,1]],edges:[['h',3,1,W.SOLID]]},knowledgeBefore:['移动与终点'],newDiscovery:'鬼的行动由自己的有效行动推进；同列同行的接近会引来追击。',evidence:'下方可先横向试走，右下与鬼同列会立即遭遇；左侧与上侧形成避开直冲的另一条路。',transfer:'须绕到上方接近终点；用安全距离比较鬼动与不动的情形。',risk:'如果所有短解均不引鬼，本关只能算看见鬼，不能算追击教学。',familyGroup:'discovery-first-ghost-20261023-v1'},
 {id:'01',title:'01',width:3,height:2,params:{start:[0,1],end:[2,1],edges:[['v',1,1,W.SOLID]]},knowledgeBefore:[],newDiscovery:'蓝点由自己控制；墙挡路，绕开墙到绿点即可通关。',evidence:'终点可见，直接向右被墙挡住；向上后能沿上排绕回。',transfer:'先建立基本操作与目标，不把第一关当作理解鬼的测验。',risk:'只证明基本操作可完成，尚不证明会预测其他角色。',familyGroup:'discovery-movement-20261023-v1'}
];
export function buildLevel(id){const d=definitions.find(x=>x.id===id);if(!d)throw Error('unknown level');return room(d.width,d.height,d.params);}
