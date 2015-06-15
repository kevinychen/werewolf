var Role = require('./game').Role;
var Game = require('./game').Game;

// Game states
const AWAITING_PLAYERS = 'awaiting players';
const REQUEST_PHASE = 'request phase';
const ACTION_PHASE = 'action phase';
const DISCUSSION_PHASE = 'discussion phase';
const END_PHASE = 'end phase';

// Game constants
const PHASE1TIME = 10000;
const PHASE2TIME = 10000;
const DISCUSSION_TIME = 300000;

// Client socket.io messages to server
const CHANGE_NAME = 'change name';
const JOIN_ROOM = 'join room';
const LEAVE_ROOM = 'leave room';
const TOGGLE_ROLE = 'toggle role';
const START_GAME = 'start game';
const TOGGLE_REQUEST = 'toggle request';
const NEXT_ROUND = 'next round';
const SEND_CHAT = 'send chat';

// Server socket.io messages to client
const PLAYER_INFO = 'player info';
const ALL_ROOMS = 'all rooms';
const ROOM_STATUS = 'room status';
const REQUEST_STATUS = 'request status';
const REQUEST = 'request';
const INFORM = 'inform';
const RESULTS = 'results';
const RECEIVE_CHAT = 'receive chat';

var allRooms = {};

function getAllRooms() {
    var rooms = [];
    for (var roomID in allRooms) {
        rooms.push(roomID);
    }
    return rooms;
}

function broadcastRoomStatus(roomID) {
    if (roomID) {
        var room = allRooms[roomID];
        var players = room.state === AWAITING_PLAYERS ?
            room.players : room.game.players;
        var outputPlayers = [];
        for (var i = 0; i < players.length; i++) {
            outputPlayers.push({
                playerID: players[i].playerID,
                name: players[i].name,
            });
        }
        io.to(roomID).emit(ROOM_STATUS, {
            name: roomID,
            players: outputPlayers,
            state: allRooms[roomID].state,
            roleCounts: allRooms[roomID].roleCounts,
            time: allRooms[roomID].time,
        });
        room.requests = {};
        io.to(roomID).emit(REQUEST_STATUS, []);
    }
}

function changeName(player, name) {
    player.name = name;
    broadcastRoomStatus(player.roomID);

    player.socket.emit(PLAYER_INFO, {
        playerID: player.playerID,
        name: player.name,
    });
}

function createRoom(roomID) {
    allRooms[roomID] = {
        players: [],
        state: AWAITING_PLAYERS,
        roleCounts: {},
    };
    io.sockets.emit(ALL_ROOMS, getAllRooms());
}

function joinRoom(player, roomID) {
    leaveRoom(player);

    player.roomID = roomID;
    player.socket.join(roomID);

    if (!allRooms[roomID]) {
        createRoom(roomID);
    }
    if (allRooms[roomID].state === AWAITING_PLAYERS) {
        allRooms[roomID].players.push(player);
    }
    broadcastRoomStatus(roomID);
}

function leaveRoom(player) {
    var roomID = player.roomID;
    if (roomID) {
        var index = allRooms[roomID].players.indexOf(player);
        allRooms[roomID].players.splice(index, 1);
        player.socket.leave(roomID);
        broadcastRoomStatus(roomID);
        player.roomID = undefined;
        player.socket.emit(ROOM_STATUS, false);
    }
}

function toggleRole(roomID, role) {
    var roleCounts = allRooms[roomID].roleCounts;
    var current = roleCounts[role] || 0;
    if (role === Role.WEREWOLF) {
        // 0, 1, 2, 3, 4
        roleCounts[role] = (current + 1) % 5;
    } else if (role === Role.VILLAGER) {
        // 0, 1, 2
        roleCounts[role] = (current + 1) % 3;
    } else if (role === Role.MASON) {
        // 0, 2, 3
        roleCounts[role] = (current - (current > 0) + 2) % 4;
    } else {
        roleCounts[role] = 1 - current;
    }
    broadcastRoomStatus(roomID);
}

function performActions(game) {
    for (var i = 0; i < game.players.length; i++) {
        var card = 'PLAYER ' + game.players[i].playerID;

        var inform = game.inform[card];
        if (inform) {
            game.players[i].socket.emit(INFORM, inform);
        }

        var request = game.requests[card];
        if (request) {
            game.players[i].socket.emit(REQUEST, request);
        }
    }
}

