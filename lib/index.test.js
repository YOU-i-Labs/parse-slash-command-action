// Copyright (c) WarnerMedia Direct, LLC. All rights reserved. Licensed under the MIT license.
// See the LICENSE file for license information.

const core = require('@actions/core');
const github = require('@actions/github');
const action = require('.');

describe('parse-slash-command', () => {
    let $processEnv = {};

    beforeEach(() => {
        $processEnv = { ...process.env };

        jest.spyOn(core, 'setOutput').mockReturnValue();
        jest.spyOn(core, 'info').mockReturnValue();

        process.env['INPUT_REPO-TOKEN'] = 'cafe43';
        process.env['INPUT_CONFIGURATION-PATH'] = '.github/slash-commands.yaml';
        process.env['INPUT_CONFIGURATION-REF'] = 'aabbcc';
    });

    afterEach(() => {
        process.env = $processEnv;
    });

    describe('main', () => {
        beforeEach(() => {
            jest.spyOn(action, 'getConfig').mockReturnValue({
                commands: [
                    {
                        name: 'order',
                        aliases: 'gimme',
                        commands: [
                            {
                                name: 'pizza',
                                result: {
                                    action: 310
                                }
                            },
                            {
                                name: 'nachos',
                                aliases: ['chips', 'cheese'],
                                result: {
                                    action: 311
                                }
                            }
                        ]
                    },
                    {
                        name: 'package',
                        result: {
                            pipeline: 340
                        },
                        package_aliases: [
                            {
                                aliases: ['tizen', 'tizen-nacl'],
                                platforms: ['tizen-nacl_armv7', 'tizen-nacl_x86_32', 'tizen-nacl_x86_64']
                            },
                            {
                                aliases: ['linux'],
                                platforms: ['linux', 'linuxcxx11']
                            }
                        ]
                    },
                    {
                        name: 'rebuild',
                        commands: [
                            {
                                name: "everything",
                                result: {
                                    pipeline: 339
                                }
                            }
                        ]
                    },
                    {
                        name: 'coverage',
                        result: {
                            pipeline: 341
                        }
                    }
                ]
            });
        });

        it('returns user-defined props and default reaction if command matches', async () => {
            github.context = new github.context.constructor();
            github.context.payload = {
                comment: {
                    body: '/order pizza nachos -d YI_ABC_DEF=ON --preset prb_default'
                }
            };

            await action.main();

            expect(action.getConfig).toHaveBeenCalledWith(expect.anything(), '.github/slash-commands.yaml', 'aabbcc');
            expect(core.setOutput).toHaveBeenCalledWith('result', JSON.stringify({
                action: [ 310, 311]
            }));
            expect(core.setOutput).toHaveBeenCalledWith('reaction', 'rocket');
        });

        it('returns user-defined props and default reaction if command matches using aliases', async () => {
            github.context = new github.context.constructor();
            github.context.payload = {
                comment: {
                    body: '/gimme chips'
                }
            };

            await action.main();

            expect(action.getConfig).toHaveBeenCalledWith(expect.anything(), '.github/slash-commands.yaml', 'aabbcc');
            expect(core.setOutput).toHaveBeenCalledWith('result', JSON.stringify({
                action: [ 311 ]
            }));
            expect(core.setOutput).toHaveBeenCalledWith('reaction', 'rocket');
        });

        it('ignores extra content after a valid command', async () => {
            github.context = new github.context.constructor();
            github.context.payload = {
                comment: {
                    body: '/order nachos\n\n(the developers are hungry)'
                }
            };

            await action.main();

            expect(action.getConfig).toHaveBeenCalledWith(expect.anything(), '.github/slash-commands.yaml', 'aabbcc');
            expect(core.setOutput).toHaveBeenCalledWith('result', JSON.stringify({
                action: [ 311 ]
            }));
            expect(core.setOutput).toHaveBeenCalledWith('reaction', 'rocket');
        });

        it('if provided, will load configuration from a custom path and ref', async () => {
            process.env['INPUT_CONFIGURATION-PATH'] = 'commands.yaml';
            process.env['INPUT_CONFIGURATION-REF'] = 'config-branch';

            github.context = new github.context.constructor();
            github.context.payload = {
                comment: {
                    body: '/order pizza'
                }
            };

            await action.main();

            expect(action.getConfig).toHaveBeenCalledWith(expect.anything(), 'commands.yaml', 'config-branch');
            expect(core.setOutput).toHaveBeenCalledWith('result', JSON.stringify({
                action: [ 310 ]
            }));
            expect(core.setOutput).toHaveBeenCalledWith('reaction', 'rocket');
        });

        it('returns error reaction and message if no command matches', async () => {
            github.context = new github.context.constructor();
            github.context.payload = {
                comment: {
                    body: '/pizza sauce'
                }
            };

            await action.main();
            expect(core.setOutput).toHaveBeenCalledWith('reaction', 'confused');
        });

        it('returns error reaction and message if a subcommand does not match', async () => {
            github.context = new github.context.constructor();
            github.context.payload = {
                comment: {
                    body: '/order sirloin'
                }
            };

            await action.main();

            expect(action.getConfig).toHaveBeenCalledWith(expect.anything(), '.github/slash-commands.yaml', 'aabbcc');
            expect(core.setOutput).toHaveBeenCalledWith('message', '> Unknown command `/order sirloin` - try one of `/order [pizza, nachos]`');
            expect(core.setOutput).toHaveBeenCalledWith('reaction', 'confused');
        });

        it('returns error reaction and message if a command is incomplete', async () => {
            github.context = new github.context.constructor();
            github.context.payload = {
                comment: {
                    body: '/order '
                }
            };

            await action.main();

            expect(action.getConfig).toHaveBeenCalledWith(expect.anything(), '.github/slash-commands.yaml', 'aabbcc');
            expect(core.setOutput).toHaveBeenCalledWith('message', '> Incomplete command `/order` - try one of `/order [pizza, nachos]`');
            expect(core.setOutput).toHaveBeenCalledWith('reaction', 'confused');
        });

        it('returns error reaction and message, containing an alias, if command is incomplete', async () => {
            github.context = new github.context.constructor();
            github.context.payload = {
                comment: {
                    body: '/gimme '
                }
            };

            await action.main();

            expect(action.getConfig).toHaveBeenCalledWith(expect.anything(), '.github/slash-commands.yaml', 'aabbcc');
            expect(core.setOutput).toHaveBeenCalledWith('message', '> Incomplete command `/gimme` - try one of `/gimme [pizza, nachos]`');
            expect(core.setOutput).toHaveBeenCalledWith('reaction', 'confused');
        });

        it('will ignore a valid command if it is not the beginning of the message', async () => {
            github.context = new github.context.constructor();
            github.context.payload = {
                comment: {
                    body: '/apple /order pizza'
                }
            };

            await action.main();
            expect(core.setOutput).toHaveBeenCalledWith('reaction', 'confused');
        });

        it('produces a configuration error if there is no commands array', async () => {
            action.getConfig.mockReturnValue({});
            github.context = new github.context.constructor();
            github.context.payload = {
                comment: {
                    body: '/order pizza'
                }
            };

            await action.main();

            expect(core.setOutput).toHaveBeenCalledWith('message', '> Configuration error: missing `commands` array');
            expect(core.setOutput).toHaveBeenCalledWith('reaction', 'confused');
        });

        it('produces a configuration error if a command is missing a name', async () => {
            action.getConfig.mockReturnValue({
                commands: [
                    {
                        result: 'abc'
                    }
                ]
            });
            github.context = new github.context.constructor();
            github.context.payload = {
                comment: {
                    body: '/order pizza'
                }
            };

            await action.main();

            expect(core.setOutput).toHaveBeenCalledWith('message', '> Configuration error: a command is missing the `name` property');
            expect(core.setOutput).toHaveBeenCalledWith('reaction', 'confused');
        });

        it('produces a configuration error if a command has no result or commands properties', async () => {
            action.getConfig.mockReturnValue({
                commands: [
                    {
                        name: 'order'
                    }
                ]
            });
            github.context = new github.context.constructor();
            github.context.payload = {
                comment: {
                    body: '/order pizza'
                }
            };

            await action.main();

            expect(core.setOutput).toHaveBeenCalledWith('message', '> Configuration error: `order` must contain either a `result` or `commands` property');
            expect(core.setOutput).toHaveBeenCalledWith('reaction', 'confused');
        });

        it('produces a configuration error if a command has both result and commands properties', async () => {
            action.getConfig.mockReturnValue({
                commands: [
                    {
                        name: 'order',
                        commands: [
                            {
                                name: 'pizza',
                                result: { order: 'pizza' },
                                commands: []
                            }
                        ]
                    }
                ]
            });
            github.context = new github.context.constructor();
            github.context.payload = {
                comment: {
                    body: '/random other command'
                }
            };

            await action.main();

            expect(core.setOutput).toHaveBeenCalledWith('message', '> Configuration error: `order pizza` must contain either a `result` or `commands` property, but not both');
            expect(core.setOutput).toHaveBeenCalledWith('reaction', 'confused');
        });

        it('returns correct aliases when parsing /package keyword', async () => {
            github.context = new github.context.constructor();
            github.context.payload = {
                comment: {
                    body: '/package osx linux tizen android'
                }
            };
            const expectedOutput = {platforms: "osx linux linuxcxx11 tizen-nacl_armv7 tizen-nacl_x86_32 tizen-nacl_x86_64_armv7 tizen-nacl_x86_32 tizen-nacl_x86_64 android"};
    
            jest.spyOn(action, 'succeed');
            await action.main();
    
            expect(action.getConfig).toHaveBeenCalledWith(expect.anything(), '.github/slash-commands.yaml', 'aabbcc');
            expect(action.succeed).toHaveReturnedWith(expectedOutput);
            expect(core.setOutput).toHaveBeenCalledWith('result', JSON.stringify({
                pipeline: [ 340 ]
            }));
            expect(core.setOutput).toHaveBeenCalledWith('reaction', 'rocket');
        });

        it('variable parsing for /rebuild ', async () => {
            github.context = new github.context.constructor();
            github.context.payload = {
                comment: {
                    body: '/rebuild everything -d YI_TEST=1 --preset test_preset'
                }
            };
            const expectedOutput = { generateArgs: '-d YI_TEST=1', presets: 'test_preset' };

            jest.spyOn(action, 'succeed');
            await action.main();

            expect(action.getConfig).toHaveBeenCalledWith(expect.anything(), '.github/slash-commands.yaml', 'aabbcc');
            expect(action.succeed).toHaveReturnedWith(expectedOutput);
            expect(core.setOutput).toHaveBeenCalledWith('result', JSON.stringify({
                pipeline: [ 339 ]
            }));
            expect(core.setOutput).toHaveBeenCalledWith('reaction', 'rocket');
        });

        it('variable parsing for /coverage ', async () => {
            github.context = new github.context.constructor();
            github.context.payload = {
                comment: {
                    body: '/coverage NaniteLibUnitTest youiengineUnitTest on-screen-keyboard-test'
                }
            };
            const expectedOutput = {"targets": "NaniteLibUnitTest youiengineUnitTest on-screen-keyboard-test"};

            jest.spyOn(action, 'succeed');
            await action.main();

            expect(action.getConfig).toHaveBeenCalledWith(expect.anything(), '.github/slash-commands.yaml', 'aabbcc');
            expect(action.succeed).toHaveReturnedWith(expectedOutput);
            expect(core.setOutput).toHaveBeenCalledWith('result', JSON.stringify({
                pipeline: [ 341 ]
            }));
            expect(core.setOutput).toHaveBeenCalledWith('reaction', 'rocket');
        });
    });

    describe('getConfig', () => {
        it('returns an object containing the YAML config data from current sha', async () => {
            process.env['GITHUB_REPOSITORY'] = 'AcmeCorp/RocketSled';
            github.context = new github.context.constructor();

            const mockOctokit = {
                repos: {
                    getContent: jest.fn().mockReturnValue({
                        data: {
                            content: 'value1: 3\nvalue2: 4',
                            encoding: 'utf8'
                        }
                    })
                }
            };

            const result = await action.getConfig(mockOctokit, 'path/to/config.yaml', 'aabbcc');

            expect(result).toEqual({ value1: 3, value2: 4 });

            expect(mockOctokit.repos.getContent).toHaveBeenCalledWith({
                owner: 'AcmeCorp',
                repo: 'RocketSled',
                ref: 'aabbcc',
                path: 'path/to/config.yaml'
            });
        });
     });
});
