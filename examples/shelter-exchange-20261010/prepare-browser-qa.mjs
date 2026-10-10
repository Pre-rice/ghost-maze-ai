import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const evidence=JSON.parse(readFileSync(new URL('evidence.json',import.meta.url),'utf8'));
const folder=resolve('runs/shelter-exchange-20261010/browser');mkdirSync(folder,{recursive:true});
const path=name=>resolve(folder,name).replaceAll('\\','/');
const expectedPath=fileURLToPath(new URL('browser-trace.json',import.meta.url)).replaceAll('\\','/');
// QA 读取独立证书，用真实方向键逐状态核对，不向正式录制目录写入测试。
const script=`async page => {
    const errors=[],warnings=[],started=Date.now();
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(['warning','error'].includes(message.type()))warnings.push(message.text());});
    await page.route('**/qa-trace.json',route=>route.fulfill({path:${JSON.stringify(expectedPath)},contentType:'application/json'}));
    await page.goto('http://127.0.0.1:4193/game/?map=${evidence.sharecode}');
    await page.waitForFunction(()=>window.game?.controller?.currentGameState&&window.game.state==='playing',undefined,{timeout:10000});
    const readyMs=await page.evaluate(()=>performance.now());
    const expected=await page.evaluate(async()=>await(await fetch('/qa-trace.json')).json());
    const snapshot=async()=>page.evaluate(async()=>{
        const{traceState}=await import('/trace-core.js');const state=window.game.controller.currentGameState;
        return{physical:traceState(state),seenCells:state.seenCells};
    });
    const compare=async index=>{if(JSON.stringify(await snapshot())!==JSON.stringify(expected.trace[index]))throw new Error('第'+index+'状态不匹配');};
    await compare(0);await page.screenshot({path:${JSON.stringify(path('initial.png'))}});
    const debug=page.locator('#debug-vision-toggle');
    await debug.evaluate(el=>{el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));});
    await page.screenshot({path:${JSON.stringify(path('full-map.png'))}});
    await debug.evaluate(el=>{el.checked=false;el.dispatchEvent(new Event('change',{bubbles:true}));});await compare(0);
    const keys={U:'ArrowUp',R:'ArrowRight',D:'ArrowDown',L:'ArrowLeft'};
    for(let i=0;i<expected.actions.length;i++){await page.keyboard.press(keys[expected.actions[i]]);await page.waitForTimeout(250);await compare(i+1);}
    await page.getByRole('status').filter({hasText:'无伤通关已验证'}).waitFor({timeout:10000});
    await page.screenshot({path:${JSON.stringify(path('won.png'))}});
    const list=await page.evaluate(async()=>await(await fetch('/api/recordings')).json());
    return{status:await page.getByRole('status').innerText(),errors,warnings,list,checks:expected.trace.length,readyMs,
        elapsedMs:Date.now()-started,share:await page.evaluate(async()=>{
            const{DataSerializer}=await import('/game/src/core/dataSerializer.js');
            return DataSerializer.generateShareCode(window.game.controller.buildShareSourceData());
        }),physicalAndVisibilityMatched:true};
}`;
writeFileSync(path('qa-play.js'),script,{flag:'wx'});
console.log(path('qa-play.js'));
