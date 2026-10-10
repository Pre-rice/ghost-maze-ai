import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {inflateRaw} from 'pako';
import {DataSerializer} from '../../src/reference/engine.js';
import {createReferenceEnvironment} from '../../src/reference/environment.js';
import {assertButtonAttachments} from '../../src/design/button-support.js';
import {verifyRecording} from '../../src/review/recordings.js';
import {traceState} from '../../src/review/trace-core.js';

const read=name=>JSON.parse(readFileSync(new URL(name,import.meta.url),'utf8').replace(/^\uFEFF/,''));
const save=(name,data)=>writeFileSync(new URL(name,import.meta.url),JSON.stringify(data,null,2)+'\n',{flag:'wx'});
const result=read('../../runs/shelter-exchange-20261010/browser/result.json');
const evidence=read('evidence.json'),expected=read('browser-trace.json');
assert.equal(result.physicalAndVisibilityMatched,true);assert.equal(result.checks,expected.trace.length);
assert.deepEqual(result.errors,[]);assert.deepEqual(result.warnings,[]);assert(result.status.includes('无伤通关已验证'));
assert.equal(result.list.length,1);
const saved=read('../../runs/shelter-exchange-20261010/qa-recordings/'+result.list[0].id+'.json');
const verified=verifyRecording(saved.input);assert(verified.cleanWin);assert.deepEqual(saved.input.actions,expected.actions);
assert.equal(verified.mapId,evidence.decodedMapId);
assert(result.share.success);
const code=result.share.code,decoded=DataSerializer.loadFromShareCode(code);assert(decoded.success);
const{mapData,gameMode,initialHealth,initialStamina}=decoded.data;assertButtonAttachments(mapData);
const env=createReferenceEnvironment({...mapData,gameMode,initialHealth,initialStamina});
assert.equal(env.mapId,evidence.decodedMapId);
let state=env.initialState();assert.deepEqual({physical:traceState(state),seenCells:state.seenCells},expected.trace[0]);
for(const[action,index]of expected.actions.map((action,index)=>[action,index])){
    state=env.step(state,action);assert(!state.isDead);
    assert.deepEqual({physical:traceState(state),seenCells:state.seenCells},expected.trace[index+1]);
}
assert(state.isWon);
const bitstream=share=>inflateRaw(Buffer.from(share,'base64url'));
assert.deepEqual(bitstream(code),bitstream(evidence.sharecode));
const share={schemaVersion:1,code,codeLength:code.length,referenceCode:evidence.sharecode,referenceLength:evidence.sharecode.length,
    uncompressedBytes:bitstream(code).length,identicalBitstream:true,source:'browser_pako_2.1.0',ruleset:env.ruleset};
// 只有在实际查看三张浏览器截图后，才可加此参数记录人工视觉检查。
assert(process.argv.includes('--viewed-screenshots'),'请先查看浏览器截图');
const qa={schemaVersion:1,origin:'http://127.0.0.1:4193',mapId:evidence.mapId,decodedMapId:env.mapId,
    status:result.status,successfulKeyActions:expected.actions.length,stateChecks:result.checks,physicalAndVisibilityMatched:true,
    pageErrors:result.errors,warnings:result.warnings,navigationToReadyCheckMs:result.readyMs,
    timingScope:'one_local_navigation_not_public_network_or_cold_cache_benchmark',
    recording:{id:saved.input.id,cleanWin:verified.cleanWin,totalActions:verified.totalActions,movementCost:verified.movementCost},
    recordingVerifiedSeparately:true,share,attachmentCheck:{unsupportedButtons:0,decodedMapChecked:true},
    visualReview:{fullMapViewed:true,notes:['A、B 依附各自上墙，C 依附左边界墙；没有悬空按钮。','虚空处没有补角块，地图与字母门可辨。']},
    screenshots:['initial.png','full-map.png','won.png'],qaRecordingsOnly:'runs/shelter-exchange-20261010/qa-recordings'};
save('share.json',share);save('browser-qa.json',qa);
console.log(JSON.stringify({codeLength:code.length,referenceLength:evidence.sharecode.length,mapId:env.mapId,
    actions:verified.totalActions,movement:verified.movementCost,checks:result.checks,readyMs:result.readyMs}));
