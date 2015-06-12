var socket = io.connect('http://localhost:8405');

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
});
