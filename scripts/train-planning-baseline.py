"""CPU求解动作基线。整组交叉诊断，不把局面数量当独立设计家族。"""
import argparse
import hashlib
import heapq
import json
import platform
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import sklearn
from sklearn.ensemble import ExtraTreesClassifier


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def exported_model(model, dimension):
    positive = list(model.classes_).index(True)
    trees = []
    for estimator in model.estimators_:
        tree = estimator.tree_
        values = tree.value[:, 0, :]
        probability = values[:, positive] / values.sum(axis=1)
        trees.append(dict(left=tree.children_left.tolist(), right=tree.children_right.tolist(),
                          feature=tree.feature.tolist(), threshold=tree.threshold.tolist(), probability=probability.tolist()))
    return dict(schemaVersion=1, modelType="extra_trees_binary", dimension=dimension, trees=trees,
                inputRole="physical_candidate_features", target="safe_optimal_action")


def predict_export(model, values):
    result = []
    for row in values:
        score = 0
        for tree in model["trees"]:
            node = 0
            while tree["left"][node] != -1:
                node = tree["left"][node] if row[tree["feature"][node]] <= tree["threshold"][node] else tree["right"][node]
            score += tree["probability"][node]
        result.append(score / len(model["trees"]))
    return np.array(result)


def rollout(nodes, scores, limit=512):
    current, visits, actions = 0, Counter({0: 1}), []
    for _ in range(limit):
        if nodes[current]["won"]:
            return dict(won=True, steps=len(actions), optimal=len(actions) == nodes[0]["distance"], actions=actions)
        candidates = [e for e in nodes[current]["edges"] if not nodes[e["to"]]["overlap"] and e["to"] != current]
        if not candidates:
            break
        # 共同的重访回避不读取精确距离；手工基线只按放宽门后的目标距离排序。
        edge = min(candidates, key=lambda e: (visits[e["to"]], -float(scores[e["row"]]) if scores is not None else nodes[e["to"]]["h"]))
        actions.append(edge["action"])
        current = edge["to"]
        visits[current] += 1
    return dict(won=nodes[current]["won"], steps=len(actions), optimal=False, actions=actions)


def astar(nodes, scores, budget=100000):
    best, queue, expanded, sequence = {0: 0}, [(nodes[0]["h"], 0, nodes[0]["h"], 0, 0, 0)], 0, 0
    while queue:
        _, _, _, _, cost, current = heapq.heappop(queue)
        if best[current] != cost:
            continue
        if nodes[current]["won"]:
            return dict(status="solved", steps=cost, expanded=expanded, optimal=cost == nodes[0]["distance"])
        if expanded >= budget:
            return dict(status="unknown", expanded=expanded)
        expanded += 1
        for edge in nodes[current]["edges"]:
            target, next_cost = edge["to"], cost + 1
            if best.get(target, float("inf")) <= next_cost:
                continue
            best[target] = next_cost
            sequence += 1
            h = nodes[target]["h"]
            # 模型只影响同一f值中的顺序，不改启发下界，不剪掉物理解。
            score = -float(scores[edge["row"]]) if scores is not None else 0
            heapq.heappush(queue, (next_cost + h, score, h, sequence, next_cost, target))
    return dict(status="unsolvable", expanded=expanded)


def evaluate(record, graph, metadata, scores):
    nodes = graph["nodes"]
    groups = defaultdict(list)
    for row in metadata:
        if row["mapId"] == record["mapId"] and row["trainEligible"]:
            groups[row["state"]].append(row)
    correct, branching_correct, branching = 0, 0, 0
    for state, candidates in groups.items():
        chosen = min(candidates, key=lambda r: -float(scores[r["row"]]) if scores is not None else nodes[r["to"]]["h"])
        correct += chosen["preferred"]
        if len({r["to"] for r in candidates if r["to"] != state}) > 1:
            branching += 1
            branching_correct += chosen["preferred"]
    return dict(mapId=record["mapId"], title=record["title"], splitGroup=record["splitGroup"],
                actionAccuracy=correct / len(groups), eligibleStates=len(groups),
                branchingAccuracy=branching_correct / branching if branching else None, branchingStates=branching,
                rollout=rollout(nodes, scores), astar=astar(nodes, scores))


