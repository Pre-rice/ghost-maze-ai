"""给定双鬼停位目标的动作学习；不宣称完整游戏通关或谜题质量。"""
import argparse
import importlib.util
import json
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from sklearn.ensemble import ExtraTreesClassifier


def allowed(nodes, current, edge):
    target=nodes[edge['to']]
    return not target['overlap'] and target['group']!=nodes[current]['group'] and (not target['originalGameWon'] or target['goal'])


def priority(mode, edge, nodes, values, scores):
    if mode=='learned' or mode=='random':
        return (-float(scores[edge['row']]),)
    if mode=='progress':
        return (-float(values[edge['row'],-2]),nodes[edge['to']]['h'])
    return (nodes[edge['to']]['h'],)


def rollout(task,graph,values,mode,scores=None):
    nodes=graph['nodes'];current=0;visits=Counter({nodes[0]['group']:1});actions=[];vacated=False;moved=False
    for _ in range(256):
        if nodes[current]['goal']:
            optimal=len(actions)==task['shortest']
            if optimal:
                assert vacated if task['kind']=='must_vacate' else not moved
            return dict(goalReached=True,optimalToGoal=optimal,steps=len(actions),actions=actions,vacatedAnchor=vacated,movedOriginal=moved,stopReason='given_goal')
        candidates=[e for e in nodes[current]['edges'] if allowed(nodes,current,e)]
        if not candidates:
            return dict(goalReached=False,optimalToGoal=False,steps=len(actions),actions=actions,vacatedAnchor=vacated,movedOriginal=moved,stopReason='no_immediate_task_safe_action')
        terminal=next((e for e in candidates if nodes[e['to']]['goal']),None)
        edge=terminal if terminal is not None else min(candidates,key=lambda e:(visits[nodes[e['to']]['group']],*priority(mode,e,nodes,values,scores)))
        actions.append(edge['action']);current=edge['to'];visits[nodes[current]['group']]+=1
        vacated|=not nodes[current]['anchorOccupied'];moved|=not nodes[current]['originalAtAnchor']
    return dict(goalReached=False,optimalToGoal=False,steps=len(actions),actions=actions,vacatedAnchor=vacated,movedOriginal=moved,stopReason='step_budget_unknown')


def aggregate(results):
    by_map=defaultdict(list)
    for r in results:by_map[r['mapId']].append(r)
    summary=dict(tasks=len(results),maps=len(by_map),goalReached=sum(r['rollout']['goalReached'] for r in results),optimalToGoal=sum(r['rollout']['optimalToGoal'] for r in results),
                 macroMapSuccess=float(np.mean([np.mean([r['rollout']['goalReached'] for r in group]) for group in by_map.values()])),
                 macroMapActionAccuracy=float(np.mean([np.mean([r['actionAccuracy'] for r in group]) for group in by_map.values()])))
    summary['byKind']={}
    for kind in ['must_vacate','must_keep']:
        group=[r for r in results if r['kind']==kind]
        summary['byKind'][kind]=dict(tasks=len(group),maps=len({r['mapId'] for r in group}),goalReached=sum(r['rollout']['goalReached'] for r in group),optimalToGoal=sum(r['rollout']['optimalToGoal'] for r in group))
    return summary


