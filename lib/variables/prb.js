
export function parseVariables(variables) {
    const presetIndex = variables.indexOf("--preset");
    let preset = [];

    if ( presetIndex > -1 ) {
        preset.push(variables[presetIndex+1]);
        variables.splice(presetIndex);
        variables.splice(presetIndex+1);
    }
    // Create a Map of variables passed to azure pipelines
    let variableMap = new Map;
    if (variables.length > 0 ) {
        variableMap.set("generateArgs", variables.join(' '));
    }

    if ( preset.length > 0 ) {
        variableMap.set("presets", preset.toString());
    }
    return variableMap;
}
