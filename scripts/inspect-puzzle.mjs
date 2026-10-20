import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { inspectPuzzle, formatInspection } from '../src/design/inspection.js';

export function main(args = process.argv.slice(2)) {
    try {
        const options = args.filter(arg => arg.startsWith('--'));
        const files = args.filter(arg => !arg.startsWith('--'));
        if (options.some(arg => arg !== '--json') || files.length < 1 || files.length > 2) {
            throw new TypeError('用法：node scripts/inspect-puzzle.mjs <地图或旧录制.json> [明确动作数组.json] [--json]');
        }
        const input = JSON.parse(readFileSync(files[0], 'utf8'));
        const actions = files[1] ? JSON.parse(readFileSync(files[1], 'utf8')) : undefined;
        const report = inspectPuzzle(input, { actions });
        console.log(options.includes('--json') ? JSON.stringify(report, null, 2) : formatInspection(report));
        if (report.execution.status === 'invalid_action' || report.execution.remainingActions.length) return 2;
        return report.execution.status === 'dead' ? 1 : 0;
    } catch (error) {
        console.error('走法核对失败：' + error.message);
        return 2;
    }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
