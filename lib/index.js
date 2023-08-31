// Copyright (c) WarnerMedia Direct, LLC. All rights reserved. Licensed under the MIT license.
// See the LICENSE file for license information.

const core = require('@actions/core');
const github = require('@actions/github');
const YAML = require('js-yaml');
const prb = require('./variables/prb.js');
const coverage = require('./variables/coverage.js');
const pkg = require('./variables/package.js');

const action = {
    async main() {
        const token = core.getInput('repo-token');
        const configPath = core.getInput('configuration-path');
        const configRef = core.getInput('configuration-ref');

        const octokit = github.getOctokit(token);
        const config = await action.getConfig(octokit, configPath, configRef);
        const comment = github.context.payload.comment.body;
        const args = String(comment).trim().split(/[\r\n ]+/);

        // Remove leading slash
        if (args[0] && args[0][0] === '/') {
            args[0] = args[0].slice(1);
        }

        core.info(`Validating config: ${JSON.stringify(config, undefined, 2)}`);

        try {
            this.validateConfig(config);
        } catch (error) {
            return this.fail(error.message);
        }

        core.info(`Parsing comment: ${comment}`);

        let commands = config.commands;
        let consumed = [];
        let result=[];
        let variables = [];
        let incorrectCommand = false;
        let commandName = args[0];
        
        let packageAliases = [];

        core.info(`Using Command: ${commandName}`)

        for (let arg of args) {
            consumed.push(arg);

            let command = commands.find(command => action.commandMatches(command, arg));
            if (!command) {
                incorrectCommand = true;
                variables.push(arg);
            } else if (command.result) {
                result.push(command.result);
                if (command.package_aliases !== undefined) {
                    packageAliases.push(command.package_aliases);
                }
            } else if (command.commands) {
                commands = command.commands;
            }
        }

        if (result.length > 0) {
            return this.succeed(result, variables, commandName, packageAliases);
        } else {
            let consumedWithSlash = consumed.map((c, idx) => idx === 0 ? `/${c}` : c);
            let failed = consumedWithSlash.join(' ');
            let optionPrefix = (incorrectCommand && consumed.length === 1) ? '/' : '';
            let options = commands.map(command => optionPrefix + command.name).join(', ');
            let prefix = 'Unknown command';
            let suggest = consumedWithSlash.slice(0, -1).concat(`[${options}]`).join(' ');

            if (!incorrectCommand) {
                prefix = 'Incomplete command';
                suggest = consumedWithSlash.concat(`[${options}]`).join(' ');
            }

            let error = `${prefix} \`${failed}\` - try one of \`${suggest}\``;
            return this.fail(error);
        }
    },
    async getConfig(octokit, configPath, configRef) {
        let params = {
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            path: configPath,
            ref: configRef
        };
        core.info(`Retrieve: ${JSON.stringify(params)}`);

        const response = await octokit.rest.repos.getContent({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            path: configPath,
            ref: configRef
        });
        const text = Buffer.from(response.data.content, response.data.encoding).toString();

        return YAML.load(text);
    },
    validateConfig(config) {
        if (!config || !Array.isArray(config.commands)) {
            throw new Error(`Configuration error: missing \`commands\` array`);
        }

        let queue = config.commands.map(command => ({ context: [], command }));

        while (queue.length > 0) {
            let { context, command } = queue.shift();

            if (!command.name) {
                throw new Error(`Configuration error: a command is missing the \`name\` property`);
            }

            context = context.concat(command.name);

            if (command.result && command.commands) {
                throw new Error(`Configuration error: \`${context.join(' ')}\` must contain either a \`result\` or \`commands\` property, but not both`);
            } else if (command.result) {
                // ok
            } else if (command.commands) {
                queue.push(...command.commands.map(subcommand => ({
                    command: subcommand,
                    context
                })));
            } else {
                throw new Error(`Configuration error: \`${context.join(' ')}\` must contain either a \`result\` or \`commands\` property`);
            }
        }
    },
    commandMatches(command, arg) {
        let aliases = command.aliases || [];

        if (!Array.isArray(aliases)) {
            aliases = [aliases];
        }

        return (command.name === arg || aliases.includes(arg));
    },
    succeed(result, variables, command, packageAliases, message) {

        let jsonValue = [];
        let jsonKey = [];
        result.forEach(json_data => {
            let values = Object.keys(json_data).map((key) => json_data[key]);
            let keys = Object.keys(json_data).map((key) => key);
            jsonKey.push(keys.toString());
            jsonValue.push(parseInt(values));
        });

        // Create a Map of pipeline ID values
        let pipelineId = new Map;
        pipelineId.set(jsonKey[0], jsonValue);
        
        core.info(`Parsing extra variables: ${ JSON.stringify(variables)} `);

        let variableMap = {};
        if(command === "rebuild") {
            variableMap = prb.parseVariables(variables);
        }
        if(command === "coverage") {
            variableMap = coverage.parseVariables(variables);
        }
        if(command === "package") {
            variableMap = pkg.parseVariables(variables, packageAliases[0]);
        }
      
        core.info(`Success: ${JSON.stringify(Object.fromEntries(pipelineId))} ${JSON.stringify(variableMap)}`);
        core.setOutput('result', JSON.stringify(Object.fromEntries(pipelineId)));
        core.setOutput('variables', JSON.stringify(variableMap));
        if (message) {
            core.setOutput('message', `> ${message}`);
        }
        core.setOutput('reaction', 'rocket');
        return variableMap;
    },
    fail(message) {
        core.info(`Failed: ${message}`);
        core.setOutput('result', '{}');
        core.setOutput('message', `> ${message}`);
        core.setOutput('reaction', 'confused');
    }
};

module.exports = action;

/* istanbul ignore if */
if (require.main === module) {
    // If this file is the entry point for node, run main() immediately.
    // Unexpected errors are passed back to GitHub as failures.
    action.main().catch(error => core.setFailed(error));
}