def aggregate(results):
    return dict(maps=len(results), macroActionAccuracy=float(np.mean([r["actionAccuracy"] for r in results])),
                rolloutWon=sum(r["rollout"]["won"] for r in results), rolloutOptimal=sum(r["rollout"]["optimal"] for r in results),
                astarOptimal=sum(r["astar"].get("optimal", False) for r in results),
                astarExpanded=sum(r["astar"]["expanded"] for r in results))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--seeds", default="17,29,53")
    args = parser.parse_args()
    if args.output.exists():
        raise ValueError("拒绝覆盖已有训练结果")
    manifest = json.loads((args.source / "manifest.json").read_text())
    assert manifest["role"] == "solver_supervision_not_human_quality"
    for filename, expected in manifest["files"].items():
        assert digest(args.source / filename) == expected, filename
    metadata = [json.loads(line) for line in (args.source / "rows.jsonl").read_text().splitlines()]
    assert [r["row"] for r in metadata] == list(range(manifest["rows"]))
    values = np.memmap(args.source / "features.f32", dtype="<f4", mode="r", shape=(manifest["rows"], manifest["dimension"]))
    assert np.isfinite(values).all()
    targets = np.array([r["preferred"] for r in metadata])
    eligible = np.array([r["trainEligible"] for r in metadata])
    reference = np.array([r["onReference"] for r in metadata])
    families = np.array([r["splitGroup"] for r in metadata])
    graphs = {r["mapId"]: json.loads((args.source / "graphs" / (r["mapId"] + ".json")).read_text()) for r in manifest["records"]}
    args.output.mkdir(parents=True)
    (args.output / "models").mkdir()
    seeds = [int(s) for s in args.seeds.split(",")]
    config = dict(n_estimators=64, max_depth=18, min_samples_leaf=8, max_features=0.6, n_jobs=4)
    preregistration = dict(createdAtUtc=datetime.now(timezone.utc).isoformat(), sourceManifestSha256=digest(args.source / "manifest.json"),
                          scriptSha256=digest(Path(__file__)), seeds=seeds, config=config, splits="leave_whole_family_out", variants=["reference_states", "reachable_states"],
                          rolloutLimit=512, astarBudget=100000, selection="all fixed configurations reported; no holdout tuning",
                          limitation="two related design families; cross-validation is development diagnostic, not independent generalization proof")
    save(args.output / "preregistration.json", preregistration)
    baseline = [evaluate(r, graphs[r["mapId"]], metadata, None) for r in manifest["records"]]
    save(args.output / "manual-baseline.json", dict(aggregate=aggregate(baseline), results=baseline))
    experiments = []
    for variant in preregistration["variants"]:
        for seed in seeds:
            results, folds = [], []
            for held_out in manifest["splitGroups"]:
                mask = eligible & (families != held_out)
                if variant == "reference_states":
                    mask &= reference
                train_rows = np.flatnonzero(mask)
                train_maps = {metadata[i]["mapId"] for i in train_rows}
                test_records = [r for r in manifest["records"] if r["splitGroup"] == held_out]
                assert not train_maps.intersection({r["mapId"] for r in test_records})
                candidates_per_state = Counter((metadata[i]["mapId"], metadata[i]["state"]) for i in train_rows)
                states_per_map = Counter(m for m, s in candidates_per_state)
                weights = np.array([1 / candidates_per_state[(metadata[i]["mapId"], metadata[i]["state"])] / states_per_map[metadata[i]["mapId"]] for i in train_rows])
                model = ExtraTreesClassifier(random_state=seed, **config)
                start = time.perf_counter()
                model.fit(values[train_rows], targets[train_rows], sample_weight=weights * len(weights) / weights.sum())
                train_seconds = time.perf_counter() - start
                start = time.perf_counter()
                probabilities = model.predict_proba(values)[:, list(model.classes_).index(True)]
                predict_seconds = time.perf_counter() - start
                serialized = exported_model(model, manifest["dimension"])
                check_rows = np.linspace(0, len(values) - 1, 100, dtype=int)
                error = float(np.max(np.abs(predict_export(serialized, values[check_rows]) - probabilities[check_rows])))
                assert error < 1e-10
                name = f"{variant}-{seed}-{held_out}.json"
                save(args.output / "models" / name, serialized)
                fold_results = [evaluate(r, graphs[r["mapId"]], metadata, probabilities) for r in test_records]
                results.extend(fold_results)
                fold = dict(heldOut=held_out, trainMaps=sorted(train_maps), testMaps=[r["mapId"] for r in test_records], trainRows=len(train_rows),
                            trainSeconds=train_seconds, predictAllRowsSeconds=predict_seconds, exportMaxError=error,
                            modelFile="models/" + name, modelSha256=digest(args.output / "models" / name), aggregate=aggregate(fold_results))
                folds.append(fold)
                print(json.dumps(dict(variant=variant, seed=seed, **fold), ensure_ascii=False), flush=True)
            experiment = dict(variant=variant, seed=seed, aggregate=aggregate(results), folds=folds, results=results)
            save(args.output / f"{variant}-{seed}.json", experiment)
            experiments.append(experiment)
    summary = dict(schemaVersion=1, createdAtUtc=datetime.now(timezone.utc).isoformat(), role="solver_training_development_diagnostic", trainStarted=True,
                   sources=dict(manifestSha256=digest(args.source / "manifest.json"), rows=manifest["rows"], maps=manifest["maps"], families=len(manifest["splitGroups"])),
                   environment=dict(python=platform.python_version(), numpy=np.__version__, sklearn=sklearn.__version__, device="cpu", paidCalls=0),
                   manualBaseline=aggregate(baseline), experiments=[dict(variant=e["variant"], seed=e["seed"], aggregate=e["aggregate"]) for e in experiments],
                   limits=["只有两个保守家族，不能声称已学会创造精妙谜题", "局面全信息，与迷雾知识策略不同", "离线图搜索节点减少不等于端到端速度提升", "此实验不产生人类质量标签或地图集变更"])
    save(args.output / "summary.json", summary)
    print(json.dumps(summary, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
