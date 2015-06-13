var Role = require('./game').Role;
var Game = require('./game').Game;

// Game states
const AWAITING_PLAYERS = 'awaiting players';
const REQUEST_PHASE = 'request phase';
const ACTION_PHASE = 'action phase';
const DISCUSSION_PHASE = 'discussion phase';

// Game constants
const PHASE1TIME = 7000;
const PHASE2TIME = 10000;
const DISCUSSION_TIME = 300000;

// Client socket.io messages to server
const CHANGE_NAME = 'change name';
const JOIN_ROOM = 'join room';
const LEAVE_ROOM = 'leave room';
const TOGGLE_ROLE = 'toggle role';
const START_GAME = 'start game';
const MAKE_REQUEST = 'make request';

// Server socket.io messages to client
const PLAYER_INFO = 'player info';
const ALL_ROOMS = 'all rooms';
const ROOM_STATUS = 'room status';
const REQUEST = 'request';
const INFORM = 'inform';
const RESULTS = 'results';

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
        var playerNames = [];
        for (var i = 0; i < room.players.length; i++) {
            playerNames.push(room.players[i].name);
        }
        io.to(roomID).emit(ROOM_STATUS, {
            name: roomID,
            playerNames: playerNames,
            state: allRooms[roomID].state,
            roleCounts: allRooms[roomID].roleCounts,
        });
    }
}

function changeName(player, name) {
    player.name = name;
    broadcastRoomStatus(player.roomID);
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
        var card = {
            type: 'PLAYER',
            playerID: game.players[i].id,
        };

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
    var game = new Game(room.players, room.roleCounts);
    game.setRoles();
    room.state = REQUEST_PHASE;
    room.game = game;
    broadcastRoomStatus(roomID);

    game.requestPhase();
    performActions(game);

    setTimeout(function() {
        startActionPhase(roomID);
    }, PHASE1TIME);
}

function startActionPhase(roomID) {
    var room = allRooms[roomID];
    var game = room.game;
    room.state = ACTION_PHASE;
    broadcastRoomStatus(roomID);

    game.actionPhase(room.requests);
    performActions(game);

    setTimeout(function() {
        startDiscussionPhase(roomID);
    }, PHASE2TIME);
}

function startDiscussionPhase(roomID) {
    var room = allRooms[roomID];
    var game = room.game;
    room.state = DISCUSSION_PHASE;
    broadcastRoomStatus(roomID);

    game.discussionPhase();
    performActions(game);

    setTimeout(function() {
        setEndPhase(roomID);
    }, DISCUSSION_TIME);
}

function setEndPhase(roomID) {
    var room = allRooms[roomID];
    room.state = AWAITING_PLAYERS;

    var results = game.getResults();
    io.to(roomID).emit(RESULTS, results);

    broadcastRoomStatus(roomID);
}

function makeRequest(player, request) {
    var card = {
        type: 'PLAYER',
        playerID: player.id,
    };
    allRooms[player.roomID].requests[card] = request;
}

exports.setServer = function(server) {
    io = require('socket.io').listen(server);

    io.sockets.on('connection', function(socket) {
        var thisPlayer = {
            name: ('Guest ' + socket.id).substring(0, 12),
            socket: socket,
        };
        socket.emit(PLAYER_INFO, thisPlayer.name);
        socket.emit(ALL_ROOMS, getAllRooms());
        socket.emit(ROOM_STATUS, false);
        socket.on(CHANGE_NAME, function(name) {
            changeName(thisPlayer, name);
            socket.emit(PLAYER_INFO, thisPlayer);
        });
        socket.on(JOIN_ROOM, function(roomID) {
            joinRoom(thisPlayer, roomID);
        });
        socket.on(LEAVE_ROOM, function(data) {
            leaveRoom(thisPlayer);
        });
        socket.on(TOGGLE_ROLE, function(role) {
            toggleRole(thisPlayer.roomID, role);
        });
        socket.on(START_GAME, function(data) {
            startGame(thisPlayer.roomID);
        });
        socket.on(MAKE_REQUEST, function(data) {
            makeRequest(thisPlayer, data);
        });
        socket.on('disconnect', function() {
            leaveRoom(thisPlayer);
        });
        socket.on('error', function(err) {
            console.error(err);
        });
    });
}