function startGame(roomID) {
    var room = allRooms[roomID];
    if (room.state !== AWAITING_PLAYERS) {
        return;
    }
    var game = new Game(room.players, room.roleCounts);
    game.setRoles();
    room.state = REQUEST_PHASE;
    room.game = game;
    room.time = PHASE1TIME;
    broadcastRoomStatus(roomID);

    game.requestPhase();
    performActions(game);

    setTimeout(function() {
        startActionPhase(roomID);
    }, PHASE1TIME);
}

function startActionPhase(roomID) {
    var room = allRooms[roomID];
    if (room.state !== REQUEST_PHASE) {
        return;
    }
    var game = room.game;
    var requests = room.requests;
    room.state = ACTION_PHASE;
    room.time = PHASE2TIME;
    broadcastRoomStatus(roomID);

    game.actionPhase(requests);
    performActions(game);

    setTimeout(function() {
        startDiscussionPhase(roomID);
    }, PHASE2TIME);
}

function startDiscussionPhase(roomID) {
    var room = allRooms[roomID];
    if (room.state !== ACTION_PHASE) {
        return;
    }
    var game = room.game;
    room.state = DISCUSSION_PHASE;
    room.time = DISCUSSION_TIME;
    broadcastRoomStatus(roomID);

    game.discussionPhase();
    performActions(game);

    setTimeout(function() {
        setEndPhase(roomID);
    }, DISCUSSION_TIME);
}

function setEndPhase(roomID) {
    var room = allRooms[roomID];
    var requests = room.requests;
    if (room.state !== DISCUSSION_PHASE) {
        return;
    }
    room.state = END_PHASE;
    room.time = 0;
    broadcastRoomStatus(roomID);

    var results = room.game.getResults(requests);
    io.to(roomID).emit(RESULTS, results);
}

function nextRound(roomID) {
    var room = allRooms[roomID];
    room.state = AWAITING_PLAYERS;
    broadcastRoomStatus(roomID);
}

function toggleRequest(player, card) {
    var requests = allRooms[player.roomID].requests;
    var playerCard = 'PLAYER ' + player.playerID;
    if (!requests[playerCard]) {
        requests[playerCard] = [];
    }
    var index = requests[playerCard].indexOf(card);
    if (index === -1) {
        requests[playerCard].push(card);
    } else {
        requests[playerCard].splice(index, 1);
    }
    player.socket.emit(REQUEST_STATUS, requests[playerCard]);
}

function broadcastChat(roomID, player, message) {
    io.to(roomID).emit(RECEIVE_CHAT, {
        name: player.name,
        message: message,
    });
}

exports.setServer = function(server) {
    io = require('socket.io').listen(server);

    io.sockets.on('connection', function(socket) {
        var thisPlayer = {
            playerID: socket.id,
            socket: socket,
        };
        changeName(thisPlayer, ('Guest ' + socket.id).substring(0, 12));
        socket.emit(ALL_ROOMS, getAllRooms());
        socket.emit(ROOM_STATUS, false);
        socket.on(CHANGE_NAME, function(name) {
            changeName(thisPlayer, name);
        });
        socket.on(JOIN_ROOM, function(roomID) {
            joinRoom(thisPlayer, roomID);
        });
        socket.on(LEAVE_ROOM, function() {
            leaveRoom(thisPlayer);
        });
        socket.on(TOGGLE_ROLE, function(role) {
            toggleRole(thisPlayer.roomID, role);
        });
        socket.on(START_GAME, function() {
            startGame(thisPlayer.roomID);
        });
        socket.on(TOGGLE_REQUEST, function(card) {
            toggleRequest(thisPlayer, card);
        });
        socket.on(NEXT_ROUND, function() {
            nextRound(thisPlayer.roomID);
        });
        socket.on(SEND_CHAT, function(message) {
            broadcastChat(thisPlayer.roomID, thisPlayer, message);
        });
        socket.on('disconnect', function() {
            leaveRoom(thisPlayer);
        });
        socket.on('error', function(err) {
            console.error(err);
        });
    });
}

