import { analyzeMap } from './analyze.js';
import { applyEdit, proposeEdit, seededRandom } from './edits.js';
import { createReferenceEnvironment } from '../reference/environment.js';
import { compileRestrictions } from '../search/restrictions.js';
import { assertButtonAttachments } from './button-support.js';
import { auditPuzzleBoundaries } from './rule-boundaries.js';

/** 可复现的有限编辑实验；这是机制证据档案，尚无学得的质量奖励。 */
export function searchDesigns(map, { familyId, seed = 1, iterations = 24, maxDepth = 3, hypotheses = [], budget = {} } = {}) {
    if (map.editorMode !== 'free' || map.layerCount !== 1 || map.layers?.length) throw new TypeError('编辑搜索目前只支持顶层单层 free 地图');
    if (typeof familyId !== 'string' || !familyId.trim()) throw new TypeError('必须提供 familyId');
    if (!Number.isSafeInteger(iterations) || iterations < 0 || !Number.isSafeInteger(maxDepth) || maxDepth < 1) throw new TypeError('非法搜索预算');
    assertButtonAttachments(map);
    const random = seededRandom(seed), root = analyzeMap(map, hypotheses, budget);
    const nodes = [{ id: 0, parentId: null, parentMapId: null, mapId: root.mapId, depth: 0, edit: null, map: structuredClone(map), analysis: root }];
    const seen = new Map([[root.mapId, 0]]), attempts = [], buckets = new Map();
    const archive = node => {
        if (node.analysis?.baseline.status !== 'solved') return;
        node.boundaryAudit = auditPuzzleBoundaries(node.map, { nodeBudget: budget.nodeBudget ?? 250000, budgetMs: budget.budgetMs ?? 10000 });
        if (node.boundaryAudit.status !== 'safe') return;
        const necessary = node.analysis.counterfactuals.filter(c => c.conclusion === 'necessary_within_scope').map(c => c.hypothesis.id).sort();
        // 动作分桶只用于取样多样性；不把步数越多当作越好玩。
        const descriptor = JSON.stringify([necessary, Math.floor(node.analysis.baseline.solution.totalActions / 4)]);
        if (!buckets.has(descriptor)) buckets.set(descriptor, node.id);
    };
    archive(nodes[0]);
    for (let attempt = 0; attempt < iterations; attempt++) {
        const parents = nodes.filter(node => node.depth < maxDepth);
        const parent = parents[Math.floor(random() * parents.length)], edit = proposeEdit(parent.map, random);
        const record = { attempt, parentId: parent.id, parentMapId: parent.mapId, edit };
        let candidate, mapId;
        try { candidate = applyEdit(parent.map, edit); mapId = createReferenceEnvironment(candidate).mapId; }
        catch (error) { attempts.push({ ...record, status: 'invalid', error: error.message }); continue; }
        if (seen.has(mapId)) { attempts.push({ ...record, status: 'duplicate', nodeId: seen.get(mapId), mapId }); continue; }
        const node = { id: nodes.length, parentId: parent.id, parentMapId: parent.mapId, mapId, depth: parent.depth + 1, edit, map: candidate };
        try { compileRestrictions(createReferenceEnvironment(candidate).mapDefinition, hypotheses); }
        catch (error) { node.analysis = null; node.error = error.message; }
        // 条件坐标失效可记录；求解器自身报错必须中止实验，不能吞掉正确性故障。
        if (!node.error) node.analysis = analyzeMap(candidate, hypotheses, budget);
        // 未知、无解及条件失效的中间图仍可产生后代；不把它们伪装成成功样本。
        nodes.push(node); seen.set(mapId, node.id); archive(node);
        attempts.push({ ...record, status: node.analysis ? node.analysis.baseline.status : 'analysis_error', nodeId: node.id, mapId });
    }
    return { schemaVersion: 1, generatorVersion: 'free-edit-v2', evaluatorVersion: root.evaluatorVersion,
        ruleset: root.ruleset, familyId, rootMapId: root.mapId, seed, iterations, maxDepth, budget, hypotheses,
        humanPreference: null, nodes, attempts, archive: [...buckets].map(([descriptor, nodeId]) => ({ descriptor: JSON.parse(descriptor), nodeId })) };
}
