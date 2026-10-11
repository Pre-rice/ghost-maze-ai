import { createReferenceEnvironment } from '../reference/environment.js';
import { compileRestrictions } from '../search/restrictions.js';
import { describeStep } from '../review/step-description.js';
import { WALL_TYPES } from '../reference/engine.js';

/** 坐标无关的候选假说；计时作用必须由原图受限搜索确认，不能从一条轨迹直接宣布必要。 */
export function clockHypothesis(letter, id = `clock_${letter}`) {
    return { id, sequence: [{ type: 'all', events: [
        { type: 'press', letter }, { type: 'player_stationary' },
        { type: 'nearest_ghost_distance', phase: 'before', distance: 2 },
        { type: 'nearest_ghost_distance', phase: 'after', distance: 1 }
    ] }] };
}

export function extractTemporalFeatures(mapData, actions) {
    const env = createReferenceEnvironment(mapData);
    const replay = env.replay(actions);
    const letters = [...new Set(env.mapDefinition.layers.flatMap(l => l.initialEntities.buttons.map(b => b.letter)))].sort();
    const monitors = letters.map(letter => compileRestrictions(env.mapDefinition, [clockHypothesis(letter)]));
    const events = [], buttonWord = [];
    let state = env.initialState(), stationaryActions = 0;
    for (const [index, action] of actions.entries()) {
        const next = env.step(state, action);
        const step = describeStep(state, next, action, env.mapDefinition, WALL_TYPES);
        if (step.button) {
            stationaryActions++;
            buttonWord.push(step.button);
            const roles = ['gate_toggle'];
            const clock = monitors[letters.indexOf(step.button)].advance([0], state, action, next) === null;
            if (clock) roles.push('closes_nearest_ghost_gap_2_to_1');
            const gates = next.layerStates.flatMap((layer, li) => ['h', 'v'].flatMap(axis =>
                layer.wallStates[axis].flatMap((row, y) => row.flatMap((wall, x) => wall.type === WALL_TYPES.LETTER_DOOR ?
                    [{ layer: li, axis, x, y, letter: wall.letter, state: wall.currentState }] : []))));
            events.push({ step: index + 1, letter: step.button, roles, player: step.playerAfter,
                ghostsBefore: step.ghostsBefore, ghostsAfter: step.ghostsAfter, gateChanges: step.gateChanges, gatesAfter: gates });
        }
        state = next;
    }
    return { schemaVersion: 1, featureVersion: 'temporal-v1', ruleset: env.ruleset, mapId: env.mapId,
        totalActions: replay.totalActions, movementCost: replay.movementCost, stationaryActions, buttonWord,
        clockEvents: events.filter(e => e.roles.includes('closes_nearest_ghost_gap_2_to_1')).length,
        events, hypotheses: [
            ...letters.filter(letter => events.some(e => e.letter === letter && e.roles.includes('closes_nearest_ghost_gap_2_to_1'))).map(letter => clockHypothesis(letter)),
            ...(buttonWord.length ? [{ id: 'observed_button_order', sequence: buttonWord.map(letter => ({ type: 'press', letter })) }] : [])
        ],
        interpretation: 'trajectory_diagnostics_only', humanQualityScore: null };
}
