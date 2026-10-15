"""固定既有资料和输入，比较给定停位目标的可恢复性／剩余成本监督。"""
import argparse
import importlib.util
import json
from collections import Counter
from pathlib import Path

import numpy as np
from sklearn.ensemble import ExtraTreesClassifier, ExtraTreesRegressor


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


def allowed(nodes, current, edge):
    after = nodes[edge['to']]
    return not after['overlap'] and after['group'] != nodes[current]['group'] and (not after['originalGameWon'] or after['goal'])


def choose(candidates, nodes, visits, mode, viable, cost):
    # 不读取distance、kind、anchor、身份或未来目标；与上一阶段共用重访回避和当步目标完成。
    terminal = next((e for e in candidates if nodes[e['to']]['goal']), None)
    if terminal is not None:
        return terminal
    def priority(edge):
        row = edge['row']
        if mode == 'recovery':
            rank = (-float(viable[row]), nodes[edge['to']]['h'])
        elif mode == 'value':
            rank = (float(cost[row]),)
        elif mode == 'combined':
            rank = (bool(viable[row] < 0.5), float(cost[row]))
        else:
            raise ValueError(mode)
        return (visits[nodes[edge['to']]['group']], *rank)
    return min(candidates, key=priority)


def rollout(task, graph, mode, viable, cost, step_budget=256):
    nodes = graph['nodes']
    current, actions, visits = 0, [], Counter({nodes[0]['group']: 1})
    vacated = moved = False
    for _ in range(step_budget):
        if nodes[current]['goal']:
            return dict(goalReached=True, optimalToGoal=len(actions) == task['shortest'], steps=len(actions),
                        actions=actions, vacatedAnchor=vacated, movedOriginal=moved, stopReason='given_goal')
        candidates = [e for e in nodes[current]['edges'] if allowed(nodes, current, e)]
        if not candidates:
            break
        edge = choose(candidates, nodes, visits, mode, viable, cost)
        actions.append(edge['action'])
        current = edge['to']
        visits[nodes[current]['group']] += 1
        vacated |= not nodes[current]['anchorOccupied']
        moved |= not nodes[current]['originalAtAnchor']
    reached = nodes[current]['goal']
    return dict(goalReached=reached, optimalToGoal=reached and len(actions) == task['shortest'], steps=len(actions), actions=actions,
                vacatedAnchor=vacated, movedOriginal=moved,
                stopReason='given_goal' if reached else 'step_budget_unknown' if len(actions) == step_budget else 'no_immediate_task_safe_action')


def evaluate(data, mode, viable, cost):
    records = []
    for task in data['manifest']['tasks']:
        graph = data['graphs'][task['taskId']]
        records.append(dict(taskId=task['taskId'], mapId=task['mapId'], kind=task['kind'],
                            shortest=task['shortest'], rollout=rollout(task, graph, mode, viable, cost), actionAccuracy=0))
    return records


def exported_regressor(model, dimension):
    return dict(schemaVersion=1, modelType='extra_trees_regression', dimension=dimension, target='safe_goal_distance_minus_assignment_lower_bound',
                trees=[dict(left=t.tree_.children_left.tolist(), right=t.tree_.children_right.tolist(),
                            feature=t.tree_.feature.tolist(), threshold=t.tree_.threshold.tolist(),
                            probability=t.tree_.value[:, 0, 0].tolist()) for t in model.estimators_])


