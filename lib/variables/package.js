
function parseVariables(variables, aliasMap) {
    const variableMap = {};
    let variableString = variables.join(' ');

    // loop through the aliases defined in slash-commands.yaml and replace any found matches with the platforms associated
    // ex. keyword tizen would be replaced with -> tizen-nacl_armv7 tizen-nacl_x86_32 tizen-nacl_x86_64
    const replaceVars = (alias, platforms) => variableString = variableString.replace(alias, platforms.join(' '));
    Object.keys(aliasMap).forEach((key) => {
        const alias = aliasMap[key];
        if (alias.aliases && alias.platforms) {
            alias.aliases.forEach((a) => replaceVars(a, alias.platforms));
        }
    });

    if (variableString.length > 0 ) {
        variableMap.platforms = variableString;
    }
    return variableMap;
}

module.exports = {parseVariables: parseVariables};
