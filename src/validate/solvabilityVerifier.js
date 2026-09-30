import { solveMap } from './solver.js';
export { relaxedDistField } from '../search/relaxed-distance.js';

/** 去掉鬼后的三态验证，仍遵循真实门、按钮、楼梯与资源约束。 */
export function verifyStructuralSolvability(mapData, options = {}) {
    return solveMap(mapData, { ...options, withGhosts: false });
}

/** 旧接口保留 true / false / null；null 表示预算内未知，不能作为无解训练标签。 */
export function isStructurallySolvable(mapData, options = {}) {
    return verifyStructuralSolvability(mapData, options).solvable;
}