def fixed_predict(model, serialized, values):
    # 导出树顺序固定，不受并行累加的浮点顺序影响。
    result = np.zeros(len(values))
    for estimator, tree in zip(model.estimators_, serialized['trees']):
        result += np.asarray(tree['probability'])[estimator.apply(values, check_input=False)]
    return result / len(model.estimators_)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['train', 'test', 'gallery', 'output']:
        parser.add_argument(name, type=Path)
    args = parser.parse_args()
    assert not args.output.exists(), '拒绝覆盖已有实验'
    helper = module('baseline', 'train-planning-baseline.py')
    old = module('parked', 'train-parked-policy.py')
    def load(directory):
        manifest = json.loads((directory / 'manifest.json').read_text())
        assert manifest['goalIsGivenInput'] and manifest['humanQualitySamplesAdded'] == 0
        for name, expected in manifest['files'].items():
            assert helper.digest(directory / name) == expected
        qa = json.loads((directory / 'native-qa.json').read_text())
        assert qa['allPassed'] and qa['tasks'] == manifest['taskCount']
        return dict(directory=directory, manifest=manifest,
                    x=np.memmap(directory / 'features.f32', dtype='<f4', mode='r', shape=(manifest['rows'], manifest['dimension'])),
                    rows=[json.loads(line) for line in (directory / 'rows.jsonl').read_text().splitlines()],
                    graphs={t['taskId']: json.loads((directory / 'graphs' / (t['taskId'] + '.json')).read_text()) for t in manifest['tasks']})
    train, test, gallery = map(load, [args.train, args.test, args.gallery])
    train_maps = {t['mapId'] for t in train['manifest']['tasks']}
    for data in [test, gallery]:
        assert not train_maps.intersection(t['mapId'] for t in data['manifest']['tasks'])
        assert data['manifest']['featureBase'] == train['manifest']['featureBase']
        assert data['manifest']['ruleset'] == train['manifest']['ruleset']
    rows = train['rows']
    indexes = np.array([r['row'] for r in rows if r['trainEligible'] and allowed(train['graphs'][r['taskId']]['nodes'], r['state'], r)])
    candidates = Counter((rows[i]['taskId'], rows[i]['state']) for i in indexes)
    states = Counter(task for task, state in candidates)
    tasks_per_kind = Counter((t['mapId'], t['kind']) for t in train['manifest']['tasks'])
    kinds_per_map = Counter(mid for mid, kind in tasks_per_kind)
    weights = np.array([1 / candidates[(rows[i]['taskId'], rows[i]['state'])] / states[rows[i]['taskId']]
                        / tasks_per_kind[(rows[i]['mapId'], rows[i]['kind'])] / kinds_per_map[rows[i]['mapId']] for i in indexes])
    after = [train['graphs'][rows[i]['taskId']]['nodes'][rows[i]['to']] for i in indexes]
    labels = np.array([n['distance'] is not None for n in after])
    residual = np.array([0 if n['distance'] is None else n['distance'] - n['h'] for n in after])
    assert residual[labels].min() >= 0 and set(labels) == {False, True}
    config = dict(n_estimators=64, max_depth=22, min_samples_leaf=4, max_features=0.6, n_jobs=4)
    args.output.mkdir(parents=True)
    (args.output / 'models').mkdir()
    protocol = dict(role='fixed_data_goal_recovery_objective_ablation_not_quality', seeds=[17, 29, 53], config=config,
                    classifierClassWeight='balanced', combinedViabilityThreshold=0.5, modes=['recovery', 'value', 'combined'],
                    sourceSha256=helper.digest(Path(__file__)), dependencies={n: helper.digest(Path(__file__).with_name(n)) for n in ['train-planning-baseline.py', 'train-parked-policy.py']},
                    sources={str(d['directory']): helper.digest(d['directory'] / 'manifest.json') for d in [train, test, gallery]},
                    split='whole parent maps held out, same one-generator curriculum; gallery is reused development challenge',
                    unchangedInputs=1650, trainingRows=len(indexes), trainReachable=int(labels.sum()), trainIrrecoverable=int((~labels).sum()),
                    inferenceExcludes=['exact_distance', 'kind', 'anchor', 'originalAtAnchor', 'witness', 'future_graph_queries'],
                    controller='same one-step safe actions, canonical-state visit avoidance, immediate requested goal completion, 256 steps',
                    noNewMaps=True, noNewHumanFeedback=True, websiteIntegrated=False)
    helper.save(args.output / 'protocol.json', protocol)
    summary, routes = [], []
    for seed in protocol['seeds']:
        recovery = ExtraTreesClassifier(random_state=seed, class_weight='balanced', **config)
        recovery.fit(train['x'][indexes], labels, sample_weight=weights * len(weights) / weights.sum())
        value = ExtraTreesRegressor(random_state=seed, **config)
        reg_weights = weights[labels]
        value.fit(train['x'][indexes[labels]], residual[labels], sample_weight=reg_weights * len(reg_weights) / reg_weights.sum())
        exported = helper.exported_model(recovery, train['manifest']['dimension'])
        exported['target'] = 'requested_goal_remains_reachable'
        reg_exported = exported_regressor(value, train['manifest']['dimension'])
        helper.save(args.output / 'models' / f'recovery-{seed}.json', exported)
        helper.save(args.output / 'models' / f'value-{seed}.json', reg_exported)
        for scope, data in [('same_generator', test), ('gallery_given_goals', gallery)]:
            viable = fixed_predict(recovery, exported, data['x'])
            predicted = fixed_predict(value, reg_exported, data['x'])
            subset = np.linspace(0, len(viable) - 1, 32, dtype=int)
            assert np.max(np.abs(helper.predict_export(exported, data['x'][subset]) - viable[subset])) < 1e-10
            assert np.max(np.abs(helper.predict_export(reg_exported, data['x'][subset]) - predicted[subset])) < 1e-10
            # h来自输入局面的两鬼位置和给定目标，不是精确未来距离。
            cost = np.array([1 + data['graphs'][r['taskId']]['nodes'][r['to']]['h'] for r in data['rows']]) + np.maximum(0, predicted)
            for mode in protocol['modes']:
                results = evaluate(data, mode, viable, cost)
                aggregate = old.aggregate(results)
                # 本轮没有重测动作准确率，不用占位的0冒充测量。
                aggregate.pop('macroMapActionAccuracy')
                for result in results:
                    result.pop('actionAccuracy')
                    routes.append(dict(dataset=str(data['directory']), taskId=result['taskId'], mapId=result['mapId'],
                                       **{k: result['rollout'][k] for k in ['actions', 'goalReached', 'optimalToGoal', 'vacatedAnchor', 'movedOriginal']}))
                helper.save(args.output / f'{scope}-{mode}-{seed}.json', dict(seed=seed, scope=scope, mode=mode, aggregate=aggregate, results=results))
                item = dict(seed=seed, scope=scope, mode=mode, aggregate=aggregate)
                summary.append(item)
                print(json.dumps(item, ensure_ascii=False), flush=True)
    helper.save(args.output / 'summary.json', dict(role=protocol['role'], experiments=summary))
    with (args.output / 'routes.jsonl').open('x') as handle:
        for route in routes:
            handle.write(json.dumps(route) + '\n')


if __name__ == '__main__':
    main()
