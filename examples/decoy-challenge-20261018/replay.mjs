import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createDecoyEnvironment } from '../../src/experiments/decoy-environment.js';

/** 逐帧打印参考解：玩家、鬼、标记、胜负。 */
export function replayTrace(map, actions) {
  const env = createDecoyEnvironment(map);
  const lines = [];
  let state = env.initialState();
  const describe = s => {
    const layer = s.layerStates[0];
    const ghosts = layer.ghosts.map(g => `G(${g.x},${g.y})`).join(' ');
    const lures = (layer.lures ?? []).map(l => `L(${l.x},${l.y})`).join(' ') || '-';
    return `P(${s.player.x},${s.player.y}) ${ghosts} lures[${lures}] keys=${s.player.keys}${s.isWon ? ' 胜利' : ''}${s.isDead ? ' 死亡' : ''}`;
  };
  lines.push(`起 ${describe(state)}`);
  for (const [i, action] of actions.entries()) {
    const next = env.step(state, action);
    const pressed = next !== state && next.player.x === state.player.x && next.player.y === state.player.y;
    lines.push(`${String(i + 1).padStart(2)} ${(action + (pressed ? '(停)' : '')).padEnd(10)} ${describe(next)}`);
    state = next;
  }
  return lines.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const map = JSON.parse(readFileSync(new URL('map.json', import.meta.url), 'utf8'));
  const parse = code => code.match(/DROP|[URDL]/g);
  const solutions = {
    'DROPDDRRRRDROPUUULLURRRR': '唯一解（2 次标记）'
  };
  for (const [code, label] of Object.entries(solutions)) {
    console.log(`=== ${label} ===`);
    console.log(replayTrace(map, parse(code)));
  }
}
