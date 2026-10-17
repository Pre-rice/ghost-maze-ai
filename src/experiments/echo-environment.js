import { GameLogic, actionFromName } from '../reference/engine.js';
import { createReferenceEnvironment } from '../reference/environment.js';

/**
 * 回声模式实验环境（只在本分支试验用）：
 * 鬼追“最后一次看见玩家的位置”，而不是玩家当前位置。
 * 其余与本体一致：同速、一格、十字视线、门与墙、按钮与物品。
 * 不改 ../ghost-maze，也不进入 src/reference。
 */
export function createEchoEnvironment(mapData) {
  const base = createReferenceEnvironment(mapData);
  const mapDefinition = base.mapDefinition;

  const initialState = () => {
    const state = GameLogic.createInitialState(mapDefinition);
    for (const layer of state.layerStates) for (const ghost of layer.ghosts) ghost.memory = null;
    return state;
  };

  /** 先按“操作后位置优先、其次操作前位置”更新记忆。 */
  const remember = (state, beforePlayer) => {
    const layer = state.player.layer;
    const layerDef = mapDefinition.layers[layer];
    const layerState = state.layerStates[layer];
    for (const ghost of layerState.ghosts) {
      const seesAfter = GameLogic._canGhostSeePlayer(ghost, state.player, layerDef, layerState);
      const seesBefore = GameLogic._canGhostSeePlayer(ghost, beforePlayer, layerDef, layerState);
      if (seesAfter) ghost.memory = { x: state.player.x, y: state.player.y };
      else if (seesBefore) ghost.memory = { x: beforePlayer.x, y: beforePlayer.y };
    }
  };

  /** 每只鬼朝自己的记忆点走一步；已到记忆点但没有新视线时原地不动。 */
  const moveGhosts = state => {
    const layer = state.player.layer;
    const layerDef = mapDefinition.layers[layer];
    const layerState = state.layerStates[layer];
    for (const ghost of layerState.ghosts) {
      if (!ghost.memory) continue;
      const path = GameLogic._findShortestPath(ghost, ghost.memory, layerDef, layerState);
      if (path && path.length > 1) {
        ghost.x = path[1].x;
        ghost.y = path[1].y;
      }
    }
  };

  const step = (state, actionName) => {
    if (state.isDead || state.isWon) return state;
    const action = actionFromName(actionName);
    if (action.type !== 'MOVE') return state;
    const next = state.clone();
    const before = { x: state.player.x, y: state.player.y, layer: state.player.layer };
    const p = next.player;
    const layerDef = mapDefinition.layers[p.layer];
    const button = (layerDef.initialEntities.buttons || []).find(b =>
      b.x === p.x && b.y === p.y && b.direction.dx === action.payload.dx && b.direction.dy === action.payload.dy);
    const moved = button
      ? (GameLogic.handlePressButton(next, { letter: button.letter }, mapDefinition), true)
      : GameLogic.handleMove(next, action.payload, mapDefinition, false);
    if (!moved) return state;
    remember(next, before);
    moveGhosts(next);
    GameLogic.handleItemPickup(next, mapDefinition);
    GameLogic.checkCollisions(next, mapDefinition);
    GameLogic.checkWinLossConditions(next, mapDefinition);
    return next;
  };

  /** 记忆按鬼的位置排序后再拼，避免依赖鬼的编号或数组顺序。 */
  const stateKey = state => {
    const memory = state.layerStates
      .flatMap(layer => layer.ghosts
        .map(g => ({ x: g.x, y: g.y, memory: g.memory ? `${g.memory.x},${g.memory.y}` : '-' }))
        .sort((a, b) => a.x - b.x || a.y - b.y)
        .map(g => g.memory))
      .join('|');
    return `${base.stateKey(state)}#${memory}`;
  };

  const replay = actions => {
    let state = initialState();
    for (const action of actions) {
      const next = step(state, action);
      if (next === state) throw new Error(`无效动作 ${action}`);
      state = next;
      if (state.isDead) throw new Error(`动作 ${action} 导致死亡`);
    }
    return { state, totalActions: actions.length };
  };

  return Object.freeze({ mapDefinition, mapId: base.mapId, ruleset: base.ruleset, actions: base.actions, initialState, step, stateKey, replay, mode: 'echo' });
}
