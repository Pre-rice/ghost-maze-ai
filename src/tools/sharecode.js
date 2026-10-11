// Node 工具与网页使用同一份分享格式，不维护旧码解码器。
export { DataSerializer } from '../reference/engine.js';
import { DataSerializer } from '../reference/engine.js';
export const generateShareCode = map => DataSerializer.generateShareCode(map);
export const loadFromShareCode = code => DataSerializer.loadFromShareCode(code);
