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
import { isStructurallySolvable } from '../validate/solvabilityVerifier.js';
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
    let solvableStruct = false;
    if (structural.valid) {
        try {
            solvableStruct = isStructurallySolvable(mapData); // 返回布尔值
        } catch (e) {
            solvableStruct = false;
            structural.errors.push(`结构可解判定异常: ${e.message}`);
        }
    }

    // ── ③ 无伤可通 + ④ 威胁实质 ──────────────────────
    let solve = null;
    if (structural.valid && solvableStruct) {
        try {
            solve = solveMap(mapData);
        } catch (e) {
            solve = { solvable: false, confidence: 'none', reason: `solver异常: ${e.message}`, moves: [], minSteps: -1, difficulty: null, solutionFeatures: null };
        }
    }

    const zeroHitPassed = !!solve?.solvable;
    const threatPassed = zeroHitPassed && (solve.solutionFeatures?.ghostSeenSteps ?? 0) >= 1;
    const passed = structural.valid && solvableStruct && zeroHitPassed && threatPassed;

    const report = {
        file,
        passed,
        gates: {
            structural: { passed: structural.valid, errors: structural.errors },
            structurallySolvable: { passed: solvableStruct },
            zeroHitSolvable: { passed: zeroHitPassed, confidence: solve?.confidence ?? null, reason: solve?.reason ?? null },
            threatSubstantial: { passed: threatPassed, ghostSeenSteps: solve?.solutionFeatures?.ghostSeenSteps ?? 0 }
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
        console.log(`② 结构可解:     ${solvableStruct ? '✓ 通过' : '✗ 未过'}`);
        console.log(`③ 无伤可通:     ${zeroHitPassed ? '✓ 通过' : '✗ 未过'}${solve ? ` (confidence=${solve.confidence}${solve.reason ? `, reason=${solve.reason}` : ''})` : ''}`);
        console.log(`④ 威胁实质:     ${threatPassed ? '✓ 通过' : '✗ 未过'}（解法被鬼盯 ${solve?.solutionFeatures?.ghostSeenSteps ?? 0} 步）`);
        if (passed && solve?.solutionFeatures) {
            const f = solve.solutionFeatures;
            console.log('──────────────────────────────────────────────');
            console.log('解法特征（巧妙性的量化信号）:');
            console.log(`   无伤最优步数: ${solve.minSteps}（松弛下界 ${f.greedySteps}，绕路 ${f.detourSteps} 步）`);
            console.log(`   回头次数:     ${f.backtrackCount}`);
            console.log(`   钥匙序深度:   ${f.keyDepth}（机制利用 ${f.mechanismUses} 次）`);
            console.log(`   被鬼盯:       ${f.ghostSeenSteps} 步 / ${solve.minSteps} 步（${(f.ghostSeenRatio * 100).toFixed(0)}%）`);
            console.log(`   最近鬼距:     ${f.minGhostDist}  探索率: ${(f.explorationRate * 100).toFixed(0)}%`);
        }
        console.log('══════════════════════════════════════════════');
        console.log(passed ? '\n✅ 四道硬门全部通过，可进入评审/试玩' : '\n❌ 硬门未过，需要修改或重新生成');
    }
    return report;
}

const [file, flag] = process.argv.slice(2);
if (!file) {
    console.error('用法: node src/tools/validate-map.js <map.json> [--json] [--no-stage1]');
    process.exit(2);
}
const report = run(file, { json: flag === '--json', noStage1: flag === '--no-stage1' });
process.exit(report.passed ? 0 : 1);
