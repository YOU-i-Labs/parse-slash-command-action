
function parseVariables(variables) {
    const presetIndex = variables.indexOf("--preset");
    let preset = [];

    if ( presetIndex > -1 ) {
        preset.push(variables[presetIndex+1]);
        variables.splice(presetIndex);
        variables.splice(presetIndex+1);
    }
    // Create a Map of variables passed to azure pipelines
    let variableMap = {};
    if (variables.length > 0 ) {
        variableMap.generateArgs = variables.join(' ');
    }

    if ( preset.length > 0 ) {
        variableMap.presets = preset.toString();
    }
    return variableMap;
}

module.exports = {parseVariables: parseVariables};
