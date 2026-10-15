"""给定目标的有界后路检查；与学习、手工、随机排序作等预算比较，不调用未来标签。"""
import argparse
import importlib.util
import json
from collections import Counter, deque
from pathlib import Path

import numpy as np


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


def allowed(nodes, current, edge):
    after = nodes[edge['to']]
    return not after['overlap'] and after['group'] != nodes[current]['group'] and (not after['originalGameWon'] or after['goal'])


def probe(nodes, start, budget):
    """仅展开原生安全后继；没有精确距离、任务种类、身份或已穷尽图答案。"""
    if nodes[start]['goal']:
        return 'reachable', 0
    pending, seen, expanded = deque([start]), {nodes[start]['group']}, 0
    while pending:
        if expanded >= budget:
            return 'unknown', expanded
        current = pending.popleft()
        expanded += 1
        for edge in nodes[current]['edges']:
            if not allowed(nodes, current, edge):
                continue
            after = nodes[edge['to']]
            if after['goal']:
                return 'reachable', expanded
            if after['group'] not in seen:
                seen.add(after['group'])
                pending.append(edge['to'])
    return 'unsolvable', expanded


def rollout(task, graph, values, mode, scores, per_probe, total_budget=4096, step_budget=256):
    nodes = graph['nodes']
    current, visits, actions, cache = 0, Counter({nodes[0]['group']: 1}), [], {}
    expanded = rejected = cached = unknown = 0
    vacated = moved = False
    reason = 'step_budget_unknown'
    for _ in range(step_budget):
        if nodes[current]['goal']:
            reason = 'given_goal'
            break
        candidates = [e for e in nodes[current]['edges'] if allowed(nodes, current, e)]
        kept = []
        for edge in candidates:
            group = nodes[edge['to']]['group']
            if per_probe == 0:
                status = 'unknown'
            elif group in cache:
                status = cache[group]
                cached += 1
            else:
                status, count = probe(nodes, edge['to'], min(per_probe, total_budget - expanded))
                expanded += count
                cache[group] = status
            if status == 'unsolvable':
                rejected += 1
            else:
                kept.append(edge)
                unknown += status == 'unknown'
        if not kept:
            reason = 'all_successors_proven_unreachable' if candidates else 'no_immediate_task_safe_action'
            break
        terminal = next((e for e in kept if nodes[e['to']]['goal']), None)
        def rank(edge):
            if mode in ['learned', 'random']:
                priority = (-float(scores[edge['row']]),)
            else:
                priority = (-float(values[edge['row'], -2]), nodes[edge['to']]['h'])
            return (visits[nodes[edge['to']]['group']], *priority)
        edge = terminal if terminal is not None else min(kept, key=rank)
        actions.append(edge['action'])
        current = edge['to']
        visits[nodes[current]['group']] += 1
        vacated |= not nodes[current]['anchorOccupied']
        moved |= not nodes[current]['originalAtAnchor']
    reached = nodes[current]['goal']
    return dict(goalReached=reached, optimalToGoal=reached and len(actions) == task['shortest'], steps=len(actions),
                actions=actions, vacatedAnchor=vacated, movedOriginal=moved, stopReason='given_goal' if reached else reason,
                expanded=expanded, rejectedProvenDeadendActions=rejected, probeCacheHits=cached,
                unknownActionsRetained=unknown, searchBudgetReached=per_probe > 0 and expanded == total_budget)


