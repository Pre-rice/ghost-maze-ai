#!/usr/bin/env node
/**
 * validate-map - 地图硬门验证 CLI
 *
 * 用法：
 *   node src/tools/validate-map.js <map.json>          # 人类可读报告
 *   node src/tools/validate-map.js <map.json> --json   # JSON 报告（供存档/脚本消费）
 *   node src/tools/validate-map.js <map.json> --no-stage1   # 跳过阶段一要素约束
 *
 * 四道硬门（全部通过才可进入评审/试玩）：
 *   ① 结构合法  mapDataValidator（形状/边界/实体/阶段一要素约束）
 *   ② 结构可解  isStructurallySolvable（无鬼 BFS 钥匙约束可达）
 *   ③ 无伤可通  solveMap（带鬼 A*，stamina 内零伤路径存在）
 *   ④ 威胁实质  解法路径被鬼盯 ≥1 步（鬼不是摆设）
 *
 * 输出附带解法特征（巧妙性的量化信号）：最优步数/绕路量/回头/钥匙序深度/被盯步数。
 */
import { readFileSync } from 'node:fs';
import { WALL_TYPES } from '../engine/constants.js';
import { validateMapData } from '../validate/mapDataValidator.js';
import { verifyStructuralSolvability } from '../validate/solvabilityVerifier.js';
import { solveMap } from '../validate/solver.js';

function loadMap(file) {
    const raw = readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    // 兼容带包装的地图存档（{ mapData, designIntent, ... }）
    return (data.mapData && typeof data.mapData === 'object' && data.mapData.hWalls) ? data.mapData : data;
}

function countElements(mapData) {
    let doors = 0, locked = 0, oneWay = 0, glass = 0, letterDoors = 0;
    const { width, height } = mapData;
    const count = (wall) => {
        const t = wall?.type;
        if (t === WALL_TYPES.DOOR) doors++;
        else if (t === WALL_TYPES.LOCKED) locked++;
        else if (t === WALL_TYPES.ONE_WAY) oneWay++;
        else if (t === WALL_TYPES.GLASS) glass++;
        else if (t === WALL_TYPES.LETTER_DOOR) letterDoors++;
    };
    for (let y = 0; y <= height; y++) for (let x = 0; x < width; x++) count(mapData.hWalls[y]?.[x]);
    for (let y = 0; y < height; y++) for (let x = 0; x <= width; x++) count(mapData.vWalls[y]?.[x]);
    return {
        size: `${width}×${height}`,
        mode: mapData.gameMode || 'exploration',
        stamina: mapData.initialStamina,
        doors,
        locked,
        keys: (mapData.items || []).length,
        ghosts: (mapData.initialGhosts || []).length,
        oneWay, glass, letterDoors,
        buttons: (mapData.buttons || []).length,
        multiLayer: !!mapData.multiLayerMode
    };
}