def evaluate(data,mode,scores=None):
    results=[]
    for task in data['manifest']['tasks']:
        graph=data['graphs'][task['taskId']];nodes=graph['nodes'];states=defaultdict(list)
        for row in data['rows'][task['startRow']:task['startRow']+task['rows']]:
            if row['evaluationEligible'] and allowed(nodes,row['state'],row):states[row['state']].append(row)
        correct=branch_correct=branch_count=0
        for state,choices in states.items():
            terminal=next((e for e in choices if nodes[e['to']]['goal']),None)
            selected=terminal if terminal is not None else min(choices,key=lambda e:priority(mode,e,nodes,data['x'],scores))
            correct+=selected['preferred']
            if len({nodes[e['to']]['group'] for e in choices})>1:
                branch_count+=1;branch_correct+=selected['preferred']
        result=dict(taskId=task['taskId'],mapId=task['mapId'],kind=task['kind'],shortest=task['shortest'],goal=task['goal'],
                    actionAccuracy=correct/len(states),branchingAccuracy=branch_correct/branch_count if branch_count else None,
                    rollout=rollout(task,graph,data['x'],mode,scores))
        results.append(result)
    return results


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ['train','test','gallery','output']:parser.add_argument(name,type=Path)
    parser.add_argument('--trees',type=int,default=64);parser.add_argument('--depth',type=int,default=22)
    args=parser.parse_args()
    if args.output.exists():raise ValueError('拒绝覆盖已有模型与结果')
    helper=Path(__file__).with_name('train-planning-baseline.py');spec=importlib.util.spec_from_file_location('baseline',helper);b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
    def load(directory):
        manifest=json.loads((directory/'manifest.json').read_text());assert manifest['goalIsGivenInput'];assert manifest['humanQualitySamplesAdded']==0
        for name,expected in manifest['files'].items():assert b.digest(directory/name)==expected
        qa=json.loads((directory/'native-qa.json').read_text());assert qa['allPassed'] and qa['tasks']==manifest['taskCount']
        return dict(directory=directory,manifest=manifest,x=np.memmap(directory/'features.f32',dtype='<f4',mode='r',shape=(manifest['rows'],manifest['dimension'])),
                    rows=[json.loads(line) for line in (directory/'rows.jsonl').read_text().splitlines()],graphs={t['taskId']:json.loads((directory/'graphs'/(t['taskId']+'.json')).read_text()) for t in manifest['tasks']})
    train,test,gallery=map(load,[args.train,args.test,args.gallery]);train_maps={t['mapId'] for t in train['manifest']['tasks']}
    for data in [test,gallery]:
        assert not train_maps.intersection({t['mapId'] for t in data['manifest']['tasks']});assert data['manifest']['featureBase']==train['manifest']['featureBase'];assert data['manifest']['dimension']==train['manifest']['dimension']
    config=dict(n_estimators=args.trees,max_depth=args.depth,min_samples_leaf=4,max_features=0.6,n_jobs=4)
    args.output.mkdir(parents=True);(args.output/'models').mkdir()
    b.save(args.output/'protocol.json',dict(role='given_goal_parking_skill_development_not_full_puzzle_solver',config=config,seeds=[17,29,53],stepBudget=256,
        sources={str(d['directory']):dict(manifestSha256=b.digest(d['directory']/'manifest.json'),nativeQaSha256=b.digest(d['directory']/'native-qa.json')) for d in [train,test,gallery]},
        scriptSha256=b.digest(Path(__file__)),exportHelperSha256=b.digest(helper),goalIsGiven=True,goalPropertyAndIdentityNotInput=True,fullGameWinNotClaimed=True,
        immediateMask='native nonfatal, nonoverlap, no parent-game termination before requested task; all methods identical',
        sharedController='canonical visible-state visit avoidance and one-step known task-goal completion',
        split='whole parent maps held out; one mechanical generator family, gallery maps reused from earlier development',newHumanQualityLabels=0))
    rows=train['rows'];indexes=np.array([r['row'] for r in rows if r['trainEligible'] and allowed(train['graphs'][r['taskId']]['nodes'],r['state'],r)])
    labels=np.array([r['preferred'] for r in rows]);assert set(labels[indexes])=={False,True}
    candidates=Counter((rows[i]['taskId'],rows[i]['state']) for i in indexes);states=Counter(task for task,state in candidates)
    tasks_per_kind=Counter((t['mapId'],t['kind']) for t in train['manifest']['tasks']);kinds_per_map=Counter(mid for mid,kind in tasks_per_kind)
    weights=np.array([1/candidates[(rows[i]['taskId'],rows[i]['state'])]/states[rows[i]['taskId']]/tasks_per_kind[(rows[i]['mapId'],rows[i]['kind'])]/kinds_per_map[rows[i]['mapId']] for i in indexes])
    summary=dict(role='given_goal_parking_skill_development_not_full_puzzle_solver',trainingRows=len(indexes),positiveRows=int(labels[indexes].sum()),trainMaps=len(train_maps),trainTasks=train['manifest']['taskCount'],manual={},experiments=[])
    routes=[]
    def save_report(data,scope,mode,seed,scores=None):
        results=evaluate(data,mode,scores);report=dict(scope=scope,mode=mode,seed=seed,aggregate=aggregate(results),results=results)
        b.save(args.output/f'{scope}-{mode}-{seed}.json',report)
        for r in results:
            routes.append(dict(dataset=str(data['directory']),taskId=r['taskId'],mapId=r['mapId'],actions=r['rollout']['actions'],goalReached=r['rollout']['goalReached'],optimalToGoal=r['rollout']['optimalToGoal'],vacatedAnchor=r['rollout']['vacatedAnchor'],movedOriginal=r['rollout']['movedOriginal']))
        return report['aggregate']
    for scope,data in [('same_generator',test),('gallery_given_goals',gallery)]:
        for mode in ['assignment','progress']:summary['manual'][scope+'-'+mode]=save_report(data,scope,mode,0)
    for seed in [17,29,53]:
        model=ExtraTreesClassifier(random_state=seed,**config).fit(train['x'][indexes],labels[indexes],sample_weight=weights*len(weights)/weights.sum())
        serialized=b.exported_model(model,train['manifest']['dimension']);serialized['goalContext']='two_given_ghost_parking_targets'
        model_file=args.output/'models'/f'parked-{seed}.json';b.save(model_file,serialized)
        for scope,data in [('same_generator',test),('gallery_given_goals',gallery)]:
            # 用导出叶值、固定树序产生评估分数，避免训练库并行求和的并列误差。
            scores=np.zeros(data['manifest']['rows'])
            for estimator,tree in zip(model.estimators_,serialized['trees']):scores+=np.asarray(tree['probability'])[estimator.apply(data['x'],check_input=False)]
            scores/=len(model.estimators_)
            check=np.linspace(0,len(scores)-1,32,dtype=int);assert np.max(np.abs(b.predict_export(serialized,data['x'][check])-scores[check]))<1e-10
            result=save_report(data,scope,'learned',seed,scores)
            random=save_report(data,scope,'random',seed,np.random.default_rng(seed).random(len(scores)))
            record=dict(seed=seed,scope=scope,aggregate=result,randomBaseline=random,modelSha256=b.digest(model_file));summary['experiments'].append(record);print(json.dumps(record,ensure_ascii=False),flush=True)
    b.save(args.output/'summary.json',summary)
    with (args.output/'routes.jsonl').open('x') as handle:
        for route in routes:handle.write(json.dumps(route)+'\n')
    print(json.dumps(summary,ensure_ascii=False),flush=True)


if __name__=='__main__':main()
