"""只训练程序练习；同生成器留出与精品开发挑战分别报告。"""
import importlib.util
import argparse
import json
import sys
from collections import Counter
from pathlib import Path

import numpy as np
from sklearn.ensemble import ExtraTreesClassifier
from sklearn.tree import DecisionTreeClassifier
from types import SimpleNamespace


def load_module(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ['train','test','challenge','output']:
        parser.add_argument(name,type=Path)
    parser.add_argument('--trees',type=int,default=64)
    parser.add_argument('--depth',type=int,default=22)
    parser.add_argument('--kind',choices=['extra','cart'],default='extra')
    args=parser.parse_args()
    train_dir,test_dir,challenge_dir,output=args.train,args.test,args.challenge,args.output
    if output.exists():
        raise ValueError("拒绝覆盖结果")
    b = load_module("baseline", "train-planning-baseline.py")
    def load(directory):
        m = json.loads((directory / "manifest.json").read_text())
        for name, expected in {**m["files"], **m.get("graphFiles", {})}.items():
            assert b.digest(directory / name) == expected
        rows = [json.loads(line) for line in (directory / "rows.jsonl").read_text().splitlines()]
        x = np.memmap(directory / "features.f32", dtype="<f4", mode="r", shape=(m["rows"], m["dimension"]))
        graphs = {r["mapId"]: json.loads((directory / "graphs" / (r["mapId"] + ".json")).read_text()) for r in m["records"]}
        return dict(manifest=m, rows=rows, x=x, graphs=graphs, directory=directory)
    train, test, challenge = map(load, [train_dir, test_dir, challenge_dir])
    train_maps = {r["mapId"] for r in train["manifest"]["records"]}
    assert {r["sourceRole"] for r in train["manifest"]["records"]} == {"mechanical_curriculum_exercise"}
    for data in [test, challenge]:
        assert not train_maps.intersection({r["mapId"] for r in data["manifest"]["records"]})
        assert data["manifest"]["featureEncoder"] == train["manifest"]["featureEncoder"]
        assert data["manifest"]["ruleset"] == train["manifest"]["ruleset"]
    assert set(challenge["manifest"]["splitGroups"]).isdisjoint(train["manifest"]["splitGroups"])
    output.mkdir(parents=True)
    (output / "models").mkdir()
    config = dict(n_estimators=args.trees, max_depth=args.depth, min_samples_leaf=4, max_features=0.6, n_jobs=4) if args.kind=='extra' else dict(max_depth=args.depth,min_samples_leaf=4)
    protocol = dict(role="mechanical_curriculum_development_diagnostic", seeds=[17, 29, 53], config=config,modelKind=args.kind,
                    files={str(d["directory"]): b.digest(d["directory"] / "manifest.json") for d in [train, test, challenge]},
                    scriptSha256=b.digest(Path(__file__)), helperSha256=b.digest(Path(__file__).with_name("train-planning-baseline.py")),
                    trainMaps=len(train_maps), sameGeneratorTestMaps=test["manifest"]["maps"], challengeMaps=challenge["manifest"]["maps"],
                    separation="seed blocks and no identical mapId; one generator family, not independent puzzle-design families",
                    challengeStatus="all gallery maps excluded from this training; already used in earlier development, not a fresh final test",
                    humanQualityLabels=0, galleryChanged=False)
    b.save(output / "protocol.json", protocol)
    rows = train["rows"]
    indexes = np.array([r["row"] for r in rows if r["trainEligible"]])
    labels = np.array([r["preferred"] for r in rows])
    candidates = Counter((rows[i]["mapId"], rows[i]["state"]) for i in indexes)
    states = Counter(mid for mid, _ in candidates)
    weights = np.array([1 / candidates[(rows[i]["mapId"], rows[i]["state"])] / states[rows[i]["mapId"]] for i in indexes])
    summary = dict(role=protocol["role"], trainEligibleRows=len(indexes), trainMaps=len(train_maps), manual={}, experiments=[])
    for name, data in [("same_generator", test), ("gallery_challenge", challenge)]:
        results = [b.evaluate(r, data["graphs"][r["mapId"]], data["rows"], None) for r in data["manifest"]["records"]]
        b.save(output / (name + "-manual.json"), dict(aggregate=b.aggregate(results), results=results))
        summary["manual"][name] = b.aggregate(results)
    for seed in protocol["seeds"]:
        model = (ExtraTreesClassifier(random_state=seed, **config) if args.kind=='extra' else DecisionTreeClassifier(random_state=seed,**config)).fit(train["x"][indexes], labels[indexes], sample_weight=weights * len(weights) / weights.sum())
        filename = f"curriculum-{seed}.json"
        b.save(output / "models" / filename, b.exported_model(model if args.kind=='extra' else SimpleNamespace(estimators_=[model],classes_=model.classes_), train["manifest"]["dimension"]))
        for name, data in [("same_generator", test), ("gallery_challenge", challenge)]:
            probability = model.predict_proba(data["x"])[:, list(model.classes_).index(True)]
            results = [b.evaluate(r, data["graphs"][r["mapId"]], data["rows"], probability) for r in data["manifest"]["records"]]
            report = dict(seed=seed, scope=name, modelFile="models/" + filename, modelSha256=b.digest(output / "models" / filename), aggregate=b.aggregate(results), results=results)
            b.save(output / f"{name}-{seed}.json", report)
            summary["experiments"].append({k: v for k, v in report.items() if k != "results"})
            print(json.dumps(summary["experiments"][-1], ensure_ascii=False), flush=True)
    b.save(output / "summary.json", summary)
    print(json.dumps(summary, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
