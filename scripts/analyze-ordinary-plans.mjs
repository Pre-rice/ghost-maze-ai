import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { analyzeOrdinaryPlans } from '../src/design/ordinary-plans.js';

export function main(args = process.argv.slice(2)) {
    try {
        const [mapFile, outputFile, configFile, ...extra] = args;
        if (!mapFile || !outputFile || extra.length) throw new TypeError('用法：node scripts/analyze-ordinary-plans.mjs <地图.json> <新的结果.json> [预算.json]');
        const map = JSON.parse(readFileSync(mapFile, 'utf8'));
        const config = configFile ? JSON.parse(readFileSync(configFile, 'utf8')) : {};
        const report = analyzeOrdinaryPlans(map, config);
        writeFileSync(outputFile, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
        console.log(JSON.stringify({ output: outputFile, conclusion: report.conclusion,
            baseline: report.baseline.result.status, N: report.baseline.result.totalActions,
            completeOrders: report.completeOrders, humanQualityScore: null }));
        return report.conclusion === 'unknown' || report.baseline.result.status === 'unknown' ||
            report.queries.some(q => q.result.status === 'unknown') ? 2 : 0;
    } catch (error) {
        console.error('普通计划核查失败：' + error.message);
        return 1;
    }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
