/**
 * 无伤、全信息、无历史监控范围内，将没有物理事件的行走合成一段。
 * 鬼位／机关／资源与楼层均未改变才能继续；每一内部动作仍调用权威引擎。
 */
export function sameDynamicSituation(a,b) {
    if(a.isDead!==b.isDead||a.isWon!==b.isWon||a.loopCount!==b.loopCount||
        a.player.layer!==b.player.layer||a.player.hp!==b.player.hp||a.player.keys!==b.player.keys||a.layerStates.length!==b.layerStates.length)return false;
    for(let layer=0;layer<a.layerStates.length;layer++){
        const x=a.layerStates[layer],y=b.layerStates[layer];
        // 引擎写墙采用不可变共享；引用改变时保守地保留事件，不会漏掉通路变化。
        if(x.wallStates!==y.wallStates||x.items.length!==y.items.length||x.ghosts.length!==y.ghosts.length)return false;
        for(let i=0;i<x.items.length;i++)if(x.items[i].x!==y.items[i].x||x.items[i].y!==y.items[i].y||x.items[i].type!==y.items[i].type)return false;
        const signature=ghosts=>ghosts.map(g=>`${g.x},${g.y}`).sort().join(';');
        if(signature(x.ghosts)!==signature(y.ghosts))return false;
    }
    return true;
}

/** 每条边附实际动作序列及其精确步数；相同终局只保留最短的静走前缀。 */
export function createEventSuccessors({stateKey,step,actions,isGoal,isAllowed}) {
    if(![stateKey,step,isGoal,isAllowed].every(fn=>typeof fn==='function')||!Array.isArray(actions))throw new TypeError('行动段接口无效');
    const stats={calls:0,quietExpanded:0,transitions:0};
    const generate=root=>{
        stats.calls++;
        const queue=[{state:root,parent:null,action:null}],seen=new Set([stateKey(root)]),boundaries=new Map();
        const path=(entry,last)=>{const result=[last];for(let at=entry;at.parent;at=at.parent)result.push(at.action);return result.reverse();};
        for(let head=0;head<queue.length;head++){
            const current=queue[head];stats.quietExpanded++;
            for(const action of actions){
                const next=step(current.state,action);stats.transitions++;
                if(next===current.state||!isAllowed(next))continue;
                const key=stateKey(next);
                if(isGoal(next)||!sameDynamicSituation(root,next)){
                    if(!boundaries.has(key)){const route=path(current,action);boundaries.set(key,{action:route[0],actions:route,cost:route.length,state:next});}
                }else if(!seen.has(key)){
                    seen.add(key);queue.push({state:next,parent:current,action});
                }
            }
        }
        return [...boundaries.values()];
    };
    return Object.freeze({generate,stats});
}
