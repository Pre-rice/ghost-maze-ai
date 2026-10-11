import { readFileSync } from 'node:fs';

export function runSolverCli(solver, command = 'solve') {
    const args = process.argv.slice(2);
    const help = `用法：npm run ${command} -- <map.json> [--nodes 整数] [--states 整数] [--ms 整数]\n退出码：0 已解，1 已证明无解，3 预算内未知，2 输入或运行错误。`;
    if (args.length === 1 && args[0] === '--help') {
        console.log(help);
    } else {
        try {
            if (!args[0] || args[0].startsWith('--')) throw new TypeError(help);
            const names = { '--nodes': 'nodeBudget', '--states': 'stateBudget', '--ms': 'budgetMs' };
            const options = {};
            for (let index = 1; index < args.length; index += 2) {
                const name = names[args[index]];
                if (!name || args[index + 1] == null || Object.hasOwn(options, name)) throw new TypeError(`非法或重复参数：${args[index]}\n${help}`);
                options[name] = Number(args[index + 1]);
            }
            const raw = JSON.parse(readFileSync(args[0], 'utf8'));
            const map = raw.mapData ? { ...raw.mapData } : raw;
            if (raw.mapData) for (const key of ['gameMode', 'initialHealth']) if (Object.hasOwn(raw, key)) map[key] = raw[key];
            const result = solver(map, options);
            console.log(JSON.stringify(result, null, 2));
            process.exitCode = { solved: 0, proven_unsat: 1, unknown: 3 }[result.status];
        } catch (error) {
            console.error(error.message);
            process.exitCode = 2;
        }
    }
}
