#!/usr/bin/env node


const program = require('commander')

program.version(require('../package').version)

let argv = process.argv.slice(2);

program
  .option('-p, --port <port>', 'port', 9229)
  .option('-h, --host <host>', 'host', '127.0.0.1')
  .option('-s, --script', '运行 npm run 指向的命令，跳过 npm 代码调试')
  .parse(process.argv)

if (!process.argv.slice(2).length) {
  program.outputHelp()
}

program.helpInformation = 



if (argv.length < 1) {
  help();
}

const options = parseArgv(argv);

require('../lib/inspect.js').start(options);

function help(code = 1){
	console.error(`Usage: ndb script.js`);
  console.error(`       ndb <host>:<port> script.js`);
  process.exit(code);
}

function version(code = 0){
	console.log(require('../package.json').version);
  process.exit(code);
}

function parseArgv([target, ...args]) {

  let host = '127.0.0.1';
  let port = 9229;

  let script = target;
  let scriptArgs = args;

  const hostMatch = target.match(/^([^:]+):(\d+)$/);

  if (hostMatch) {
  	if(args.length < 1){
  		help();
  	}
    host = hostMatch[1];
    port = parseInt(hostMatch[2], 10);
    script = args.shift();
  }else if(target == '-h' || target == '--help'){
  	help(0);
  }else if(target == '-v' || target == '--version'){
  	version();
  }
  
  return { host, port, script, scriptArgs };
}