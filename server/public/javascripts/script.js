var socket = io.connect('http://localhost:8405');

const Roles = [
        "werewolf", "villager", "mason", "seer",
        "robber", "troublemaker", "tanner", "minion",
        ];
var me = {};
var allRooms = [];
var currentRoomStatus = {};

socket.on('player info', function(player) {
    me = player;
    $('#username').text(player.name);
    $('#changedname').val(player.name);
});

socket.on('all rooms', function(rooms) {
    $('#roomlist').empty();
    for (var i = 0; i < rooms.length; i++) {
        allRooms.push(rooms[i]);
        var joinLink = $('<li>').addClass('link').append(
            $('<span>').text('Join ' + rooms[i]));
        (function(room) {
            joinLink.on('click', function(data) {
                socket.emit('join room', room);
            });
        })(rooms[i]);
        $('#roomlist').append(joinLink);
    }
});

socket.on('room status', function(roomStatus) {
    if (roomStatus) {
        $('#main').show();
        $('#roomname').text(roomStatus.name);
        $('#roleselect').hide();
        $('#playercircle').hide();

        var numPlayers = roomStatus.players.length;
        var numRolesSelected = 0;
        var myIndex = -1;
        var cardsMap = {};
        var cardsMapInv = {};
        for (var role in roomStatus.roleCounts) {
            numRolesSelected += roomStatus.roleCounts[role];
        }
        for (var i = 0; i < numPlayers; i++) {
            if (roomStatus.players[i].playerID === me.playerID) {
                myIndex = i;
            }
        }
        for (var i = 0; i < numPlayers; i++) {
            var card = 'PLAYER ' +
                roomStatus.players[(myIndex + i) % numPlayers].playerID;
            cardsMap[card] = '#pr' + i;
            cardsMapInv['#pr' + i] = card;
        }
        for (var i = 0; i < 3; i++) {
            var card = 'CENTER ' + i;
            cardsMap[card] = '#prc' + i;
            cardsMapInv['#prc' + i] = card;
        }
        roomStatus.numPlayers = numPlayers;
        roomStatus.numRolesSelected = numRolesSelected;
        roomStatus.cardsMap = cardsMap;
        roomStatus.cardsMapInv = cardsMapInv;
    } else {
        $('#main').hide();
    }
    currentRoomStatus = roomStatus;
    setRequest({});
    refreshRoomStatus();
});

socket.on('request status', function(selectedCards) {
    $('#playercircle').find('span').removeClass('rolechosen');
    for (var i = 0; i < selectedCards.length; i++) {
        var selector = $(currentRoomStatus.cardsMap[selectedCards[i]]);
        selector.addClass('rolechosen');
    }
});

function refreshRoomStatus() {
    if (!currentRoomStatus) {
        return;
    }
    if (currentRoomStatus.state === 'awaiting players') {

        $('#gamenotification').text(
            'Choose ' + (currentRoomStatus.numPlayers + 3) +
            ' roles. ' + currentRoomStatus.numRolesSelected +
            ' roles selected.');

        for (var i = 0; i < Roles.length; i++) {
            var count = currentRoomStatus.roleCounts[Roles[i]] || 0;
            var selector = $('#rs' + i);
            if (count > 0) {
                selector.addClass('rolechosen');
                selector.find('.freq').text(count);
                selector.find('.freq').show();
            } else {
                selector.removeClass('rolechosen');
                selector.find('.freq').hide();
            }
        }

        var playerNames = [];
        for (var i = 0; i < currentRoomStatus.numPlayers; i++) {
            playerNames.push(currentRoomStatus.players[i].name);
        }
        $('#currentplayers').text(
            currentRoomStatus.numPlayers + ' current players: '
            + playerNames.join(', '));
        $('#gamecontrol').show();
        $('#gamecontrol').text('START GAME');
        $('#roleselect').show();
    } else {
        for (var i = 0; i < 12; i++) {
            var selector = $('#pr' + i);
            if (i < currentRoomStatus.numPlayers) {
                selector.show();
            } else {
                selector.hide();
            }
        }

        $('#gamecontrol').hide();
        $('#playercircle').show();
    }
};

socket.on('inform', function(info) {
    for (var i = 0; i < info.length; i++) {
        var selector = $(currentRoomStatus.cardsMap[info[i].card]);
        selector.find('img').attr('src',
            '/images/' + info[i].role + '.jpg');
        if (info[i].temporary) {
            (function(img) {
                setTimeout(function() {
                    img.attr('src', '/images/back.jpg');
                }, 10000);
            })(selector.find('img'));
        }
    }
});

socket.on('request', function(request) {
    setRequest(request);
});

function setRequest(request) {
    if (request.playerCards || request.centerCards) {
        $('#gamenotification').text(
            'Choose ' + request.playerCards + ' players' +
            (request.centerCards ? ' or ' + request.centerCards + ' center cards' : '') + '.');
    } else {
        $('#gamenotification').text('Nighttime');
    }
    currentRoomStatus.request = request;
}

$(document).ready(function() {
    $('#username').on('click', function() {
        $('#changenamepopup').show();
        $('#content').css('opacity', '0.5');
        $('#changedname').select();
    });

    $('#changename').on('click', function() {
        socket.emit('change name', $('#changedname').val());
        $('#changenamepopup').hide();
        $('#content').css('opacity', '1');
    });

    $('#closename').on('click', function() {
        $('#changenamepopup').hide();
        $('#content').css('opacity', '1');
    });

    $('#roomcreate').on('click', function() {
        $('#createroompopup').show();
        $('#content').css('opacity', '0.5');
        $('#createroomname').select();
    });

    $('#createroom').on('click', function() {
        socket.emit('join room', $('#createroomname').val());
        $('#createroompopup').hide();
        $('#content').css('opacity', '1');
    });

    $('#closecreate').on('click', function() {
        $('#createroompopup').hide();
        $('#content').css('opacity', '1');
    });

    $('#roomleave').on('click', function() {
        socket.emit('leave room', false);
    });

    $('#gamecontrol').on('click', function() {
        if (currentRoomStatus.state === 'awaiting players') {
            // New game
            if (currentRoomStatus.numRolesSelected === currentRoomStatus.numPlayers + 3) {
                socket.emit('start game', true);
            }
        }
    });

    for (var i = 0; i < Roles.length; i++) {
        var selector = $('#rs' + i);
        selector.append($('<img>').attr('src',
                    '/images/' + Roles[i] + '.jpg'));
        selector.append($('<span>').addClass('freq'));
        (function(index) {
            selector.on('click', function() {
                socket.emit('toggle role', Roles[index]);
            });
        })(i);
    }

    for (var i = 0; i < 12; i++) {
        var selector = $('#pr' + i);
        selector.append($('<img>').attr('src',
                    '/images/back.jpg'));
        (function(index) {
            selector.on('click', function() {
                var card = currentRoomStatus.cardsMapInv['#pr' + index];
                socket.emit('toggle request', card);
            });
        })(i);
    }
    $('#pr0').append($('<span>').addClass('freq').text('ME'));

    for (var i = 0; i < 3; i++) {
        var selector = $('#prc' + i);
        selector.append($('<img>').attr('src',
                    '/images/back.jpg'));
        (function(index) {
            selector.on('click', function() {
                var card = currentRoomStatus.cardsMapInv['#prc' + index];
                socket.emit('toggle request', card);
            });
        })(i);
    }
});
