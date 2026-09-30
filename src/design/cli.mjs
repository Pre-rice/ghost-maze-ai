import { readFileSync, writeFileSync } from 'node:fs';
import { analyzeMap } from './analyze.js';
import { searchDesigns } from './search.js';

const read = path => JSON.parse(readFileSync(path, 'utf8'));
try {
    const [mode, mapFile, configFile, outputFile, ...extra] = process.argv.slice(2);
    if (!['analyze', 'search'].includes(mode) || !mapFile || !configFile || extra.length) throw new TypeError('用法：node src/design/cli.mjs <analyze|search> <map.json> <config.json> [新输出.json]');
    const map = read(mapFile), config = read(configFile);
    const allowed = mode === 'analyze' ? ['hypotheses', 'budget'] : ['familyId', 'seed', 'iterations', 'maxDepth', 'hypotheses', 'budget'];
    if (!config || typeof config !== 'object' || Array.isArray(config) || Object.keys(config).some(key => !allowed.includes(key))) throw new TypeError('配置包含未知字段或不是对象');
    const result = mode === 'analyze' ? analyzeMap(map, config.hypotheses, config.budget) : searchDesigns(map, config);
    const output = JSON.stringify(result, null, 2) + '\n';
    // 显式输出路径只能创建新文件，避免覆盖既有实验或用户地图。
    if (outputFile) { writeFileSync(outputFile, output, { flag: 'wx' }); console.log(outputFile); }
    else process.stdout.write(output);
    if (mode === 'analyze') process.exitCode = result.baseline.status === 'proven_unsat' ? 1 :
        result.baseline.status === 'unknown' || result.counterfactuals.some(c => c.conclusion === 'unknown') ? 3 : 0;
} catch (error) { console.error(error.message); process.exitCode = 2; }
