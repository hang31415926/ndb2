#!/usr/bin/env node

const program = require('commander')

program.version(require('./package.json').version);

program
  .arguments('<script> [scriptArgs...]')
  .option('-h, --host <host>', 'host', '127.0.0.1')
  .option('-p, --port <port>', 'port', 9229)
  .action((...args) => {
    console.log(args);
  });

program.parse(process.argv)

if (!process.argv.slice(2).length) {
  program.outputHelp()
}