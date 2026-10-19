import{WALL_TYPES as W,normalizeMapData,normalizeVoidWalls}from'../../src/reference/engine.js';
export function buildMap(){
 const w=type=>({type,keys:0}),l={activeCells:Array.from({length:8},(_,y)=>Array.from({length:8},(_,x)=>x>=1&&x<=5&&y>=1&&y<=5)),hWalls:Array.from({length:9},()=>Array.from({length:8},()=>w(W.SOLID))),vWalls:Array.from({length:8},()=>Array.from({length:9},()=>w(W.SOLID))),ghosts:[{x:5,y:2,id:0},{x:5,y:5,id:1}],items:[],buttons:[{x:3,y:4,direction:{dx:-1,dy:0},letter:'A'},{x:5,y:4,direction:{dx:0,dy:1},letter:'A'}],customStartPos:{x:3,y:4},endPos:{x:4,y:5}};
 const alpha=[];for(let y=1;y<=4;y++)for(let x=1;x<=5;x++)if(x!==3||y!==4)alpha.push([x,y]);
 for(const[x,y]of alpha){if(alpha.some(c=>c[0]===x+1&&c[1]===y))l.vWalls[y][x+1]=w(W.EMPTY);if(alpha.some(c=>c[0]===x&&c[1]===y+1))l.hWalls[y+1][x]=w(W.EMPTY);}
 for(let x=2;x<=5;x++)l.vWalls[5][x]=w(W.EMPTY);
 l.hWalls[4][3]={type:W.LETTER_DOOR,keys:0,letter:'A',initialState:'closed'};l.hWalls[5][3]={type:W.LETTER_DOOR,keys:0,letter:'A',initialState:'open'};l.vWalls[4][4]=w(W.DOOR);
 return normalizeVoidWalls(normalizeMapData({width:8,height:8,editorMode:'free',gameMode:'death-loop',initialHealth:5,multiLayerMode:false,layerCount:1,layers:[l],stairs:[]}));
}