function run(file, opts) {
    const mapData = loadMap(file);

    // ── ① 结构合法 ────────────────────────────────────
    const structural = validateMapData(mapData, { stage1Only: !opts.noStage1 });

    // ── ② 结构可解 ────────────────────────────────────
    let solvableStruct = null;
    let structuralResult = null;
    if (structural.valid) {
        try {
            structuralResult = verifyStructuralSolvability(mapData, opts.budget);
            solvableStruct = structuralResult.solvable;
        } catch (e) {
            structuralResult = { status: 'error', reason: e.message };
            structural.errors.push(`结构可解判定异常: ${e.message}`);
        }
    }

    // ── ③ 无伤可通 + ④ 威胁实质 ──────────────────────
    let solve = null;
    if (structural.valid && structuralResult?.status !== 'error' && solvableStruct !== false) {
        try {
            solve = solveMap(mapData, opts.budget);
        } catch (e) {
            solve = { status: 'error', solvable: null, confidence: 'none', reason: `solver异常: ${e.message}`, moves: [], minSteps: -1, difficulty: null, solutionFeatures: null };
        }
    }

    const zeroHitPassed = solve?.status === 'solved';
    if (zeroHitPassed) solvableStruct = true; // 全规则证书也证明去鬼后可通。
    const status = !structural.valid ? 'invalid' : solve?.status || structuralResult?.status || 'error';
    const threatPassed = zeroHitPassed && (solve.solutionFeatures?.ghostSeenSteps ?? 0) >= 1;
    const passed = structural.valid && solvableStruct === true && zeroHitPassed && threatPassed;

    const report = {
        file,
        status,
        passed,
        gates: {
            structural: { passed: structural.valid, errors: structural.errors },
            structurallySolvable: { passed: solvableStruct, status: solvableStruct === true ? 'solved' : structuralResult?.status ?? null },
            zeroHitSolvable: { passed: status === 'unknown' || status === 'error' ? null : zeroHitPassed, status, confidence: solve?.confidence ?? null, reason: solve?.reason ?? null },
            threatSubstantial: { policy: 'legacy_only', passed: threatPassed, ghostSeenSteps: solve?.solutionFeatures?.ghostSeenSteps ?? 0 }
        },
        stats: countElements(mapData),
        solutionFeatures: solve?.solutionFeatures ?? null,
        minSteps: solve?.minSteps ?? -1
    };

    if (opts.json) {
        console.log(JSON.stringify(report, null, 2));
    } else {
        const s = report.stats;
        console.log('══════════════════ 地图硬门验证 ══════════════════');
        console.log(`文件: ${file}`);
        console.log(`尺寸: ${s.size}  模式: ${s.mode}  体力: ${s.stamina}`);
        console.log(`要素: 钥匙×${s.keys}  锁门×${s.locked}  DOOR×${s.doors}  鬼×${s.ghosts}`
            + (s.oneWay || s.glass || s.letterDoors || s.buttons || s.multiLayer
                ? `  [注意: 含阶段二要素 oneWay=${s.oneWay} glass=${s.glass} letterDoor=${s.letterDoors} button=${s.buttons} multiLayer=${s.multiLayer}]`
                : ''));
        console.log('──────────────────────────────────────────────');
        console.log(`① 结构合法:     ${structural.valid ? '✓ 通过' : '✗ 未过'}`);
        if (!structural.valid) structural.errors.forEach(e => console.log(`   - ${e}`));
        console.log(`② 结构可解:     ${solvableStruct === null ? '？未知或错误' : solvableStruct ? '✓ 通过' : '✗ 已证无解'}`);
        console.log(`③ 无伤可通:     ${zeroHitPassed ? '✓ 通过' : '✗ 未过'}${solve ? ` (confidence=${solve.confidence}${solve.reason ? `, reason=${solve.reason}` : ''})` : ''}`);
        console.log(`④ 威胁实质:     ${threatPassed ? '✓ 通过' : '✗ 未过'}（解法被鬼盯 ${solve?.solutionFeatures?.ghostSeenSteps ?? 0} 步）`);
        if (passed && solve?.solutionFeatures) {
            const f = solve.solutionFeatures;
            console.log('──────────────────────────────────────────────');
            console.log('解法特征（巧妙性的量化信号）:');
            console.log(`   ${solve.optimality === 'proven' ? '已证最短动作' : '已知可行动作'}: ${solve.minSteps}（松弛下界 ${f.greedySteps}，绕路 ${f.detourSteps} 步）`);
            console.log(`   回头次数:     ${f.backtrackCount}`);
            console.log(`   钥匙序深度:   ${f.keyDepth}（机制利用 ${f.mechanismUses} 次）`);
            console.log(`   被鬼盯:       ${f.ghostSeenSteps} 步 / ${solve.minSteps} 步（${(f.ghostSeenRatio * 100).toFixed(0)}%）`);
            console.log(`   最近鬼距:     ${f.minGhostDist}  探索率: ${(f.explorationRate * 100).toFixed(0)}%`);
        }
        console.log('══════════════════════════════════════════════');
        console.log(`\n物理解状态: ${status}`);
        console.log(status === 'unknown' ? '预算内未知，可追加验证预算；不是无解标签。' : passed ? '旧基线规则通过；不等于已证明有趣。' : '未通过旧基线规则，具体原因见上文。');
    }
    return report;
}

const [file, ...flags] = process.argv.slice(2);
try {
    if (!file) throw new Error('用法: npm run validate:legacy -- <map.json> [--json] [--no-stage1] [--nodes N] [--states N] [--ms N]');
    const opts = { json: false, noStage1: false, budget: {} };
    const budgetNames = { '--nodes': 'nodeBudget', '--states': 'stateBudget', '--ms': 'budgetMs' };
    for (let i = 0; i < flags.length; i++) {
        if (flags[i] === '--json') opts.json = true;
        else if (flags[i] === '--no-stage1') opts.noStage1 = true;
        else if (budgetNames[flags[i]] && flags[i + 1] != null) {
            const name = budgetNames[flags[i]];
            if (Object.hasOwn(opts.budget, name)) throw new Error('重复参数：' + flags[i]);
            opts.budget[name] = Number(flags[++i]);
        }
        else throw new Error('未知参数：' + flags[i]);
    }
    const report = run(file, opts);
    process.exitCode = report.status === 'unknown' ? 3 : ['invalid', 'error'].includes(report.status) ? 2 : report.passed ? 0 : 1;
} catch (error) {
    console.error(error.message);
    process.exitCode = 2;
}
