"""只学习鬼造成的额外剩余成本，精确去鬼子问题作为共同基线。"""
import heapq
import importlib.util
import json
import sys
from collections import Counter
from pathlib import Path

import numpy as np
from sklearn.ensemble import ExtraTreesRegressor


def run_search(nodes, predicted=None, relaxed=True, weighted=False):
    def h(i, row=None):
        base = nodes[i]["noGhostBound"] if relaxed else nodes[i]["h"]
        return base + (max(0, float(predicted[row])) if predicted is not None and row is not None else 0)
    queue, best, expanded, order = [(h(0), 0, 0, 0, ())], {0: 0}, 0, 0
    while queue:
        _, _, cost, current, actions = heapq.heappop(queue)
        if best[current] != cost:
            continue
        if nodes[current]["won"]:
            return dict(status="solved", expanded=expanded, actions=list(actions), steps=cost,
                        matchesKnownOptimum=cost == nodes[0]["distance"], optimality="not_proven_by_this_search")
        if expanded >= 100000:
            return dict(status="unknown", expanded=expanded)
        expanded += 1
        for edge in nodes[current]["edges"]:
            target = edge["to"]
            if nodes[target]["overlap"] or best.get(target, np.inf) <= cost + 1 or (relaxed and nodes[target]["noGhostUnreachable"]):
                continue
            best[target] = cost + 1
            order += 1
            value = h(target, edge["row"])
            heapq.heappush(queue, (cost + 1 + 2 * value if weighted else value, order, cost + 1, target, actions + (edge["action"],)))
    return dict(status="proven_unsat_in_nonoverlap_scope", expanded=expanded)


def rollout(nodes, predicted=None, relaxed=True):
    current, visits, actions = 0, Counter({0: 1}), []
    for _ in range(512):
        if nodes[current]["won"]:
            return dict(won=True, steps=len(actions), actions=actions, matchesKnownOptimum=len(actions) == nodes[0]["distance"])
        candidates = [e for e in nodes[current]["edges"] if e["to"] != current and not nodes[e["to"]]["overlap"] and (not relaxed or not nodes[e["to"]]["noGhostUnreachable"])]
        if not candidates:
            break
        edge = min(candidates, key=lambda e: (visits[e["to"]], (nodes[e["to"]]["noGhostBound"] if relaxed else nodes[e["to"]]["h"]) + (max(0, float(predicted[e["row"]])) if predicted is not None else 0)))
        actions.append(edge["action"])
        current = edge["to"]
        visits[current] += 1
    return dict(won=False, steps=len(actions), actions=actions, matchesKnownOptimum=False)


def aggregate(results):
    return dict(maps=len(results), solved=sum(r["search"]["status"] == "solved" for r in results), expanded=sum(r["search"]["expanded"] for r in results),
                coincidesWithOptimum=sum(r["search"].get("matchesKnownOptimum", False) for r in results),
                rolloutWon=sum(r["rollout"]["won"] for r in results), rolloutOptimal=sum(r["rollout"]["matchesKnownOptimum"] for r in results),
                solvedWithin256=sum(r["search"]["status"] == "solved" and r["search"]["expanded"] <= 256 for r in results))


def predict_deterministic(model, values):
    result=np.zeros(len(values))
    for tree in model.estimators_:
        result+=tree.predict(values,check_input=False)
    return result/len(model.estimators_)


