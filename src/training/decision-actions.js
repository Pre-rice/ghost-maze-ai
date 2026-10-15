import {createEventSuccessors} from './event-actions.js';

/**
 * 事件后只有一种新的无伤物理后继时继续执行，直至真实分叉／目标／死路。
 * 不删除追逐中的移动或停顿：完整真实动作、精确成本与引擎轨迹均可重建。
 */
export function createDecisionSuccessors(options) {
    const events=createEventSuccessors(options),{stateKey,step,actions,isGoal,isAllowed}=options;
    const stats={calls:0,forcedSteps:0,forcedTransitions:0};
    const generate=root=>{
        stats.calls++;
        const results=new Map();
        for(const edge of events.generate(root)){
            const route=edge.actions.slice(),seen=new Set([stateKey(root)]);
            // 先恢复真实前缀，不能把往返到旧物理局面的循环当成新的选择。
            let state=root;for(const action of route){state=step(state,action);stats.forcedTransitions++;seen.add(stateKey(state));}
            while(!isGoal(state)){
                const choices=new Map();
                for(const action of actions){const next=step(state,action);stats.forcedTransitions++;if(next===state||!isAllowed(next))continue;const key=stateKey(next);if(!seen.has(key)&&!choices.has(key))choices.set(key,{action,state:next});}
                if(choices.size!==1)break;
                const next=[...choices.values()][0];state=next.state;route.push(next.action);seen.add(stateKey(state));stats.forcedSteps++;
            }
            const key=stateKey(state),prior=results.get(key);
            if(!prior||route.length<prior.cost)results.set(key,{action:route[0],actions:route,cost:route.length,state});
        }
        return [...results.values()];
    };
    return Object.freeze({generate,stats,eventStats:events.stats});
}
