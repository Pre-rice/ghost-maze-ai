import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const e = JSON.parse(readFileSync(new URL('evidence.json', import.meta.url), 'utf8'));
const trace = JSON.parse(readFileSync(new URL('browser-trace.json', import.meta.url), 'utf8'));
const folder = resolve('runs/gate-handoff-20261008/browser'); mkdirSync(folder, { recursive: true });
const initial = resolve(folder, 'initial.png').replaceAll('\\', '/'), won = resolve(folder, 'won.png').replaceAll('\\', '/');
const script = `async page => {
    const expected = ${JSON.stringify(trace)}, errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4182/game/?map=${e.sharecode}');
    await page.waitForFunction(() => window.game?.controller?.currentGameState && window.game.state === 'playing', undefined, {timeout:10000});
    const snapshot = async () => page.evaluate(async () => {
        const {traceState} = await import('/trace-core.js');
        const state = window.game.controller.currentGameState;
        return {physical:traceState(state),seenCells:state.seenCells};
    });
    const compare = async index => { const actual = await snapshot(); if(JSON.stringify(actual)!==JSON.stringify(expected.trace[index])) throw new Error('第'+index+'状态不匹配'); };
    await compare(0); await page.screenshot({path:${JSON.stringify(initial)}});
    const keys = {U:'ArrowUp',R:'ArrowRight',D:'ArrowDown',L:'ArrowLeft'};
    for(let i=0;i<expected.actions.length;i++){await page.keyboard.press(keys[expected.actions[i]]);await page.waitForTimeout(250);await compare(i+1);}
    await page.getByRole('status').filter({hasText:'无伤通关已验证'}).waitFor({timeout:10000});
    await page.screenshot({path:${JSON.stringify(won)}});
    const list = await page.evaluate(async()=>await(await fetch('/api/recordings')).json());
    return {status:await page.getByRole('status').innerText(),errors,list,final:await snapshot(),physicalAndVisibilityMatched:true};
}`;
writeFileSync(resolve(folder, 'qa-play.js'), script, { flag: 'wx' });
console.log(resolve(folder, 'qa-play.js'));
