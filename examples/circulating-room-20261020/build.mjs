import {WALL_TYPES as W,normalizeMapData,normalizeVoidWalls} from '../../src/reference/engine.js';
/** 直接构建25格正方形、12格内室及四个出入口，不读取研究稿。 */
export function buildMap(){
 const w=(type,keys=0)=>({type,keys}),inside=(x,y)=>x>=2&&x<=4&&y>=2&&y<=5;
 const l={activeCells:Array.from({length:8},(_,y)=>Array.from({length:8},(_,x)=>x>=1&&x<=5&&y>=2&&y<=6)),hWalls:Array.from({length:9},()=>Array.from({length:8},()=>w(W.SOLID))),vWalls:Array.from({length:8},()=>Array.from({length:9},()=>w(W.SOLID))),ghosts:[{x:2,y:3,id:0},{x:4,y:3,id:1},{x:2,y:4,id:2}],items:[{x:3,y:3,type:'key'}],buttons:[],customStartPos:{x:5,y:5},endPos:{x:1,y:2}};
 for(let y=2;y<=6;y++)for(let x=1;x<=5;x++){
  if(x<5&&inside(x,y)===inside(x+1,y))l.vWalls[y][x+1]=w(W.EMPTY);
  if(y<6&&inside(x,y)===inside(x,y+1))l.hWalls[y+1][x]=w(W.EMPTY);
 }
 for(const y of[2,4,5])l.vWalls[y][5]=w(W.EMPTY);
 l.vWalls[3][2]=w(W.EMPTY);l.hWalls[6][3]=w(W.EMPTY);l.hWalls[3][1]=w(W.LOCKED,1);
 return normalizeVoidWalls(normalizeMapData({width:8,height:8,editorMode:'free',gameMode:'death-loop',initialHealth:5,multiLayerMode:false,layerCount:1,layers:[l],stairs:[]}));
}
