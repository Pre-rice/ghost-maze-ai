"""复盘已有闭环失败；精确未来距离仅用于诊断，不生成策略或训练数据。"""
import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def diagnose(dataset, reports, scope):
    manifest = json.loads((dataset / 'manifest.json').read_text())
    for name, expected in manifest['files'].items():
        assert digest(dataset / name) == expected
    tasks = {t['taskId']: t for t in manifest['tasks']}
    graphs = {tid: json.loads((dataset / 'graphs' / (tid + '.json')).read_text())['nodes'] for tid in tasks}
    records = []
    for seed in [17, 29, 53]:
        report = json.loads((reports / f'{scope}-learned-{seed}.json').read_text())
        for result in report['results']:
            task = tasks[result['taskId']]
            nodes = graphs[task['taskId']]
            current = 0
            first_detour = first_deadend = None
            for step, action in enumerate(result['rollout']['actions'], 1):
                edge = next(e for e in nodes[current]['edges'] if e['action'] == action)
                target = nodes[edge['to']]
                if first_detour is None and (target['distance'] is None or nodes[current]['distance'] is None
                                             or target['distance'] != nodes[current]['distance'] - 1):
                    first_detour = step
                if first_deadend is None and target['distance'] is None:
                    first_deadend = step
                current = edge['to']
            records.append(dict(taskId=task['taskId'], mapId=task['mapId'], kind=task['kind'], seed=seed,
                                goalReached=result['rollout']['goalReached'], firstDetour=first_detour,
                                firstIrrecoverableStep=first_deadend, finalStillReachable=nodes[current]['distance'] is not None))
    summary = {}
    for kind in ['must_vacate', 'must_keep']:
        rows = [r for r in records if r['kind'] == kind]
        failed = [r for r in rows if not r['goalReached']]
        summary[kind] = dict(tasks=len({r['taskId'] for r in rows}), maps=len({r['mapId'] for r in rows}),
                             attempts=len(rows), succeeded=sum(r['goalReached'] for r in rows),
                             failed=len(failed), failuresEnteringIrrecoverableState=sum(r['firstIrrecoverableStep'] is not None for r in failed),
                             failuresStillReachable=sum(r['finalStillReachable'] for r in failed))
    return dict(manifestSha256=digest(dataset / 'manifest.json'), summary=summary, records=records)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['train', 'test', 'gallery', 'reports', 'output']:
        parser.add_argument(name, type=Path)
    args = parser.parse_args()
    assert not args.output.exists(), '不覆盖历史诊断'
    manifest = json.loads((args.train / 'manifest.json').read_text())
    graphs = {t['taskId']: json.loads((args.train / 'graphs' / (t['taskId'] + '.json')).read_text())['nodes'] for t in manifest['tasks']}
    counts = Counter()
    for line in (args.train / 'rows.jsonl').read_text().splitlines():
        row = json.loads(line)
        nodes = graphs[row['taskId']]
        before, after = nodes[row['state']], nodes[row['to']]
        if row['trainEligible'] and not after['overlap'] and after['group'] != before['group'] and (not after['originalGameWon'] or after['goal']):
            counts['eligible'] += 1
            counts['viable' if after['distance'] is not None else 'irrecoverable'] += 1
            counts['preferred' if row['preferred'] else 'not_preferred'] += 1
    result = dict(role='posthoc_failure_diagnosis_not_online_oracle', sourceSha256=digest(Path(__file__)),
                  trainingCounts=dict(counts), sameGenerator=diagnose(args.test, args.reports, 'same_generator'),
                  gallery=diagnose(args.gallery, args.reports, 'gallery_given_goals'),
                  decision='固定数据与输入，比较可恢复性及目标剩余成本监督；精确未来只作训练标签与复盘，不参与测试选择。')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: result[k] if k == 'trainingCounts' else result[k]['summary'] for k in ['trainingCounts', 'sameGenerator', 'gallery']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
