"""整家族留出，学习候选剩余成本；只验找解效率，不冒称最优证明。"""
import heapq
import importlib.util
import json
import sys
import time
from collections import Counter, deque
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from sklearn.ensemble import ExtraTreesRegressor


def safe_distances(nodes):
    reverse = [[] for _ in nodes]
    values = np.full(len(nodes), np.inf)
    queue = deque()
    for i, node in enumerate(nodes):
        if node["overlap"]:
            continue
        if node["won"]:
            values[i] = 0
            queue.append(i)
        for edge in node["edges"]:
            if not nodes[edge["to"]]["overlap"]:
                reverse[edge["to"]].append(i)
    while queue:
        i = queue.popleft()
        for parent in reverse[i]:
            if not np.isfinite(values[parent]):
                values[parent] = values[i] + 1
                queue.append(parent)
    return values


def first_solution(nodes, predictions=None, mode="manual", budget=100000):
    best, queue, order, expanded = {0: 0}, [(nodes[0]["h"], 0, 0, 0, ())], 0, 0
    while queue:
        _, _, cost, current, actions = heapq.heappop(queue)
        if best[current] != cost:
            continue
        if nodes[current]["won"]:
            return dict(status="solved", steps=cost, expanded=expanded, actions=list(actions),
                        matchesKnownOptimum=cost == nodes[0]["distance"], optimality="not_proven_by_this_search")
        if expanded >= budget:
            return dict(status="unknown", expanded=expanded)
        expanded += 1
        for edge in nodes[current]["edges"]:
            target = edge["to"]
            if nodes[target]["overlap"] or best.get(target, np.inf) <= cost + 1:
                continue
            best[target] = cost + 1
            order += 1
            value = nodes[target]["h"] + (max(0, float(predictions[edge["row"]])) if predictions is not None else 0)
            priority = cost + 1 + 2 * value if mode == "weighted" else value
            heapq.heappush(queue, (priority, order, cost + 1, target, actions + (edge["action"],)))
    return dict(status="proven_unsat_within_nonoverlap_graph", expanded=expanded)


def aggregate(results):
    return dict(maps=len(results), solved=sum(r["search"]["status"] == "solved" for r in results),
                coincidesWithOptimum=sum(r["search"].get("matchesKnownOptimum", False) for r in results),
                expanded=sum(r["search"]["expanded"] for r in results),
                solvedWithinBudget={str(b): sum(r["search"]["status"] == "solved" and r["search"]["expanded"] <= b for r in results) for b in [64, 256, 1024, 10000]})


def main():
    source, output = map(Path, sys.argv[1:])
    if output.exists():
        raise ValueError("拒绝覆盖结果")
    module_path = Path(__file__).with_name("train-planning-baseline.py")
    spec = importlib.util.spec_from_file_location("planning_baseline", module_path)
    baseline = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(baseline)
    manifest = json.loads((source / "manifest.json").read_text())
    for name, expected in {**manifest["files"], **manifest.get("graphFiles", {})}.items():
        assert baseline.digest(source / name) == expected
    rows = [json.loads(line) for line in (source / "rows.jsonl").read_text().splitlines()]
    x = np.memmap(source / "features.f32", dtype="<f4", mode="r", shape=(manifest["rows"], manifest["dimension"]))
    graphs = {r["mapId"]: json.loads((source / "graphs" / (r["mapId"] + ".json")).read_text()) for r in manifest["records"]}
    distances = {mid: safe_distances(g["nodes"]) for mid, g in graphs.items()}
    y = np.zeros(manifest["rows"])
    for row in rows:
        target = graphs[row["mapId"]]["nodes"][row["to"]]
        remaining = distances[row["mapId"]][row["to"]]
        # 不可续解与重合是有限惩罚，不是假装精确的无穷成本。
        y[row["row"]] = min(128, max(0, remaining - target["h"]))
    output.mkdir(parents=True)
    (output / "models").mkdir()
    config = dict(n_estimators=64, max_depth=22, min_samples_leaf=4, max_features=0.6, n_jobs=4)
    protocol = dict(role="first_solution_development_diagnostic", createdAtUtc=datetime.now(timezone.utc).isoformat(),
                    sourceManifestSha256=baseline.digest(source / "manifest.json"), scriptSha256=baseline.digest(Path(__file__)),
                    helperSha256=baseline.digest(module_path), seeds=[17, 29, 53], config=config, split="leave_whole_family_out", penaltyCap=128,
                    modes=["greedy_value", "weighted"], weightedFactor=2,
                    optimality="never claimed by learned first-solution search; known graph optimum is evaluation only",
                    adaptation="follow-up after classifier diagnostics, same two families, not a fresh independent test")
    baseline.save(output / "protocol.json", protocol)
    manual = []
    for record in manifest["records"]:
        result = first_solution(graphs[record["mapId"]]["nodes"])
        manual.append(dict(title=record["title"], mapId=record["mapId"], search=result))
    baseline.save(output / "manual.json", dict(aggregate=aggregate(manual), results=manual))
    reports = []
    for seed in protocol["seeds"]:
        experiments = {mode: [] for mode in protocol["modes"]}
        folds = []
        for family in manifest["splitGroups"]:
            train = np.array([r["row"] for r in rows if r["trainEligible"] and r["splitGroup"] != family])
            counts = Counter((rows[i]["mapId"], rows[i]["state"]) for i in train)
            states = Counter(mid for mid, _ in counts)
            weights = np.array([1 / counts[(rows[i]["mapId"], rows[i]["state"])] / states[rows[i]["mapId"]] for i in train])
            start = time.perf_counter()
            model = ExtraTreesRegressor(random_state=seed, **config).fit(x[train], y[train], sample_weight=weights * len(weights) / weights.sum())
            predictions = model.predict(x)
            test_records = [r for r in manifest["records"] if r["splitGroup"] == family]
            trees = []
            for estimator in model.estimators_:
                tree = estimator.tree_
                trees.append(dict(left=tree.children_left.tolist(), right=tree.children_right.tolist(), feature=tree.feature.tolist(),
                                  threshold=tree.threshold.tolist(), value=tree.value[:, 0, 0].tolist()))
            name = f"value-{seed}-{family}.json"
            baseline.save(output / "models" / name, dict(schemaVersion=1, modelType="extra_trees_regression", target="safe_remaining_residual_capped128", dimension=manifest["dimension"], trees=trees))
            folds.append(dict(heldOut=family, trainMaps=sorted({rows[i]["mapId"] for i in train}), testMaps=[r["mapId"] for r in test_records],
                              trainRows=len(train), trainSeconds=time.perf_counter() - start, modelFile="models/" + name, modelSha256=baseline.digest(output / "models" / name)))
            for record in test_records:
                for mode in protocol["modes"]:
                    search = first_solution(graphs[record["mapId"]]["nodes"], predictions, mode)
                    experiments[mode].append(dict(title=record["title"], mapId=record["mapId"], splitGroup=record["splitGroup"], search=search))
        for mode, results in experiments.items():
            report = dict(seed=seed, mode=mode, aggregate=aggregate(results), folds=folds, results=results)
            baseline.save(output / f"{mode}-{seed}.json", report)
            reports.append(dict(seed=seed, mode=mode, aggregate=report["aggregate"]))
            print(json.dumps(reports[-1], ensure_ascii=False), flush=True)
    summary = dict(role=protocol["role"], manual=aggregate(manual), experiments=reports, qualityLabelsAdded=0, galleryChanged=False)
    baseline.save(output / "summary.json", summary)
    print(json.dumps(summary, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
