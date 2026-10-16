import { readFileSync, writeFileSync } from 'node:fs';
import { analyzeArrangements } from '../src/design/arrangements.js';

try {
    const [source, destination, ...extra] = process.argv.slice(2);
    if (!source || !destination || extra.length) throw new TypeError('用法：npm run analyze:arrangements -- <地图.json> <新的结果.json>');
    const result = analyzeArrangements(JSON.parse(readFileSync(source, 'utf8')));
    writeFileSync(destination, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ status: result.status, mapId: result.mapId, N: result.N,
        candidateGoals: result.candidateGroups, allWinningNecessary: result.allWinning,
        optimalOnly: result.optimalOnly, orderedEdges: result.reduced?.length, output: destination }));
    if (result.status === 'unknown') process.exitCode = 2;
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
