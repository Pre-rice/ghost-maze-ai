import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { WALL_TYPES as W, normalizeMapData, normalizeVoidWalls, validateMapData, DataSerializer, GameLogic } from '../../src/reference/engine.js';
import { createReferenceEnvironment } from '../../src/reference/environment.js';
import { createDecoyEnvironment } from '../../src/experiments/decoy-environment.js';
import { createBreadthFirstSearch } from '../../../ghost-maze/src/solver/breadthFirst.js';

const budget = { nodeBudget: 800000, stateBudget: 800000, budgetMs: 30000 };
const read = name => JSON.parse(fs.readFileSync(new URL(name, import.meta.url)));

/** 从公开元件表重建；物理仍仅来自本体。 */
export function derive() {
  const wall = (type, extra = {}) => ({ type, keys: 0, ...extra });
  const l = {
    activeCells: Array.from({ length: 8 }, () => Array(8).fill(false)),
    hWalls: Array.from({ length: 9 }, () => Array.from({ length: 8 }, () => wall(W.SOLID))),
    vWalls: Array.from({ length: 8 }, () => Array.from({ length: 9 }, () => wall(W.SOLID))),
    ghosts: [{ x: 4, y: 0, id: 0 }],
    items: [],
    buttons: [{ x: 2, y: 0, letter: 'A', direction: { dx: 0, dy: -1 } }],
    endPos: { x: 5, y: 1 },
    customStartPos: { x: 0, y: 2 }
  };
  const cells = [];
  for (let x = 0; x <= 5; x++) for (let y = 0; y <= 2; y++) cells.push([x, y]);
  for (const [x, y] of cells) l.activeCells[y][x] = true;
  for (const [x, y] of cells) {
    if (l.activeCells[y]?.[x + 1]) l.vWalls[y][x + 1] = wall(W.EMPTY);
    if (l.activeCells[y + 1]?.[x]) l.hWalls[y + 1][x] = wall(W.EMPTY);
  }
  l.vWalls[1][5] = wall(W.LETTER_DOOR, { letter: 'A', initialState: 'closed' });
  l.hWalls[1][5] = wall(W.SOLID);
  l.hWalls[2][5] = wall(W.SOLID);
  return normalizeVoidWalls(normalizeMapData({
    width: 8, height: 8, editorMode: 'free', gameMode: 'death-loop', initialHealth: 5,
    multiLayerMode: false, layerCount: 1, layers: [l], stairs: []
  }));
}

export function verifyMap(map) {
  assert.deepEqual(map, derive());
  assert.equal(validateMapData(map).valid, true);

  const env = createDecoyEnvironment(map);
  const native = createReferenceEnvironment(map);

  // 冷初态
  const s0 = env.initialState(), l = env.mapDefinition.layers[0];
  const cold = l.initialEntities.ghosts.every(g => !GameLogic._canGhostSeePlayer(g, s0.player, l, s0.layerStates[0]));
  assert.equal(cold, true);

  // 本体规则下穷尽无解
  const nativeResult = createBreadthFirstSearch(native, {}).run(budget);
  assert.equal(nativeResult.status, 'proven_unsat');

  // 诱饵规则：11 步、16 条最优、全部两次 DROP
  const search = createBreadthFirstSearch(env, { allOptimal: true });
  const result = search.run(budget);
  assert.equal(result.status, 'solved');
  assert.equal(result.totalActions, 11);
  const routes = [...search.routes()];
  assert.equal(routes.length, 16);
  for (const acts of routes) {
    assert.equal(acts.filter(a => a === 'DROP').length, 2);
  }

  // 去终点安全：删 endPos 后重放全部最优
  const noEnd = structuredClone(map);
  noEnd.layers[0].endPos = null;
  const envNoEnd = createDecoyEnvironment(noEnd);
  for (const acts of routes) {
    let s = envNoEnd.initialState();
    for (const a of acts) {
      const n = envNoEnd.step(s, a);
      assert.notEqual(n, s);
      assert.equal(n.isDead, false);
      s = n;
    }
  }

  // 分享码往返
  const encoded = DataSerializer.generateShareCode(map);
  assert.equal(encoded.success, true);
  const decoded = DataSerializer.loadFromShareCode(encoded.code);
  assert.equal(decoded.success, true);
  assert.deepEqual(decoded.data.mapData, map);

  return {
    status: result.status,
    totalActions: result.totalActions,
    routes: routes.length,
    allTwoDrops: true,
    cold,
    nativeStatus: nativeResult.status,
    shareCode: encoded.code,
    mapId: native.mapId,
    ruleset: env.ruleset,
    humanQuality: null,
    role: 'experimental_rule_prototype_not_gallery'
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const map = read('map.json');
  const result = verifyMap(map);
  console.log(JSON.stringify(result));
}
