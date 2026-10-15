import { traceState } from '/trace-core.js';
import { ReplaySerializer } from '/game/src/core/replaySerializer.js';

let installation;
export function installRecorder(game = window.game) {
    if (!game?.controller) return null;
    if (installation) { installation.attach(game.controller); return installation; }
    // 只在研究服务后台留档；等待当前入口就绪，并跟随同页换图后的控制器。
    let controller, snapshot, signature, lastSaved, queued=false;
    const inReplay=()=>game.app?game.app.view==='replay':!!game.replay;
    const take=()=>{
        if(inReplay()||!controller?.mapData)return null;
        const actions=controller.actions,map=game.generateShareCode(),replay=ReplaySerializer.generateShareCode(controller.mapData,actions);
        if(!map.success||!replay.success)throw new Error(map.error||replay.error);
        const next=map.code+':'+replay.code;
        if(signature!==next){signature=next;snapshot={schemaVersion:1,id:crypto.randomUUID(),coverage:'retained_branch',capturedAt:new Date().toISOString(),sharecode:map.code,actions,ambiguities:[],final:traceState(controller.history.stateAt(controller.currentStep))};}
        return snapshot;
    };
    const save=async()=>{const input=take();if(!input)return;const response=await fetch('/api/recordings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});const result=await response.json();if(!response.ok)throw new Error(result.error||'保存失败');lastSaved=input.id;return result;};
    const capture=()=>{queued=false;if(inReplay()||!controller?.currentGameState)return;if(!controller.currentGameState.isWon){signature=null;return;}try{const input=take();if(input&&lastSaved!==input.id)save().catch(error=>installation.error=error.message);}catch(error){installation.error=error.message;}};
    const attach=next=>{if(controller!==next){controller=next;signature=null;snapshot=null;}const previous=controller.ui.onSync;if(previous?.recorderHook)return;const wrapped=(...args)=>{previous?.(...args);if(!queued){queued=true;queueMicrotask(capture);}};wrapped.recorderHook=true;controller.ui.onSync=wrapped;capture();};
    installation={save,capture,attach,error:null};attach(game.controller);return installation;
}
if(window.game)installRecorder();
window.addEventListener('ghostmaze:runtime-ready',()=>installRecorder());
window.addEventListener('ghostmaze:map-installed',()=>installRecorder());
