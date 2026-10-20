import {WALL_TYPES as W,normalizeMapData,normalizeVoidWalls}from'../../src/reference/engine.js';
/** 独立重建阶梯轮廓，不读取研究日志或原型。 */
export function buildMap(){
 const w=type=>({type,keys:0}),a=open=>({type:W.LETTER_DOOR,keys:0,letter:'A',initialState:open?'open':'closed'});
 const rows=['..####..','########','#####...','#####...','........','........','........','........'];
 const l={activeCells:rows.map(row=>[...row].map(c=>c==='#')),hWalls:Array.from({length:9},()=>Array.from({length:8},()=>w(W.SOLID))),vWalls:Array.from({length:8},()=>Array.from({length:9},()=>w(W.SOLID))),buttons:[{x:4,y:2,letter:'A',direction:{dx:-1,dy:0}}],ghosts:[{x:1,y:1,id:0},{x:2,y:2,id:1},{x:7,y:1,id:2}],items:[],customStartPos:{x:4,y:2},endPos:{x:6,y:1}};
 for(const x of[3,4,5])l.vWalls[0][x]=w(W.EMPTY);
 for(const x of[1,2,3,4,5,6,7])l.vWalls[1][x]=w(W.EMPTY);
 for(const x of[1,2,3])l.vWalls[2][x]=w(W.EMPTY);
 for(const x of[1,2,3,4])l.vWalls[3][x]=w(W.EMPTY);
 for(const x of[2,3])l.hWalls[1][x]=w(W.EMPTY);
 for(const x of[0,1,3])l.hWalls[2][x]=w(W.EMPTY);
 l.hWalls[3][4]=w(W.EMPTY);
 l.vWalls[0][3]=w(W.DOOR);l.hWalls[3][0]=w(W.DOOR);
 l.hWalls[1][5]=w(W.EMPTY);l.hWalls[2][4]=w(W.EMPTY);
 l.vWalls[1][4]=a(false);l.vWalls[1][6]=a(true);
 return normalizeVoidWalls(normalizeMapData({width:8,height:8,editorMode:'free',gameMode:'death-loop',initialHealth:5,multiLayerMode:false,layerCount:1,layers:[l],stairs:[]}));
}
