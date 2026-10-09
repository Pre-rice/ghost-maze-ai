import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const e = JSON.parse(readFileSync(new URL('evidence.json', import.meta.url), 'utf8'));
const trace = JSON.parse(readFileSync(new URL('browser-trace.json', import.meta.url), 'utf8'));
const folder = resolve('runs/permanent-return-20261009/browser'); mkdirSync(folder, { recursive: true });
const initial = resolve(folder, 'initial.png').replaceAll('\\', '/'), won = resolve(folder, 'won.png').replaceAll('\\', '/');
const script = `async page => {
    const expected = ${JSON.stringify(trace)}, errors = []; const started=Date.now();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4187/game/?map=${e.sharecode}');
    await page.waitForFunction(() => window.game?.controller?.currentGameState && window.game.state === 'playing', undefined, {timeout:10000});
    const snapshot = async () => page.evaluate(async () => {
        const {traceState} = await import('/trace-core.js');
        const state = window.game.controller.currentGameState;
        return {physical:traceState(state),seenCells:state.seenCells};
    });
    const compare = async index => { const actual = await snapshot(); if(JSON.stringify(actual)!==JSON.stringify(expected.trace[index])) throw new Error('第'+index+'状态不匹配'); };
    const readyMs=await page.evaluate(()=>performance.now()); await compare(0); await page.screenshot({path:${JSON.stringify(initial)}});
    const debug=page.locator('#debug-vision-toggle');
    await debug.evaluate(el=>{el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));});
    await page.screenshot({path:${JSON.stringify(resolve(folder, 'full-map.png').replaceAll('\\', '/'))}});
    await debug.evaluate(el=>{el.checked=false;el.dispatchEvent(new Event('change',{bubbles:true}));}); await compare(0);
    const keys = {U:'ArrowUp',R:'ArrowRight',D:'ArrowDown',L:'ArrowLeft'};
    for(let i=0;i<expected.actions.length;i++){await page.keyboard.press(keys[expected.actions[i]]);await page.waitForTimeout(250);await compare(i+1);}
    await page.getByRole('status').filter({hasText:'无伤通关已验证'}).waitFor({timeout:10000});
    await page.screenshot({path:${JSON.stringify(won)}});
    const list = await page.evaluate(async()=>await(await fetch('/api/recordings')).json());
    return {status:await page.getByRole('status').innerText(),errors,list,checks:expected.trace.length,readyMs,elapsedMs:Date.now()-started,share:await page.evaluate(async()=>{const {DataSerializer}=await import('/game/src/core/dataSerializer.js');return DataSerializer.generateShareCode(window.game.controller.buildShareSourceData());}),physicalAndVisibilityMatched:true};
}`;
writeFileSync(resolve(folder, 'qa-play.js'), script, { flag: 'wx' });
console.log(resolve(folder, 'qa-play.js'));
