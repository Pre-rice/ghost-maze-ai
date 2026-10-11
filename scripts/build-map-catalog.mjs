import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { DataSerializer, ReplaySerializer, validateMapData } from '../src/reference/engine.js';
import { createReferenceEnvironment } from '../src/reference/environment.js';
import { solveFastMap } from '../src/search/fast-solver.js';
import { verifyRecording } from '../src/review/recordings.js';

// 汇总明确落盘的地图，不展开大型搜索日志中的批量失败编辑；原图与证据只读。
const root = fileURLToPath(new URL('../', import.meta.url));
const destination = resolve(root, '../ghost-maze/docs/ai-map-catalog.md');
const output = resolve(root, 'runs/map-catalog');
const origin = process.argv[2] || 'https://ghostmaze.novic.cc/';
const walk = folder => existsSync(folder) ? readdirSync(folder, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(join(folder, entry.name)) : [join(folder, entry.name)]) : [];
const read = file => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };
const short = file => relative(root, file).replaceAll('\\', '/');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sources = [], skipped = [], entries = new Map();
const names = {
    'door-units-20261011/unit-01': ['《两面》', '2026-10-11 新交付；尚未试玩，待用户评价。12 格、两只鬼、一扇普通门，没有按钮或玻璃。'],
    'door-units-20261011/unit-02': ['《开路》', '2026-10-11 新交付；尚未试玩，待用户评价。11 格、两只鬼、普通门与一次性数字门各一扇，没有按钮或玻璃。'],
    'coupled-singlelayer/map': ['单层组合题', '“太妙了！好设计！”；想了好一阵子，指出左上 B 门没有作用。'],
    'user-refinements/user-01': ['用户优化图', '用户亲自精简，认为关键思路比旧图的绕行更精妙；40 步真人路线与参考证书一致。不作为另一张 AI 独立作品。'],
    'twin-handoff-20261009/map': ['双鬼交接', '“妙！”“想了好久才想出来”“媲美第一张图”；明确设计正反馈。'],
    'borrowed-shelter-wallfix-20261009/map': ['借用庇护·修正版', '看参考回放后评价“妙，好设计”；不记为无提示独立通关。'],
    'shelter-exchange-20261010/map': ['《回环》', '“你的设计是很不错的”；比较困难、勉强可称精妙，但担忧复杂性堆砌。看五步提示后通关。'],
    'single-station-relay-20261010/map': ['《借位》', '简洁；推理线性、难度不足。'],
    'return-to-source-20261010/map': ['《回位》', '“不错的谜题”；同时评价近期《借位》《回位》平平无奇、缺乏新意，已掌握套路后没有“妙”的感觉。已通关。'],
    'interlocked-singlelayer-20261008/map': ['交错单层', '像样但不精妙，随便试试就过了。'],
    'gate-handoff-20261008/map': ['七格交接', '有复杂性，但随便试试也能过。'],
    'permanent-return-20261009/map': ['永久回路', '“不错的图”；想出解法不难，元素用途明显，可以线性推导，希望难度来自巧妙解法。'],
    'consumed-bridge-20261009/map': ['消耗桥', '历史候选；未作为目标质量正例。'],
    'opposed-exit-20261009/map': ['相向出口', '历史候选；未作为目标质量正例。'],
    'minimal-units-20261007/unit-01': ['精简题 1', '“都还可以”；不推断成对偏好。'],
    'minimal-units-20261007/unit-02': ['精简题 2', '“都还可以”；不推断成对偏好。'],
    'solid-units-20261008/unit-01': ['无玻璃题 1', '普普通通。'],
    'solid-units-20261008/unit-02': ['无玻璃题 2', '重复已有思想。'],
    'puzzle-units/unit-01': ['探头再绕行', '初批试玩：太简单。'],
    'puzzle-units/unit-02': ['把鬼留在门那边', '初批试玩：太简单。'],
    'mechanism-lab/complementary-switch': ['互补开关', '初批试玩：太简单。'],
    'mechanism-lab/bypass-control': ['旁路对照', '机制对照；初批试玩太简单。'],
    'vertical-relay/remote-switch': ['跨层远程开关', '初批试玩：太简单；上下楼本身不增加解谜思想。'],
    'vertical-relay/local-key-control': ['跨层本地钥匙对照', '机制对照；初批试玩太简单。'],
    'demo-map': ['旧管线示范图', '仅作历史示范，不作为谜题质量成果。']
};

