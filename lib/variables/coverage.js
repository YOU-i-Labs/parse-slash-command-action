
function parseVariables(variables) {
    let variableMap = {};
    if (variables.length > 0 ) {
        variableMap.targets = variables.join(' ');
    }
    return variableMap;
}

module.exports = {parseVariables: parseVariables};
