var express = require('express'),
  app = express(),
  server = require('http').createServer(app),
  io = require('socket.io').listen(server),
  port = 8080,
  socketsID = new Object(),
  allUsers = new Array(),
  chatClients = new Object(); // hash object to save clients data { socketid: { clientid, nickname }, socketid: { ... } }

server.listen(port);

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
  socket.on('disconnect', function() {
    disconnect(socket);
  });
});

function createP2P(socket, data) {
  socket.join(data.room);
  for (var chatclient in chatClients) {
    if (chatclient && chatClients[chatclient] && chatClients[chatclient].nickname == data.to) {
      socketsID[chatclient].join(data.room);
      // updatePresence(data.room, socketsID[chatclient], 'online');
      socketsID[chatclient].emit('roomclients',
                                 {
                                   username: data.from,
                                   room: data.room,
                                   clients: getClientsInRoom(chatclient, data.room)
                                 });
      break;
    }
  }
  // updatePresence(data.room, socket, 'online');
  socket.emit('roomclients',
              {
                username: data.to,
                room: data.room,
                clients: getClientsInRoom(socket.id, data.room)
              });
}

// np
function unsubscribe(socket, data) {
  socket.leave(data.room);
}

function subscribe(socket, data) {
  socket.join(data.room);
  socket.emit('roomclients', { username: data.username, room: data.room, clients: getClientsInRoom(socket.id, data.room)});
}

function connect(socket, data) {
  data.clientId = generateId();
  chatClients[socket.id] = data;
  socketsID[socket.id] = socket;
  allUsers.push(data);
  socket.emit('ready', { clientId: data.clientId });
  enterPublicChannel(socket, { room: 'public' });
  socket.emit('enterPublicChannel');
}

function enterPublicChannel(socket, data) {
  socket.join(data.room);
  updatePresence(data.room, socket, 'online');
  socket.emit('roomclients', {username: 'public', room: 'public', clients: getClientsInRoom(socket.id, data.room)});
}

function disconnect(socket) {
  var rooms = io.sockets.manager.roomClients[socket.id];
  for (var room in rooms) {
    if (room && rooms[room]) {
      unsubscribe(socket, { room: room.replace('/','') });
    }
  }
  delete chatClients[socket.id];
}

function sendMessage(socket, data) {
  socket.broadcast.to(data.room).emit('sendMessage',
                                      { client: chatClients[socket.id],
                                        message: data.message,
                                        room: data.room
                                      });
}

function getRooms() {
  return Object.keys(io.sockets.manager.rooms);
}

// get array of clients in a room
function getClientsInRoom(socketId, room) {
  var socketIds = io.sockets.manager.rooms['/' + room];
  var clients = [];

  if (room == 'public') {
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

// get the amount of clients in aroom
function countClientsInRoom(room) {
  // 'io.sockets.manager.rooms' is an object that holds
  // the active room names as a key and an array of
  // all subscribed client socket ids
  if (io.sockets.manager.rooms['/' + room]) {
    return io.sockets.manager.rooms['/' + room].length;
  }
  return 0;
}

// updating all other clients when a client goes
// online or offline. 
function updatePresence(room, socket, state) {
  room = room.replace('/','');

  // by using 'socket.broadcast' we can send/emit
  // a message/event to all other clients except
  // the sender himself
  socket.broadcast.to(room).emit('presence', { client: chatClients[socket.id], state: state, room: room });
}

function generateId() {
  var S4 = function () {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
  };
  return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
}

console.log('Chat server is running and listening to port %d...', port);