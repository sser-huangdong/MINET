var express = require('express'),
  app = express(),
  server = require('http').createServer(app),
  io = require('socket.io').listen(server),
  ipaddr  = process.env.OPENSHIFT_INTERNAL_IP || "127.0.0.1",
  port = process.env.OPENSHIFT_INTERNAL_PORT || 8080,
  socketsID = new Object(),
  allUsers = new Array(),
  chatClients = new Object(); // hash object to save clients data { socketid: { clientid, nickname }, socketid: { ... } }

server.listen(port， ipaddr);

app.use("/styles", express.static(__dirname + '/public/styles'));
app.use("/scripts", express.static(__dirname + '/public/scripts'));
app.use("/images", express.static(__dirname + '/public/images'));

app.get('/', function (req, res) {
  res.sendfile(__dirname + '/public/index.html');
});

io.set('log level', 2);

io.set('transports', [ 'websocket', 'xhr-polling' ]);

/*
 * connect => connect
 * chatmessage => chatMessage
 * p2p => createP2P
 * subscribe => subscribe
 * unsubscribe => unsubscribe
 */
io.sockets.on('connection', function(socket) {
  socket.on('connect', function(data) {
    connect(socket, data);
  });
  socket.on('sendMessage', function(data) {
    sendMessage(socket, data);
  });
  socket.on('p2p', function(data) {
    createP2P(socket, data);
  });
  socket.on('subscribe', function(data) {
    subscribe(socket, data);
  });
  socket.on('unsubscribe', function(data) {
    unsubscribe(socket, data);
  });
  socket.on('channelChange', function(data) {
    changeChannel(socket, data);
  });
  socket.on('disconnect', function() {
    disconnect(socket);
  });
});

function createP2P(socket, data) {
  socket.join(data.channel);
  for (var chatclient in chatClients) {
    if (chatclient && chatClients[chatclient] && chatClients[chatclient].nickname == data.to) {
      socketsID[chatclient].join(data.channel);
      socketsID[chatclient].emit('P2PClients',
                                 {
                                   username: data.from,
                                   channel: data.channel,
                                   clients: getClientsInChannel(chatclient, data.channel)
                                 });
      break;
    }
  }
  socket.emit('P2PClients',
              {
                username: data.to,
                channel: data.channel,
                clients: getClientsInChannel(socket.id, data.channel)
              });
}

function unsubscribe(socket, data) {
  updatePresence(data.channel, socket, 'offline');
  socket.leave(data.channel);
  if(data.channel != 'public') {
    io.sockets.emit('removeP2P', { channel: data.channel });
  }
}

function changeChannel(socket, data) {
  socket.leave(data.channel);
}

function subscribe(socket, data) {
  socket.join(data.channel);
  socket.emit('channelClients', { username: data.username, channel: data.channel, clients: getClientsInChannel(socket.id, data.channel)});
}

function connect(socket, data) {
  data.clientId = generateId();
  chatClients[socket.id] = data;
  socketsID[socket.id] = socket;
  allUsers.push(data);
  socket.emit('ready', { clientId: data.clientId });
  enterPublicChannel(socket, { channel: 'public' });
  socket.emit('enterPublicChannel');
}

function enterPublicChannel(socket, data) {
  socket.join(data.channel);
  updatePresence(data.channel, socket, 'online');
  socket.emit('channelClients', {username: 'public', channel: 'public', clients: getClientsInChannel(socket.id, data.channel)});
}

function disconnect(socket) {
  var channels = io.sockets.manager.roomClients[socket.id];
  for (var channel in channels) {
    if (channel && channels[channel]) {
      unsubscribe(socket, { channel: channel.replace('/','') });
    }
  }
  var indexOf = allUsers.indexOf(chatClients[socket.id]);
  allUsers.splice(indexOf, 1);
  delete chatClients[socket.id];
  delete socketsID[socket.id];
}

function sendMessage(socket, data) {
  socket.broadcast.to(data.channel).emit('sendMessage',
                                      { client: chatClients[socket.id],
                                        message: data.message,
                                        channel: data.channel
                                      });
}

function getChannels() {
  return Object.keys(io.sockets.manager.rooms);
}

function getClientsInChannel(socketId, channel) {
  var socketIds = io.sockets.manager.rooms['/' + channel];
  var clients = [];

  if (channel == 'public') {
    for (var i = 0, len = allUsers.length; i < len; ++i) {
      if (allUsers[i] != chatClients[socketId]) {
        clients.push(allUsers[i]);
      }
    }
  } else {
    if (socketIds && socketIds.length > 0) {
      // socketsCount = socketIds.length;
      for (var i = 0, len = socketIds.length; i < len; i++) {
        if (socketIds[i] != socketId) {
	  clients.push(chatClients[socketIds[i]]);
        }
      }
    }
  }
  return clients;
}

// updating all other clients when a client goes
// online or offline. 
function updatePresence(channel, socket, state) {
  channel = channel.replace('/','');
  socket.broadcast.to(channel).emit('presence', { client: chatClients[socket.id], state: state, channel: channel });
}

function generateId() {
  var S4 = function () {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
  };
  return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
}

console.log('Chat server is running and listening to port %d...', port);
