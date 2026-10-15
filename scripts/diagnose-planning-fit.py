"""同图拟合上限诊断，绝不作为泛化测试。"""
import hashlib
import importlib.util
import json
import sys
import time
from collections import Counter
from pathlib import Path

import numpy as np
from sklearn.ensemble import ExtraTreesClassifier

source, output = map(Path, sys.argv[1:])
if output.exists():
    raise ValueError("拒绝覆盖原实验")
module_path = Path(__file__).with_name("train-planning-baseline.py")
spec = importlib.util.spec_from_file_location("planning_baseline", module_path)
baseline = importlib.util.module_from_spec(spec)
spec.loader.exec_module(baseline)
m = json.loads((source / "manifest.json").read_text())
for name, expected in {**m["files"], **m.get("graphFiles", {})}.items():
    assert baseline.digest(source / name) == expected
rows = [json.loads(line) for line in (source / "rows.jsonl").read_text().splitlines()]
x = np.memmap(source / "features.f32", dtype="<f4", mode="r", shape=(m["rows"], m["dimension"]))
train = np.array([r["row"] for r in rows if r["trainEligible"]])
y = np.array([r["preferred"] for r in rows])
config = dict(n_estimators=64, max_depth=None, min_samples_leaf=1, max_features=0.6, n_jobs=4, random_state=17)
output.mkdir(parents=True)
baseline.save(output / "protocol.json", dict(role="in_sample_fit_diagnostic_not_generalization", config=config,
                                             sourceManifestSha256=baseline.digest(source / "manifest.json"),
                                             scriptSha256=baseline.digest(Path(__file__)), helperSha256=baseline.digest(module_path),
                                             declaredBeforeFit=True))
counts = Counter((rows[i]["mapId"], rows[i]["state"]) for i in train)
states = Counter(mid for mid, _ in counts)
weights = np.array([1 / counts[(rows[i]["mapId"], rows[i]["state"])] / states[rows[i]["mapId"]] for i in train])
start = time.perf_counter()
model = ExtraTreesClassifier(**config).fit(x[train], y[train], sample_weight=weights * len(weights) / weights.sum())
probability = model.predict_proba(x)[:, list(model.classes_).index(True)]
results = []
for record in m["records"]:
    graph = json.loads((source / "graphs" / (record["mapId"] + ".json")).read_text())
    results.append(baseline.evaluate(record, graph, rows, probability))
artifact = baseline.exported_model(model, m["dimension"])
baseline.save(output / "model.json", artifact)
report = dict(role="in_sample_fit_diagnostic_not_generalization", fittedRows=len(train), elapsedSeconds=time.perf_counter() - start,
              rowAccuracy=float(np.mean((probability[train] >= 0.5) == y[train])), aggregate=baseline.aggregate(results), results=results,
              modelSha256=baseline.digest(output / "model.json"), independentTestMaps=0)
baseline.save(output / "summary.json", report)
print(json.dumps({k: v for k, v in report.items() if k != "results"}, ensure_ascii=False))
