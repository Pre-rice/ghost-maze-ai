import { GameLogic, actionFromName } from '../reference/engine.js';
import { createReferenceEnvironment } from '../reference/environment.js';

/**
 * 诱饵标记实验环境（只在本分支试验用）：
 * 新增 DROP 动作——在玩家当前格放一个标记，鬼在看不见玩家时走向最近的标记。
 * 其余与本体一致；不改 ../ghost-maze，也不进入 src/reference。
 */
export function createDecoyEnvironment(mapData) {
  const base = createReferenceEnvironment(mapData);
  const mapDefinition = base.mapDefinition;
  const actions = [...base.actions, 'DROP'];

  const initialState = () => {
    const state = GameLogic.createInitialState(mapDefinition);
    for (const layer of state.layerStates) layer.lures = [];
    return state;
  };

  const moveGhosts = (state, beforePlayer) => {
    const layer = state.player.layer;
    const layerDef = mapDefinition.layers[layer];
    const layerState = state.layerStates[layer];
    for (const ghost of layerState.ghosts) {
      const seesAfter = GameLogic._canGhostSeePlayer(ghost, state.player, layerDef, layerState);
      const seesBefore = GameLogic._canGhostSeePlayer(ghost, beforePlayer, layerDef, layerState);
      let target = null;
      if (seesAfter) target = state.player;
      else if (seesBefore) target = beforePlayer;
      else if (layerState.lures.length) {
        // 平手按 (x,y) 排序取最小，避免依赖标记的放置顺序。
        let best = null, bestDist = Infinity;
        for (const lure of layerState.lures) {
          const d = Math.abs(lure.x - ghost.x) + Math.abs(lure.y - ghost.y);
          if (d < bestDist || (d === bestDist && best && (lure.x < best.x || (lure.x === best.x && lure.y < best.y)))) {
            bestDist = d;
            best = lure;
          }
        }
        target = best;
      }
      if (!target) continue;
      const path = GameLogic._findShortestPath(ghost, target, layerDef, layerState);
      if (path && path.length > 1) { ghost.x = path[1].x; ghost.y = path[1].y; }
      const idx = layerState.lures.findIndex(l => l.x === ghost.x && l.y === ghost.y);
      if (idx >= 0) layerState.lures.splice(idx, 1);
    }
  };

  const step = (state, actionName) => {
    if (state.isDead || state.isWon) return state;
    const next = state.clone();
    // clone() 不复制自定义的 lures 字段，必须从原状态深拷贝。
    for (let i = 0; i < next.layerStates.length; i++) {
      next.layerStates[i].lures = (state.layerStates[i].lures ?? []).map(l => ({ ...l }));
    }
    const before = { x: state.player.x, y: state.player.y, layer: state.player.layer };
    let moved = false;
    if (actionName === 'DROP') {
      const layer = next.layerStates[next.player.layer];
      // 同一格不能重复放标记：避免“连按两次刷时间”的机械动作。
      if ((layer.lures ?? []).some(l => l.x === next.player.x && l.y === next.player.y)) return state;
      layer.lures.push({ x: next.player.x, y: next.player.y });
      moved = true;
    } else {
      const action = actionFromName(actionName);
      if (action.type !== 'MOVE') return state;
      const p = next.player;
      const layerDef = mapDefinition.layers[p.layer];
      const button = (layerDef.initialEntities.buttons || []).find(b =>
        b.x === p.x && b.y === p.y && b.direction.dx === action.payload.dx && b.direction.dy === action.payload.dy);
      moved = button
        ? (GameLogic.handlePressButton(next, { letter: button.letter }, mapDefinition), true)
        : GameLogic.handleMove(next, action.payload, mapDefinition, false);
    }
    if (!moved) return state;
    moveGhosts(next, before);
    GameLogic.handleItemPickup(next, mapDefinition);
    GameLogic.checkCollisions(next, mapDefinition);
    GameLogic.checkWinLossConditions(next, mapDefinition);
    return next;
  };

  const stateKey = state => {
    const lures = state.layerStates
      .flatMap(layer => (layer.lures ?? []).map(l => `${l.x},${l.y}`))
      .sort()
      .join('|');
    return `${base.stateKey(state)}#${lures}`;
  };

  const replay = acts => {
    let state = initialState();
    for (const action of acts) {
      const next = step(state, action);
      if (next === state) throw new Error(`无效动作 ${action}`);
      state = next;
      if (state.isDead) throw new Error(`动作 ${action} 导致死亡`);
    }
    return { state, totalActions: acts.length };
  };

  return Object.freeze({ mapDefinition, mapId: base.mapId, ruleset: base.ruleset, actions, initialState, step, stateKey, replay, mode: 'decoy' });
}
