/**
 * 可续接的单位成本规划。只接收当前局面的真实后继，不拥有完整图或未来标签。
 * BFS按深度证明最短，dijkstra按实际动作段成本证明最短；greedy只找可行路线。
 * 预算耗尽保留队列，不把未知当无解。
 */
export function createIncrementalPlanner({initial, stateKey, successors, isGoal, rankCandidate=null, strategy='bfs'}) {
    if (![stateKey, successors, isGoal].every(fn=>typeof fn==='function') ||
        (rankCandidate!==null && typeof rankCandidate!=='function') || !['bfs','dijkstra','greedy'].includes(strategy)) {
        throw new TypeError('规划接口或策略无效');
    }
    const heap=[], best=new Map(), expandedKeys=new Set();
    let serial=0, expanded=0, generated=0, rankCalls=0, reopened=0, status='unknown', reason='not_started', terminal=null;
    const compare=(a,b)=>{
        if(strategy!=='greedy' && a.g!==b.g)return a.g-b.g;
        const n=Math.max(a.rank.length,b.rank.length);
        for(let i=0;i<n;i++){const diff=(a.rank[i]??0)-(b.rank[i]??0);if(diff)return diff;}
        return a.g-b.g || a.order-b.order;
    };
    const push=entry=>{let i=heap.length;heap.push(entry);while(i){const p=(i-1)>>1;if(compare(heap[p],entry)<=0)break;heap[i]=heap[p];i=p;}heap[i]=entry;};
    const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&compare(heap[c+1],heap[c])<0)c++;if(compare(last,heap[c])<=0)break;heap[i]=heap[c];i=c;}heap[i]=last;}return top;};
    const root={state:initial,key:stateKey(initial),g:0,parent:null,action:null,actions:[],rank:[],order:serial++};
    best.set(root.key,root);push(root);
    if(isGoal(initial)){terminal=root;status='solved';reason='initial_goal';}
    const actions=entry=>{const result=[];for(let at=entry;at.parent;at=at.parent)result.push(at.actions);return result.reverse().flat();};
    const result=()=>({status,reason,strategy,optimality:status==='solved'&&strategy!=='greedy'?'proven':null,
        solution:terminal?{actions:actions(terminal),state:terminal.state,totalActions:terminal.g}:null,
        search:{expanded,generated,discovered:best.size,rankCalls,reopened,frontier:heap.length}});
    return Object.freeze({
        result,
        advance({additionalExpansions=128,timeBudgetMs=10000}={}) {
            if(!Number.isSafeInteger(additionalExpansions)||additionalExpansions<0||!Number.isFinite(timeBudgetMs)||timeBudgetMs<0)throw new TypeError('规划预算无效');
            if(status!=='unknown')return result();
            const started=performance.now(),limit=expanded+additionalExpansions;
            for(;;){
                // 清除已被更短前缀替代的旧队列项，不丢掉尚未展开的当前最优项。
                while(heap.length&&(best.get(heap[0].key)!==heap[0]||heap[0].closed))pop();
                if(!heap.length){status='proven_unsat';reason='exhausted_safe_scope';return result();}
                // 不等长动作段不能在发现目标时就停止，必须等它成为最小成本前沿。
                if(strategy==='dijkstra'&&isGoal(heap[0].state)){terminal=pop();status='solved';reason='minimum_cost_goal';return result();}
                if(expanded>=limit){reason='node_budget';return result();}
                if(performance.now()-started>=timeBudgetMs){reason='time_budget';return result();}
                const current=pop();current.closed=true;expanded++;
                if(expandedKeys.has(current.key))reopened++;
                expandedKeys.add(current.key);
                const choices=successors(current.state);
                if(!Array.isArray(choices))throw new TypeError('后继必须为动作／局面数组');
                const local=new Map();
                for(const child of choices){
                    if(!child||typeof child.action!=='string')throw new TypeError('后继缺少真实动作');
                    const route=child.actions??[child.action],cost=child.cost??1;
                    if(!Array.isArray(route)||!route.length||!route.every(a=>typeof a==='string')||route[0]!==child.action||
                        !Number.isSafeInteger(cost)||cost!==route.length||(strategy==='bfs'&&cost!==1))throw new TypeError('动作段成本或序列无效；BFS只接受单步');
                    generated++;
                    const key=stateKey(child.state),g=current.g+cost,prior=best.get(key);
                    if((prior&&prior.g<=g)||(local.has(key)&&local.get(key).g<=g))continue;
                    local.set(key,{state:child.state,key,g,parent:current,action:child.action,actions:route.slice(),cost,rank:[],order:serial++});
                }
                const candidates=[...local.values()];
                // 目标由当步局面判断；预算的最后一次展开也能发现并返回目标。
                const goal=strategy==='dijkstra'?null:candidates.find(child=>isGoal(child.state));
                if(goal){terminal=goal;best.set(goal.key,goal);status='solved';reason='goal_discovered';return result();}
                // 只有整个前沿确实唯一时才可省排序；局部只有一条路仍可能与别处竞争。
                if(rankCandidate&&(candidates.length>1||heap.length>0))for(const child of candidates){
                    const rank=rankCandidate(current.state,child.action,child.state,{actions:child.actions,cost:child.cost});rankCalls++;
                    child.rank=Array.isArray(rank)?rank:[rank];
                    if(!child.rank.length||!child.rank.every(Number.isFinite))throw new TypeError('排序值必须为有限数或非空数列');
                }
                for(const child of candidates){best.set(child.key,child);push(child);}
            }
        }
    });
}
