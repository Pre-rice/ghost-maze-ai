/** CPU树模型只提供候选排序，不包含物理规则、精确答案或按地图查表。 */
export function createTreePredictor(model) {
    if(model?.schemaVersion!==1||model.modelType!=='extra_trees_binary'||!Number.isSafeInteger(model.dimension)||model.dimension<1||!model.trees?.length)throw new TypeError('不支持的树模型');
    for(const tree of model.trees){
        const n=tree.left?.length;if(!n||['right','feature','threshold','probability'].some(k=>tree[k]?.length!==n))throw new TypeError('模型树字段不完整');
        const seen=new Set(),visit=i=>{if(!Number.isSafeInteger(i)||i<0||i>=n||seen.has(i))throw new TypeError('模型树索引非法或有环');seen.add(i);if(tree.left[i]===-1){if(tree.right[i]!==-1||!Number.isFinite(tree.probability[i])||tree.probability[i]<0||tree.probability[i]>1)throw new TypeError('模型叶非法');return;}if(!Number.isInteger(tree.feature[i])||tree.feature[i]<0||tree.feature[i]>=model.dimension||!Number.isFinite(tree.threshold[i]))throw new TypeError('模型分裂非法');visit(tree.left[i]);visit(tree.right[i]);};visit(0);
    }
    return Object.freeze({dimension:model.dimension,predict(values){if(values.length!==model.dimension||!values.every(Number.isFinite))throw new TypeError('模型输入维数或数值非法');let total=0;for(const tree of model.trees){let i=0;while(tree.left[i]!==-1)i=Math.fround(values[tree.feature[i]])<=tree.threshold[i]?tree.left[i]:tree.right[i];total+=tree.probability[i];}return total/model.trees.length;}});
}
