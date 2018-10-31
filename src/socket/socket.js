const http = require('http');
const url = require('url');
const WebsocketServer = new require('ws').Server;

const handleUpgrade = (request, socket, header, wsServer) => {
  wsServer.handleUpgrade(request, socket, header.copy(new Buffer(header.length)), (ws) => {
    wsServer.emit('connection', ws, request);
  });
};

// 创建websocket
const websocketServer = new WebsocketServer({
  noServer: true,
  clientTracking: false,
});

websocketServer.on('connection', (ws) => {
  console.log('server: receive connection.');
  ws.on('message', (message) => {
    console.log('server: received: %s', message);
  });
  ws.send('hello world');
});

// 创建普通httpserver
const server = http.createServer((req, res) => {
  res.writeHead(501);
  res.end('Not Implemented');
});

server.listen(8999, () => {
  console.log('server started');
});

server.on('request', (req, res) => {
  // ...
});

server.on('upgrade', (req, socket, head) => {
  const pathname = url.parse(req.url).pathname;
  console.log('pathname', pathname);
  handleUpgrade(req, socket, head, websocketServer);
});




// const engine = require('engine.io');
// const server = engine.listen(8999, {}, () => {
//   console.log('socket started');
// });
// 
// 

// console.log(server.listeners('request').slice(0));

 
// server.on('connection', function(socket){
//   socket.send('hi');
// });
 
// // …
// server.on('handshake', function(req, socket, head){
//   console.log('11111');
//   // server.handleUpgrade(req, socket, head);
// });
// server.on('request', function(req, res){
//   console.log('ddd');
//   server.handleRequest(req, res);
// });








