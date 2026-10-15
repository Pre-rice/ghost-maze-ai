import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyEdit} from '../../src/design/edits.js';
import {searchDesigns} from '../../src/design/search.js';
import {minimizeDesign} from '../../src/design/minimize.js';
import {createReferenceEnvironment} from '../../src/reference/environment.js';
import {validateMapData,WALL_TYPES as W} from '../../src/reference/engine.js';
import {solveFastMap} from '../../src/search/fast-solver.js';
import {smallMap,seedMap,stairMap} from './fixtures.mjs';

const canonical=map=>{const c=validateMapData(map);assert(c.valid,c.error);return c.mapData;};
const id=map=>createReferenceEnvironment(map).mapId;

test('现行地图可直接编辑；同一改动在历史与层格式中物理一致且原件不变',()=>{
    const legacy=seedMap('unit-01'),current=canonical(legacy),before=[structuredClone(legacy),structuredClone(current)];
    for(const edit of [{type:'key',x:1,y:2},{type:'goal',x:1,y:2},{type:'ghost',index:0,x:5,y:2},
        {type:'button',x:1,y:2,letter:'A',direction:{dx:0,dy:-1}},{type:'cell',x:2,y:3},{type:'cell',x:6,y:7},
        {type:'wall',axis:'v',x:2,y:2,wall:{type:W.EMPTY,keys:0}}]){
        assert.equal(id(applyEdit(legacy,edit)),id(applyEdit(current,edit)));
    }
    assert.deepEqual([legacy,current],before);
    const actual=JSON.parse(readFileSync(new URL('../../examples/shift-handoff-20261015/map.json',import.meta.url)));
    const altered=applyEdit(actual,{type:'wall',axis:'v',x:3,y:2,wall:{type:W.SOLID,keys:0}});
    assert.equal(solveFastMap(actual).solution.totalActions,38);assert.equal(solveFastMap(altered).solution.totalActions,40);
    assert.equal(altered.layers.length,1);assert(!Object.hasOwn(altered,'hWalls'));
    assert.equal(solveFastMap(applyEdit(actual,{type:'remove_entity',field:'ghosts',index:0})).solution.totalActions,4);
});

test('两种输入使用相同种子得到相同提案和物理修改链，未知仍不放行',()=>{
    const old=seedMap('unit-01'),current=canonical(old),options={familyId:'format-compatibility',seed:29,iterations:30,maxDepth:3,budget:{nodeBudget:0}};
    const a=searchDesigns(old,options),b=searchDesigns(current,options);
    assert.equal(b.generatorVersion,'free-edit-v3');assert.deepEqual(b.attempts,a.attempts);
    assert.deepEqual(b.nodes.map(n=>[n.mapId,n.parentMapId,n.depth]),a.nodes.map(n=>[n.mapId,n.parentMapId,n.depth]));
    assert.equal(b.archive.length,0);assert(b.nodes.every(n=>n.analysis.baseline.status==='unknown'&&n.analysis.humanPreference===null));
});

test('现行层格式直接精简无用支路，合法性与最短路线保持',()=>{
    const legacy=smallMap([[1,1],[2,1],[1,2]],[1,1],[2,1]),current=canonical(legacy),before=structuredClone(current);
    const evaluate=map=>{const baseline=solveFastMap(map);return{accepted:baseline.status==='solved'&&baseline.solution.totalActions===1,baseline,reason:baseline.status};};
    const a=minimizeDesign(legacy,evaluate),b=minimizeDesign(current,evaluate);
    assert.equal(id(a.map),id(b.map));assert.equal(b.complexity[0],2);assert(b.lineage.length>0);assert.deepEqual(current,before);
    assert(createReferenceEnvironment(b.map).replay(b.evaluation.baseline.solution.actions).state.isWon);
    assert.equal(b.localMinimality.globalMinimumProven,false);
});

test('相同的历史副本同步编辑，冲突副本先拒绝；多层不伪装成单层',()=>{
    const legacy=seedMap('unit-01'),current=canonical(legacy),duplicated={...structuredClone(legacy),layers:structuredClone(current.layers)};
    const edit={type:'key',x:1,y:2};assert.equal(id(applyEdit(duplicated,edit)),id(applyEdit(current,edit)));
    const conflicted=structuredClone(duplicated);conflicted.items.push({x:1,y:2,type:'key'});
    assert.throws(()=>applyEdit(conflicted,edit),/冲突/);
    assert.throws(()=>searchDesigns(stairMap(),{familyId:'invalid',iterations:0}),/单层/);
    assert.throws(()=>minimizeDesign(stairMap(),()=>{throw Error('不得进入评估');}),/单层/);
});