// 点评只取真实反馈和已保存的复盘；“不错”不自动等于达到精妙目标。
const reviews = {
    'coupled-singlelayer/map': { date: '2026-09-30', positive: true, evidence: 'docs/status.md' },
    'user-refinements/user-01': { date: '2026-09-30', evidence: 'examples/user-refinements/README.md' },
    'twin-handoff-20261009/map': { date: '2026-10-09', positive: true, evidence: 'docs/twin-handoff-review-20261009.md' },
    'borrowed-shelter-wallfix-20261009/map': { date: '2026-10-10', positive: true, evidence: 'docs/borrowed-shelter-review-20261010.md' },
    'shelter-exchange-20261010/map': { date: '2026-10-10', positive: true, evidence: 'docs/shelter-exchange-review-20261010.md' },
    'single-station-relay-20261010/map': { date: '2026-10-10', evidence: 'docs/single-station-relay-review-20261010.md' },
    'return-to-source-20261010/map': { date: '2026-10-10', positive: true, evidence: 'docs/architecture-diagnosis-handoff-20261010.md' },
    'interlocked-singlelayer-20261008/map': { date: '2026-10-08', evidence: 'docs/interlocked-review-20261008.md' },
    'gate-handoff-20261008/map': { date: '2026-10-09', evidence: 'docs/gate-handoff-review-20261009.md' },
    'permanent-return-20261009/map': { date: '2026-10-09', positive: true, evidence: 'docs/permanent-return-review-20261009.md' },
    'minimal-units-20261007/unit-01': { date: '2026-10-08', evidence: 'docs/status.md' },
    'minimal-units-20261007/unit-02': { date: '2026-10-08', evidence: 'docs/status.md' },
    'solid-units-20261008/unit-01': { date: '2026-10-08', evidence: 'docs/mechanism-selection-20261008.md' },
    'solid-units-20261008/unit-02': { date: '2026-10-08', evidence: 'docs/mechanism-selection-20261008.md' }
};

for (const folder of ['examples', 'runs', 'data/maps', 'data/generated']) {
    for (const file of walk(resolve(root, folder)).filter(file => file.endsWith('.json')).sort()) {
        if (/runs[\\/](architecture-upgrade|map-catalog)/.test(file)) continue;
        if (statSync(file).size > 2 * 1024 * 1024) { skipped.push(short(file)); continue; }
        const record = read(file); if (!record) continue;
        for (const [field, map] of [['', record], ['.map', record.map], ['.mapData', record.mapData]]) {
            if (!map?.width || (!map.hWalls && !map.layers)) continue;
            const checked = validateMapData(map), source = short(file) + field;
            sources.push(source);
            const id = hash(checked.valid ? checked.mapData : map);
            if (!entries.has(id)) entries.set(id, { id, map: checked.mapData, error: checked.error, sources: [], records: [] });
            const entry = entries.get(id); entry.sources.push(source); entry.records.push({ file, record });
        }
    }
}

