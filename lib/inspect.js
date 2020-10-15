
const { EventEmitter } = require('events');
const spawn = require('cross-spawn');
const { execSync } = require('child_process');
const net = require('net');
const fs = require('fs-extra');
const path = require('path');
const inquirer = require('inquirer');

const Client = require('./client');

const debug = require('debug')('inspect');

class StartupError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StartupError';
  }
}

async function portIsFree(host, port, timeout = 20000) {
  if (port === 0) return Promise.resolve(); // Binding to a random port.

  const retryDelay = 150;
  let didTimeOut = false;

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      didTimeOut = true;
      reject(new StartupError(
        `Timeout (${timeout}) waiting for ${host}:${port} to be free`));
    }, timeout);

    function pingPort() {
      if (didTimeOut) return;

      const socket = net.connect(port, host);
      let didRetry = false;
      function retry() {
        if (!didRetry && !didTimeOut) {
          didRetry = true;
          setTimeout(pingPort, retryDelay);
        }
      }

      socket.on('error', (error) => {
        if (error.code === 'ECONNREFUSED') {
          resolve();
        } else {
          retry();
        }
      });
      socket.on('connect', () => {
        socket.destroy();
        retry();
      });
    }
    pingPort();
  });
}

class NodeInspector {
  constructor(options, stdin, stdout) {

    this.options = options;
    this.stdin = stdin;
    this.stdout = stdout;

    this.paused = true;
    this.child = null;

    this.client = new Client();

    // Handle all possible exits
    process.on('exit', () => this.killChild());
    process.once('SIGTERM', process.exit.bind(process, 0));
    process.once('SIGHUP', process.exit.bind(process, 0));

    this.run().catch((error) => process.nextTick(() => { throw error; }));
  }

  async parseNpm(scriptArgs){
    let env = Object.assign({}, process.env);
    delete env.NODE_OPTIONS;
    
    let NPM_CLI_JS = execSync('npm prefix -g', { env }).toString().trim();
    let NPM_PREFIX_NPM_CLI_JS = path.join(NPM_CLI_JS, 'node_modules/npm/bin/npm-cli.js');
    
    debug("NPM_PREFIX_NPM_CLI_JS", NPM_PREFIX_NPM_CLI_JS);

    if( fs.existsSync(NPM_PREFIX_NPM_CLI_JS) ){
      scriptArgs.unshift(NPM_PREFIX_NPM_CLI_JS);
      return process.execPath;
    }

    return 'npm';
  }

  async runScript(){

    const {script, scriptArgs, host, port} = this.options;

    await portIsFree(host, port);

    let cmd = script;
    try{
      let scriptPath = require.resolve(path.resolve(script));
      scriptArgs.unshift(scriptPath);
      cmd = process.execPath;
    }catch(e){
      if(script == 'npm'){
        cmd = await this.parseNpm(scriptArgs);
      }
    }

    return await this.spawn(cmd, scriptArgs);
  }

  async spawn(cmd, scriptArgs){

    const {host, port} = this.options;

    const childPrint = this.childPrint.bind(this);

    return new Promise((resolve, reject) => {
      debug(`\n> ${cmd} ${scriptArgs.join(' ')}`);
      
      const child = spawn(cmd, scriptArgs, {
        env: Object.assign({}, process.env, {
          NODE_OPTIONS: `--inspect-brk=${host}:${port}`,
        })
      });

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', childPrint);
      child.stderr.on('data', childPrint);

      let output = '';
      function waitForListenHint(text) {
        output += text;
        if (/Debugger listening on ws:\/\/\[?(.+?)\]?:(\d+)\//.test(output)) {
          const sHost = RegExp.$1;
          const sPort = Number.parseInt(RegExp.$2);
          child.stderr.removeListener('data', waitForListenHint);
          resolve([child, sPort, sHost]);
        }
      }

      child.stderr.on('data', waitForListenHint);

      child.on('error', reject);
      
    });
  }

  killChild() {
    if (this.child) {
      this.child.kill();
      this.child = null;
    }
  }

  async run() {

    this.killChild();

    let [child, port, host] = await this.runScript();

    this.child = child;

    this.print(`connecting to ${host}:${port} ..`, true);

    try{
      const url = await this.client.connect(port, host)
      debug('connection established');
      this.stdout.write(`\n\n在chrome中打开以下链接进行调试\n\n ${url} \n\n`);
    }catch(err){
      this.stdout.write('\nconnect failed ' + error);
      // If it's failed to connect 10 times then print failed message
      this.stdout.write('连接失败，请重试\n');
      process.exit(1);
    }
  }

  clearLine() {
    if (this.stdout.isTTY) {
      this.stdout.cursorTo(0);
      this.stdout.clearLine(1);
    } else {
      this.stdout.write('\b');
    }
  }

  print(text, oneline = false) {
    this.clearLine();
    this.stdout.write(oneline ? text : `${text}\n`);
  }

  childPrint(text) {
    this.print(
      text.toString()
        .split(/\r\n|\r|\n/g)
        .filter((chunk) => !!chunk)
        .map((chunk) => `< ${chunk}`)
        .join('\n')
    );
    if (/Waiting for the debugger to disconnect\.\.\.\n$/.test(text)) {
      this.killChild();
    }
  }
}

function startInspect(options) {

  let stdin = process.stdin;
  let stdout = process.stdout;
  
  const inspector = new NodeInspector(options, stdin, stdout);

  stdin.resume();

  function handleUnexpectedError(e) {
    if (!(e instanceof StartupError)) {
      console.error('There was an internal error in node-inspect. ' +
                    'Please report this bug.');
      console.error(e.message);
      console.error(e.stack);
    } else {
      console.error(e.message);
    }
    if (inspector.child) inspector.child.kill();
    process.exit(1);
  }

  process.on('uncaughtException', handleUnexpectedError);
}

exports.start = startInspect;
