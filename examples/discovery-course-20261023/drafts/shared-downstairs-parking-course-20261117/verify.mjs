import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createReferenceEnvironment} from '../../../../src/reference/environment.js';
import {createBreadthFirstSearch} from '../../../../../ghost-maze/src/solver/breadthFirst.js';
const root=new URL('./',import.meta.url);
for(const name of ['prototype','upper-parking']){const s=JSON.parse(fs.readFileSync(new URL(name+'.json',root))),e=createReferenceEnvironment(s.map),q=createBreadthFirstSearch(e),r=q.run({nodeBudget:750000,stateBudget:750000,budgetMs:30000});assert.equal(e.mapId,s.mapId);assert.equal(r.status,'proven_unsat');assert.equal(r.discovered,s.result.discovered);console.log(JSON.stringify({name,status:r.status,states:r.discovered}));}
