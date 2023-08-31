
function parseVariables(variables) {
    let variableMap = {};
    if (variables.length > 0 ) {
        let listItems = variables.map(i => '- ' + i);
        variableMap.targets = listItems.join('\n');
    }
    return variableMap;
}

module.exports = {parseVariables: parseVariables};