def predict(model, values):
    result = np.zeros(len(values))
    rows = np.arange(len(values))
    for tree in model['trees']:
        left, right = np.asarray(tree['left']), np.asarray(tree['right'])
        feature, threshold = np.asarray(tree['feature']), np.asarray(tree['threshold'])
        indexes = np.zeros(len(values), dtype=int)
        active = left[indexes] != -1
        while active.any():
            ids, state = rows[active], indexes[active]
            indexes[active] = np.where(values[ids, feature[state]] <= threshold[state], left[state], right[state])
            active = left[indexes] != -1
        result += np.asarray(tree['probability'])[indexes]
    return result / len(model['trees'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['test', 'gallery', 'baseline', 'output']:
        parser.add_argument(name, type=Path)
    args = parser.parse_args()
    assert not args.output.exists(), '不覆盖已有试验'
    helper = module('baseline', 'train-planning-baseline.py')
    old = module('parked', 'train-parked-policy.py')
    args.output.mkdir(parents=True)
    protocol = dict(role='bounded_deadend_preflight_not_model_or_quality_claim', sourceSha256=helper.digest(Path(__file__)),
                    baseline=str(args.baseline), baselineProtocolSha256=helper.digest(args.baseline / 'protocol.json'),
                    perCandidateExpansionBudgets=[0, 8, 64], totalExpansionsPerTask=4096, stepBudget=256,
                    seeds=[17, 29, 53], noNewTraining=True, noNewMaps=True, websiteIntegrated=False,
                    inferenceExcludes=['distance', 'anchorOccupied', 'originalAtAnchor', 'kind', 'witness'],
                    noOraclePruning=True, unknownSuccessorsRetained=True,
                    graphUse='Native-preverified graph as a transition cache, queried only at expanded states. Offline expansion counts, no native wall-time claim.',
                    scope='given goals on reused development challenges, not autonomous goal choice or full puzzle generation',
                    cache='per-task canonical visible state; cache bounded unknown as unknown, never as unsolvable')
    helper.save(args.output / 'protocol.json', protocol)
    summary, routes = [], []
    baseline_matched = 0
    for scope, directory in [('same_generator', args.test), ('gallery_given_goals', args.gallery)]:
        manifest = json.loads((directory / 'manifest.json').read_text())
        for name, expected in manifest['files'].items():
            assert helper.digest(directory / name) == expected
        assert json.loads((directory / 'native-qa.json').read_text())['allPassed']
        values = np.memmap(directory / 'features.f32', dtype='<f4', mode='r', shape=(manifest['rows'], manifest['dimension']))
        graphs = {t['taskId']: json.loads((directory / 'graphs' / (t['taskId'] + '.json')).read_text()) for t in manifest['tasks']}
        methods = [('progress', 0, None)]
        for seed in protocol['seeds']:
            model = json.loads((args.baseline / 'models' / f'parked-{seed}.json').read_text())
            assert model['dimension'] == manifest['dimension']
            scores = predict(model, values)
            subset = np.linspace(0, len(scores) - 1, 32, dtype=int)
            assert np.max(np.abs(helper.predict_export(model, values[subset]) - scores[subset])) < 1e-10
            methods.extend([('learned', seed, scores), ('random', seed, np.random.default_rng(seed).random(len(scores)))])
        for mode, seed, scores in methods:
            reference = json.loads((args.baseline / f'{scope}-{mode}-{seed}.json').read_text())
            originals = {r['taskId']: r for r in reference['results']}
            for budget in protocol['perCandidateExpansionBudgets']:
                results = []
                for task in manifest['tasks']:
                    result = rollout(task, graphs[task['taskId']], values, mode, scores, budget)
                    if budget == 0:
                        assert result['actions'] == originals[task['taskId']]['rollout']['actions'], '无展开对照与旧结果不一致'
                        baseline_matched += 1
                    results.append(dict(taskId=task['taskId'], mapId=task['mapId'], kind=task['kind'], rollout=result, actionAccuracy=0))
                    routes.append(dict(dataset=str(directory), taskId=task['taskId'], mapId=task['mapId'],
                                       **{k: result[k] for k in ['actions', 'goalReached', 'optimalToGoal', 'vacatedAnchor', 'movedOriginal']}))
                aggregate = old.aggregate(results)
                aggregate.pop('macroMapActionAccuracy')
                for result in results:
                    result.pop('actionAccuracy')
                aggregate.update(expanded=sum(r['rollout']['expanded'] for r in results),
                                 rejectedProvenDeadendActions=sum(r['rollout']['rejectedProvenDeadendActions'] for r in results),
                                 searchBudgetReached=sum(r['rollout']['searchBudgetReached'] for r in results))
                record = dict(scope=scope, mode=mode, seed=seed, perProbe=budget, aggregate=aggregate)
                summary.append(record)
                helper.save(args.output / f'{scope}-{mode}-{seed}-{budget}.json', dict(**record, results=results))
                print(json.dumps(record, ensure_ascii=False), flush=True)
    helper.save(args.output / 'summary.json', dict(role=protocol['role'], baselineRoutesMatched=baseline_matched, experiments=summary))
    with (args.output / 'routes.jsonl').open('x') as handle:
        for route in routes:
            handle.write(json.dumps(route) + '\n')


if __name__ == '__main__':
    main()
