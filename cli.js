/* eslint-disable no-restricted-globals */
const lib = require('./lib.js');

const argv = require('yargs/yargs')(process.argv.slice(2))
  .option('token', { description: 'token', type: 'string' })
  .option('owner', { description: 'owner', type: 'string' })
  .option('repo', { description: 'repo', type: 'string' })
  .option('pullRequestNumber', { description: 'pullRequestNumber', type: 'number' })
  .help().argv;

//const owner = 'kungfu-trader';
//const repo = 'action-merge-close-issue';
//const pullRequestNumber = 6;
//const token = core.getInput('token');
//const token = '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';
lib.closeIssue(argv).catch(console.error);
