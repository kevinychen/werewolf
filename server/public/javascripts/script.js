var socket = io.connect('http://localhost:8405');

const Roles = [
        "werewolf", "villager", "mason", "seer",
        "robber", "troublemaker", "tanner", "minion",
        ];
var allRooms = [];

socket.on('player info', function(playerName) {
    $('#username').text(playerName);
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

        if (roomStatus.state === 'awaiting players') {
            var numRolesSelected = 0;
            for (var role in roomStatus.roleCounts) {
                numRolesSelected += roomStatus.roleCounts[role];
            }

            $('#gamenotification').text(
                'Choose ' + (roomStatus.playerNames.length + 3) + ' roles. ' + numRolesSelected + ' roles selected.');

            for (var i = 0; i < Roles.length; i++) {
                var count = roomStatus.roleCounts[Roles[i]] || 0;
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

            $('#currentplayers').text(
                'Current players: ' + roomStatus.playerNames.join(', '));
            $('#gamecontrol').text('START GAME');
        }
    } else {
        $('#main').hide();
    }
});

$(document).ready(function() {
    $('#roomcreate').on('click', function() {
        $('#popup').show();
        $('#content').css('opacity', '0.5');
        $('#createroomname').focus();
    });

    $('#createroom').on('click', function() {
        socket.emit('join room', $('#createroomname').val());
        $('#popup').hide();
        $('#content').css('opacity', '1');
    });

    $('#closecreate').on('click', function() {
        $('#popup').hide();
        $('#content').css('opacity', '1');
    });

    $('#roomleave').on('click', function() {
        socket.emit('leave room', false);
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
});
