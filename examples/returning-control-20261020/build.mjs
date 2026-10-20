import{WALL_TYPES as W,normalizeMapData,normalizeVoidWalls}from'../../src/reference/engine.js';
/** 两操作室与共同前厅；从基本墙阵独立重建，不读取研究结果。 */
export function buildMap(){
 const wall=type=>({type,keys:0}),door=(letter,open)=>({type:W.LETTER_DOOR,keys:0,letter,initialState:open?'open':'closed'}),left=()=>({type:W.ONE_WAY,keys:0,direction:{dx:-1,dy:0}});
 const rows=['######..','######..','######..','#####...','........','........','........','........'];
 const l={activeCells:rows.map(r=>[...r].map(c=>c==='#')),hWalls:Array.from({length:9},()=>Array.from({length:8},()=>wall(W.SOLID))),vWalls:Array.from({length:8},()=>Array.from({length:9},()=>wall(W.SOLID))),ghosts:[{x:0,y:0,id:0},{x:5,y:0,id:1}],items:[],buttons:[{x:0,y:0,letter:'A',direction:{dx:0,dy:-1}},{x:5,y:0,letter:'B',direction:{dx:0,dy:-1}}],customStartPos:{x:1,y:2},endPos:{x:3,y:0}};
 for(let y=0;y<3;y++){for(const x of[1,2,5])l.vWalls[y][x]=wall(W.EMPTY);if(y<2)for(const x of[0,1,2,4,5])l.hWalls[y+1][x]=wall(W.EMPTY);}
 for(const x of[1,2,3,4])l.vWalls[3][x]=wall(W.EMPTY);
 l.hWalls[1][0]=door('A',true);l.hWalls[1][3]=door('A',true);l.vWalls[0][5]=wall(W.DOOR);l.hWalls[2][3]=door('B',false);
 l.hWalls[3][1]=wall(W.EMPTY);l.hWalls[3][4]=door('A',false);l.vWalls[2][3]=door('A',true);
 l.vWalls[1][3]=left();l.vWalls[2][4]=left();l.hWalls[3][0]=wall(W.DOOR);
 return normalizeVoidWalls(normalizeMapData({width:8,height:8,editorMode:'free',gameMode:'death-loop',initialHealth:5,multiLayerMode:false,layerCount:1,layers:[l],stairs:[]}));
}
