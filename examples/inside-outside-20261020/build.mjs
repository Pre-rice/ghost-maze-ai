import{WALL_TYPES as W,normalizeMapData,normalizeVoidWalls}from'../../src/reference/engine.js';
/** 独立重建4×4正方形，外侧L通路、两取物／终点小室及四个字母门。 */
export function buildMap(){
 const w=(type,keys=0)=>({type,keys}),d=letter=>({type:W.LETTER_DOOR,keys:0,letter,initialState:'open'}),inner=(x,y)=>x>=2&&x<=4&&y>=2&&y<=4;
 const l={activeCells:Array.from({length:8},(_,y)=>Array.from({length:8},(_,x)=>x>=1&&x<=4&&y>=1&&y<=4)),hWalls:Array.from({length:9},()=>Array.from({length:8},()=>w(W.SOLID))),vWalls:Array.from({length:8},()=>Array.from({length:9},()=>w(W.SOLID))),ghosts:[{x:3,y:3,id:0}],items:[{x:4,y:3,type:'key'}],buttons:[{x:3,y:2,letter:'A',direction:{dx:1,dy:0}},{x:2,y:3,letter:'B',direction:{dx:0,dy:-1}}],customStartPos:{x:1,y:1},endPos:{x:2,y:4}};
 for(let y=1;y<=4;y++)for(let x=1;x<=4;x++){if(x<4&&inner(x,y)===inner(x+1,y))l.vWalls[y][x+1]=w(W.EMPTY);if(y<4&&inner(x,y)===inner(x,y+1))l.hWalls[y+1][x]=w(W.EMPTY);}
 l.hWalls[2][3]=d('A');l.vWalls[3][4]=d('A');l.vWalls[3][2]=d('B');l.hWalls[4][3]=d('B');
 l.vWalls[2][4]=w(W.SOLID);l.hWalls[3][2]=w(W.SOLID);l.hWalls[4][2]=w(W.SOLID);l.hWalls[4][4]=w(W.SOLID);l.vWalls[4][3]=w(W.LOCKED,1);
 return normalizeVoidWalls(normalizeMapData({width:8,height:8,editorMode:'free',gameMode:'death-loop',initialHealth:5,multiLayerMode:false,layerCount:1,layers:[l],stairs:[]}));
}