def main():
    train_dir, test_dir, gallery_dir, output = map(Path, sys.argv[1:])
    if output.exists():
        raise ValueError("拒绝覆盖旧实验")
    module_path = Path(__file__).with_name("train-planning-baseline.py")
    spec = importlib.util.spec_from_file_location("base", module_path)
    b = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(b)
    def load(directory):
        m = json.loads((directory / "manifest.json").read_text())
        assert m["featureExtension"]["role"] == "exact_no_ghost_bounds_v1"
        for name, expected in {**m["files"], **m["graphFiles"]}.items():
            assert b.digest(directory / name) == expected
        return dict(directory=directory, manifest=m, x=np.memmap(directory / "features.f32", dtype="<f4", mode="r", shape=(m["rows"], m["dimension"])),
                    y=np.memmap(directory / "targets.f32", dtype="<f4", mode="r", shape=(m["rows"],)),
                    rows=[json.loads(line) for line in (directory / "rows.jsonl").read_text().splitlines()],
                    graphs={r["mapId"]: json.loads((directory / "graphs" / (r["mapId"] + ".json")).read_text()) for r in m["records"]})
    train, test, gallery = map(load, [train_dir, test_dir, gallery_dir])
    train_ids = {r["mapId"] for r in train["manifest"]["records"]}
    for data in [test, gallery]:
        assert not train_ids.intersection({r["mapId"] for r in data["manifest"]["records"]})
        assert data["manifest"]["featureExtension"] == train["manifest"]["featureExtension"]
    config = dict(n_estimators=64, max_depth=22, min_samples_leaf=4, max_features=0.6, n_jobs=4)
    output.mkdir(parents=True)
    (output / "models").mkdir()
    b.save(output / "protocol.json", dict(role="ghost_only_residual_development_diagnostic", config=config, seeds=[17,29,53],
                                         sources={str(d["directory"]):b.digest(d["directory"] / "manifest.json") for d in [train,test,gallery]},
                                         scriptSha256=b.digest(Path(__file__)), helperSha256=b.digest(module_path),
                                         scope="curriculum-only and leave-whole-gallery-family-out; latter is repeated development diagnostic",
                                         prediction="serial tree average; stable tie order independent of worker completion",
                                         target="safe physical remaining minus exact no-ghost remaining, capped128", inputExcludes=["full_exact_remaining","future_actions","mapId","human_quality"],
                                         modelCredit="compare learned model to same exact no-ghost baseline, not to a weaker unassisted baseline"))
    routes=[]
    def evaluate(data, records, prediction=None, weighted=False, relaxed=True):
        results=[]
        for record in records:
            nodes=data["graphs"][record["mapId"]]["nodes"]
            search=run_search(nodes,prediction,relaxed,weighted)
            roll=rollout(nodes,prediction,relaxed)
            results.append(dict(title=record["title"],mapId=record["mapId"],search=search,rollout=roll))
            if search["status"]=="solved":
                routes.append(dict(graphDirectory=str(data["directory"]),mapId=record["mapId"],actions=search["actions"],steps=search["steps"]))
            if roll["won"]:
                routes.append(dict(graphDirectory=str(data["directory"]),mapId=record["mapId"],actions=roll["actions"],steps=roll["steps"]))
        return results
    summary=dict(role="ghost_only_residual_development_diagnostic",manual={},experiments=[])
    for name,data in [("same_generator",test),("gallery",gallery)]:
        for mode,relaxed in [("geometric",False),("no_ghost",True)]:
            results=evaluate(data,data["manifest"]["records"],relaxed=relaxed)
            b.save(output/f"{name}-manual-{mode}.json",dict(aggregate=aggregate(results),results=results))
            summary["manual"][name+"-"+mode]=aggregate(results)
    for seed in [17,29,53]:
        for scope in ["curriculum_only","family_holdout"]:
            groups=[None] if scope=="curriculum_only" else gallery["manifest"]["splitGroups"]
            all_results={"greedy":[],"weighted":[]}
            folds=[]
            for group in groups:
                data=train if scope=="curriculum_only" else gallery
                selected=np.array([r["row"] for r in data["rows"] if r["trainEligible"] and (group is None or r["splitGroup"]!=group)])
                counts=Counter((data["rows"][i]["mapId"],data["rows"][i]["state"]) for i in selected)
                states=Counter(mid for mid,_ in counts)
                weights=np.array([1/counts[(data["rows"][i]["mapId"],data["rows"][i]["state"])]/states[data["rows"][i]["mapId"]] for i in selected])
                model=ExtraTreesRegressor(random_state=seed,**config).fit(data["x"][selected],data["y"][selected],sample_weight=weights*len(weights)/weights.sum())
                name=f"{scope}-{seed}-{group or 'curriculum'}.json"
                trees=[]
                for estimator in model.estimators_:
                    t=estimator.tree_
                    trees.append(dict(left=t.children_left.tolist(),right=t.children_right.tolist(),feature=t.feature.tolist(),threshold=t.threshold.tolist(),value=t.value[:,0,0].tolist()))
                b.save(output/'models'/name,dict(schemaVersion=1,modelType="extra_trees_regression",dimension=data["manifest"]["dimension"],trees=trees))
                test_records=gallery["manifest"]["records"] if group is None else [r for r in gallery["manifest"]["records"] if r["splitGroup"]==group]
                assert not {data["rows"][i]["mapId"] for i in selected}.intersection({r["mapId"] for r in test_records})
                prediction=predict_deterministic(model,gallery["x"])
                for mode in all_results:
                    all_results[mode].extend(evaluate(gallery,test_records,prediction,mode=="weighted"))
                if group is None:
                    p=predict_deterministic(model,test["x"]);result=evaluate(test,test["manifest"]["records"],p)
                    b.save(output/f"curriculum_only-same_generator-{seed}.json",dict(aggregate=aggregate(result),results=result))
                    summary["experiments"].append(dict(scope="same_generator",seed=seed,mode="greedy",aggregate=aggregate(result)))
                folds.append(dict(heldOut=group,trainMaps=sorted({data["rows"][i]["mapId"] for i in selected}),testMaps=[r["mapId"] for r in test_records],modelFile="models/"+name,modelSha256=b.digest(output/'models'/name)))
            for mode,results in all_results.items():
                report=dict(scope=scope,seed=seed,mode=mode,aggregate=aggregate(results),folds=folds,results=results)
                b.save(output/f"{scope}-{mode}-{seed}.json",report)
                summary["experiments"].append({k:v for k,v in report.items() if k not in ["folds","results"]})
                print(json.dumps(summary["experiments"][-1],ensure_ascii=False),flush=True)
    b.save(output/'summary.json',summary)
    with (output/'routes.jsonl').open('x') as handle:
        for route in routes:
            handle.write(json.dumps(route)+'\n')
    print(json.dumps(summary,ensure_ascii=False),flush=True)


if __name__=="__main__":
    main()
