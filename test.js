const spawn = require('cross-spawn');
const { execSync } = require('child_process');
// const child = spawn('node', ["C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js", '-v'], {
//   env: Object.assign({}, process.env, {
//     NODE_OPTIONS: `--inspect-brk=127.0.0.1:9229`,
//   }),
//   stdio: 'inherit'
// });

let NPM_CLI_JS = execSync('npm prefix -g');
console.log(NPM_CLI_JS.toString());