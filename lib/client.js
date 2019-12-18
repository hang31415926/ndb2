
const Buffer = require('buffer').Buffer;
const { EventEmitter } = require('events');
const http = require('http');
const { URL } = require('url');
const open = require('open');

class Client extends EventEmitter {

  constructor() {
    super();
    this._port = undefined;
    this._host = undefined;
  }

  _fetchJSON(urlPath) {
    return new Promise((resolve, reject) => {
      const httpReq = http.get({
        host: this._host,
        port: this._port,
        path: urlPath,
      });

      const chunks = [];

      function onResponse(httpRes) {
        function parseChunks() {
          const resBody = Buffer.concat(chunks).toString();
          if (httpRes.statusCode !== 200) {
            reject(new Error(`Unexpected ${httpRes.statusCode}: ${resBody}`));
            return;
          }
          try {
            resolve(JSON.parse(resBody));
          } catch (parseError) {
            reject(new Error(`Response didn't contain JSON: ${resBody}`));
            return;
          }
        }

        httpRes.on('error', reject);
        httpRes.on('data', (chunk) => chunks.push(chunk));
        httpRes.on('end', parseChunks);
      }

      httpReq.on('error', reject);
      httpReq.on('response', onResponse);
    });
  }

  connect(port, host) {
    this._port = port;
    this._host = host;
    return this._discoverWebsocketData()
      .then((data) => this._connectWebsocket(data));
  }

  _discoverWebsocketData() {
    return this._fetchJSON('/json')
      .then(([data]) => data);
  }

  _connectWebsocket(data) {

    // The replace is for older versions. For newer versions, it is a no-op.
    const devtoolsFrontendUrl = data.devtoolsFrontendUrl.replace(
      /^https:\/\/chrome-devtools-frontend\.appspot\.com/i,
      'chrome-devtools://devtools/remote'
    );

    const url = new URL(devtoolsFrontendUrl);
    const wsUrl = new URL(data.webSocketDebuggerUrl);

    // Update the WebSocket URL with the host and port options. Then, update
    // the DevTools URL with the new WebSocket URL. Also strip the protocol.
    wsUrl.hostname = this.host;
    wsUrl.port = this.port;
    url.searchParams.set('ws', wsUrl.toString().replace('ws://', ''));

    console.log('_connectWebsocket', url.toString());
    
    return open(url.toString(), {app: ['chrome']});
  }
}

module.exports = Client;