function routes(record, path = '') {
    if (!record || typeof record !== 'object') return [];
    if (Array.isArray(record.actions) && record.actions.every(action => ['U', 'D', 'L', 'R', 'STAIR'].includes(action))) return [{ actions: record.actions, path: path + '.actions' }];
    const result = [];
    for (const key of ['result', 'evaluation', 'baseline', 'analysis', 'solution', 'reference', 'fast', 'trace']) {
        const value = record[key];
        if (key === 'trace' && Array.isArray(value)) {
            const actions = value.map(row => row.action).filter(action => !['START', 'INIT', null, undefined].includes(action));
            if (actions.length && actions.every(action => ['U', 'D', 'L', 'R', 'STAIR'].includes(action))) result.push({ actions, path: path + '.trace' });
        } else result.push(...routes(value, path + '.' + key));
    }
    return result;
}
const report = { ruleset: null, sourceCount: sources.length, skippedLargeLogs: skipped, maps: [] };
for (const entry of entries.values()) {
    entry.primary = entry.sources.find(source => source.startsWith('examples/') && /\/(map|unit-0[12]|user-01|remote-switch|local-key-control|complementary-switch|bypass-control)\.json$/.test(source)) || entry.sources[0];
    const key = entry.primary.replace(/^examples\//, '').replace(/\.json(?:\..*)?$/, '');
    const named = names[key]; entry.title = named?.[0] || key;
    entry.feedback = named?.[1] || '未作玩家质量验收。';
    entry.review = reviews[key];
    entry.main = !!named;
    if (entry.error) {
        entry.title = key.includes('borrowed-shelter-20261009') ? '借用庇护·撤回版' : entry.title;
        report.maps.push({ id: entry.id, sources: entry.sources, error: entry.error }); continue;
    }
    const encoded = DataSerializer.generateShareCode(entry.map); assert(encoded.success, encoded.error);
    entry.code = encoded.code;
    const decoded = DataSerializer.loadFromShareCode(entry.code); assert(decoded.success); assert.deepEqual(decoded.data.mapData, entry.map);
    const env = createReferenceEnvironment(entry.map); report.ruleset = env.ruleset;
    const candidates = [];
    for (const { file, record } of entry.records) {
        candidates.push(...routes(record).map(route => ({ ...route, source: short(file) + route.path })));
        const stem = file.replace(/\.json$/, '');
        for (const evidenceFile of [stem + '-evidence.json', resolve(dirname(file), 'evidence.json'), resolve(dirname(file), 'verification.json')]) {
            const evidence = read(evidenceFile); if (!evidence) continue;
            const list = Array.isArray(evidence) ? evidence.filter(row => row.id === key.split('/').at(-1)) :
                evidence.units ? evidence.units.filter(row => row.id === key.split('/').at(-1)) : [evidence];
            for (const value of list) candidates.push(...routes(value).map(route => ({ ...route, source: short(evidenceFile) + route.path })));
        }
    }
    for (const route of candidates.sort((a, b) => a.actions.length - b.actions.length)) {
        try { const result = env.replay(route.actions); if (result.state.isWon) { entry.route = route; break; } } catch { /* 不把不匹配路线当作证书。 */ }
    }
    // 只给作品目录里缺证书的既有地图一次有限求解；不搜索或生成新题。
    if (!entry.route && entry.primary.startsWith('examples/')) {
        const solved = solveFastMap(entry.map, { nodeBudget: 25000, stateBudget: 25000, budgetMs: 2000 });
        if (solved.status === 'solved') entry.route = { actions: solved.solution.actions, source: '迁移时有限求解；未继承旧最短证明' };
    }
    if (entry.route) {
        assert(env.replay(entry.route.actions).state.isWon);
        const replay = ReplaySerializer.generateShareCode(entry.map, entry.route.actions); assert(replay.success, replay.error);
        entry.replay = replay.code;
        assert.deepEqual(ReplaySerializer.loadFromShareCode(entry.map, entry.replay).actions, entry.route.actions);
    }
    report.maps.push({ id: entry.id, sources: entry.sources, mapCode: entry.code, replayCode: entry.replay,
        steps: entry.route?.actions.length, routeSource: entry.route?.source, verifiedWin: !!entry.route });
}

const url = (entry, replay = false) => origin + '?map=' + entry.code + (replay ? '&replay=' + entry.replay : '');
const sourceLinks = entry => entry.sources.map(source => {
    const file = source.replace(/\.json\..*$/, '.json');
    return '[' + source + '](../../ghost-maze-ai/' + file + ')';
}).join('、');
const valid = [...entries.values()].filter(entry => entry.code);
let document = '# AI 地图总目录\n\n更新：2026-10-11。游玩、AI 和回放已使用同一规则；下列码全部为当前格式。旧码弃用，原地图、原证据和真人录制保持原样。\n\n';
document += '扫描 ' + sources.length + ' 份明确保存的地图资料，按完整地图内容去重得到 ' + entries.size + ' 张；其中 ' + valid.length + ' 张可生成并重新打开，' + valid.filter(entry => entry.route).length + ' 张已有当前规则的无伤参考路线。数量包括母图、对照和实验候选，不等于正式作品数量。\n\n';
document += '本文件是地图、解法和用户评述的统一目录。默认试玩入口为正式站 `https://ghostmaze.novic.cc/`；当前目录使用 `' + origin + '`。正式站已同步当前规则和分享格式。只有地图码是普通游玩，追加操作码才进入回放。\n\n';
document += '参考步数表示新规则下路线成功执行的有效操作数；本次没有重新证明这些路线最短，也没有重新评价谜题质量。按钮、移动和楼梯均计步。参考回放和路线放在折叠区。\n\n';
document += '## 用户评价为“不错”及以上的地图\n\n以下按真实定性评述收录，不赋予数值评分；“不错但不够精妙”、看提示与看回放后的肯定均保留原有条件。未试玩的母图和改图不继承这些评价。\n\n';
document += '| 评价日期 | 地图 | 参考步数 | 用户简评与限制 | 评述依据 |\n| --- | --- | --- | --- | --- |\n';
for (const entry of valid.filter(entry => entry.review?.positive).sort((a, b) => a.review.date.localeCompare(b.review.date) || a.title.localeCompare(b.title, 'zh-CN'))) {
    assert(existsSync(resolve(root, entry.review.evidence)), '评述依据必须存在');
    document += '| ' + entry.review.date + ' | [' + entry.title + '](' + url(entry) + ') | ' + (entry.route?.actions.length ?? '缺路线') + ' | ' + entry.feedback + ' | [记录](../../ghost-maze-ai/' + entry.review.evidence + ') |\n';
}
const refinement = valid.find(entry => entry.primary === 'examples/user-refinements/user-01.json');
if (refinement) document += '\n另附[用户优化图](' + url(refinement) + ')：用户亲自修改并认为关键思路更精妙；参考与真人路线均为 40 步。它是单层组合题的亲缘改图，不计为新的 AI 独立作品，详见[当时说明](../../ghost-maze-ai/examples/user-refinements/README.md)。\n';
document += '\n## 已交付地图与主要对照\n\n';
for (const entry of valid.filter(entry => entry.main).sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))) {
    document += '### ' + entry.title + '\n\n[试玩](' + url(entry) + ') · ' + entry.feedback + '\n\n地图码：`' + entry.code + '`\n\n来源：' + sourceLinks(entry) + '\n\n';
    if (entry.review) document += '评述依据：[' + entry.review.date + ' 的记录](../../ghost-maze-ai/' + entry.review.evidence + ')。\n\n';
    if (entry.replay) document += '<details>\n<summary>参考回放（' + entry.route.actions.length + ' 步，含答案）</summary>\n\n[打开同页回放](' + url(entry, true) + ')\n\n操作码：`' + entry.replay + '`\n\n路线来源：' + entry.route.source + '\n\n</details>\n\n';
    else document += '尚无完整可验证的通关路线；不声称可解。\n\n';
}
const human = read(resolve(root, 'data/generated/recordings-current/manifest.json'));
if (human?.maps.length) {
    document += '## 真人路线迁移\n\n原始真人录制保留在 `data/solutions/`；新的地图码与操作码另存，逐份按明确关联的原图重放并核对物理终局。死亡循环只迁移最后一轮，循环次数和旧探索不写入回放。旧录制的动作歧义原样保留，不声称知道未被录下的按键或完整试错。\n\n<details>\n<summary>真人路线（' + human.maps.length + ' 份，含答案）</summary>\n\n';
    for (const row of human.maps) {
        const migrated = read(resolve(root, row.migratedFile));
        assert(migrated && verifyRecording(migrated.input).won);
        const entry = valid.find(entry => entry.code === row.mapCode);
        assert(entry, '真人录制必须关联总目录中的合法原图');
        document += '- **' + entry.title + '**：' + row.actions + ' 步，[同页回放](' + origin + '?map=' + row.mapCode + '&replay=' + row.replayCode + ')；[原始记录](../../ghost-maze-ai/' + row.sourceFile + ')；[迁移记录](../../ghost-maze-ai/' + row.migratedFile + ')；原保留分支 ' + row.originalActions + ' 项，保留动作歧义 ' + row.ambiguities + ' 项。\n';
    }
    document += '\n</details>\n\n';
    report.humanRecordings = human.maps.length;
}
document += '## 撤回或数据冲突的历史图\n\n其中两张已交付跨层图的全局楼梯表有配对楼梯，但各层楼梯表是空数组，两份数据互相矛盾。本次保留原图并列出冲突，不自动选择一份覆盖另一份。其余拒绝项为悬空按钮等既有非法资料；没有生成成功后再打不开的假入口。\n\n';
for (const entry of entries.values()) if (entry.error) document += '- ' + entry.title + '：' + entry.error + '。保留来源：' + sourceLinks(entry) + '。' + (entry.title.includes('借用庇护') ? '使用上方“借用庇护·修正版”。' : '不提供可玩码。') + '\n';
document += '\n## 母图与已保存的实验候选\n\n这些是过程记录，未筛为新的正式作品。相同地图的来源已合并；反馈不从母图继承到改图。\n\n<details>\n<summary>展开全部合法历史候选与新地图码</summary>\n\n';
for (const entry of valid.filter(entry => !entry.main)) {
    document += '- **' + entry.title + '**：[试玩](' + url(entry) + ')；' + entry.feedback + ' 地图码 `' + entry.code + '`；' + sourceLinks(entry) + '。\n';
    if (entry.replay) document += '  <details><summary>参考 ' + entry.route.actions.length + ' 步（答案）</summary>\n\n  [同页回放](' + url(entry, true) + ')；操作码 `' + entry.replay + '`；路线来源：' + entry.route.source + '。\n\n  </details>\n';
    else document += '  尚无完整可验证的通关路线。\n';
}
document += '\n</details>\n\n## 汇总范围与后续更新\n\n';
document += '作品目录 `examples/`、已保存候选 `runs/` 和既有 `data/maps/`、`data/generated/` 均已扫描。大型日志中的批量编辑留在原实验档案，未复制为作品；略过的大型文件共 ' + skipped.length + ' 份，清单保存在验收记录。未解析的浏览器输出不会冒充地图。\n\n';
document += '在 AI 仓执行 `npm run catalog -- 本体首页地址` 可重新汇总，重新校验地图、新码往返及已有通关路线；默认使用正式站。工具只读取原始资料，另写此目录及 `runs/map-catalog/verification.json`。\n\n';
document += '以后每次交付地图，以及收到新的评价或改评，都更新本文件：保留地图与动作证书、试玩与折叠参考回放、简短评述及日期和依据。尚未评价、尚无解法、撤回和数据冲突须明确标注；改评保留此前记录，点评不自动继承到亲缘改图。原始反馈和录制继续独立保存，不用目录摘要替代原件。\n';
mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
writeFileSync(destination, document);
console.log(JSON.stringify({ sourceCount: sources.length, unique: entries.size, valid: valid.length, verifiedWin: valid.filter(entry => entry.route).length, rejected: entries.size - valid.length, document: destination }));
