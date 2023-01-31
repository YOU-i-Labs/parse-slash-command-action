
export function parseVariables(variables) {
    let variableMap = new Map;
    if (variables.length > 0 ) {
        variableMap.set("targets", variables.join(' '));
    }
    return variableMap;
}
