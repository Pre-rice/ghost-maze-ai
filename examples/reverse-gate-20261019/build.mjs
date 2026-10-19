import { WALL_TYPES as W, normalizeMapData, normalizeVoidWalls } from '../../src/reference/engine.js';
export function buildMap() {
 const wall=(type,keys=0)=>({type,keys});
 const layer={
  activeCells:Array.from({length:8},(_,y)=>Array.from({length:8},(_,x)=>x>=1&&x<=5&&y>=1&&y<=5)),
  hWalls:Array.from({length:9},()=>Array.from({length:8},()=>wall(W.SOLID))),
  vWalls:Array.from({length:8},()=>Array.from({length:9},()=>wall(W.SOLID))),
  ghosts:[{x:5,y:1,id:0},{x:3,y:4,id:1}],items:[{x:4,y:1,type:'key'}],buttons:[],
  customStartPos:{x:1,y:5},endPos:{x:3,y:1}
 };
 for(let y=1;y<=5;y++)for(let x=1;x<=5;x++){
  if(x<5)layer.vWalls[y][x+1]=wall(W.EMPTY);
  if(y<5)layer.hWalls[y+1][x]=wall(W.EMPTY);
 }
 for(const[x,y]of[[3,1],[4,1],[5,3]])layer.vWalls[y][x]=wall(W.SOLID);
 layer.hWalls[2][3]=wall(W.LOCKED,1);
 layer.hWalls[5][5]=wall(W.LOCKED,0);
 return normalizeVoidWalls(normalizeMapData({width:8,height:8,editorMode:'free',gameMode:'death-loop',initialHealth:5,multiLayerMode:false,layerCount:1,layers:[layer],stairs:[]}));
}
