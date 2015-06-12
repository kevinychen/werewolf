
const Roles = {
    WEREWOLF: "werewolf",
    SEER: "seer",
    VILLAGER: "villager",
    MASON: "mason",
    MINION: "minion",
    TANNER: "tanner",
    ROBBER: "robber",
    TROUBLEMAKER: "troublemaker",
};

function Game(players, roleSet) {
    if (players.length <= 1) {
        throw Exception("invalid number of players");
    }
    if (roleSet.length != players.length + 3) {
        throw Exception("invalid number of roles");
    }

    this.players = players;
    this.roleSet = roleSet.slice(0);

    this.setRoles();
}

Game.prototype.setRoles = function() {
    var roleSet = this.roleSet.slice(0);

    this.roles = {};
    this.initialRoleList = {};
    for (var role in roles) {
        this.initialRoleList[role] = [];
    }

    for (var i = 0; i < this.players.length; i++) {
        var card = {
            type: 'PLAYER',
            playerID: this.players[i].id,
        };
        var index = Math.floor(Math.random() * roleSet.length);
        var role = roleSet.splice(index, 1);
        this.roles[card] = role;
        this.initialRoleList[role].push(card);
    }

    for (var i = 0; i < roleSet.length; i++) {
        var card = {
            type: 'CENTER',
            index: i,
        };
        this.roles[card] = roleSet[i];
    }
};

Game.prototype.informTarget = function(targetCard, cards) {
    if (!(targetCard in this.inform)) {
        this.inform[targetCard] = [];
    }
    for (var i = 0; i < cards.length; i++) {
        this.inform[targetCard].push({
            card: cards[i],
            role: this.roles[cards[i]],
        });
    }
}

Game.prototype.swapCards = function(card1, card2) {
    var temp = this.roles[card1];
    this.roles[card1] = this.roles[card2];
    this.roles[card2] = temp;
};

Game.prototype.requestPhase = function() {
    this.inform = {};
    this.requests = {};

    // Seer
    var seer = this.initialRoleList[Role.SEER][0];
    this.requests[seer] = {
        playerCards: 1,
        centerCards: 2,
    };

    // Robber
    var robber = this.initialRoleList[Role.ROBBER][0];
    this.requests[robber] = {
        playerCards: 1,
    };

    // Troublemaker
    var troublemaker = this.initialRoleList[Role.TROUBLEMAKER][0];
    this.requests[troublemaker] = {
        playerCards: 2,
    };
};

Game.prototype.actionPhase = function(requests) {
    this.inform = {};
    this.requests = {};

    // Werewolf
    var werewolves = this.initialRoleList[Role.WEREWOLF];
    for (var i = 0; i < werewolves.length; i++) {
        this.informTarget(werewolves[i], werewolves);
    }

    // Minion
    var minion = this.initialRoleList[Role.MINION][0];
    this.informTarget(minion, werewolves);

    // Mason
    var masons = this.initialRoleList[Role.MASON];
    for (var i = 0; i < masons.length; i++) {
        this.informTarget(masons[i], masons);
    }

    // Seer
    var seer = this.initialRoleList[Role.SEER][0];
    var seerChoice = requests[seer];
    this.informTarget(seer, seerChoice);

    // Robber
    var robber = this.initialRoleList[Role.ROBBER][0];
    var robberChoice = requests[robber];
    this.informTarget(robber, robberChoice);
    this.swapCards(robber, robberChoice[0]);

    // Troublemaker
    var troublemaker = this.initialRoleList[Role.TROUBLEMAKER][0];
    var troublemakerChoice = requests[troublemaker];
    this.swapCards(troublemakerChoice[0], troublemakerChoice[1]);
};

Game.prototype.discussionPhase = function() {
    this.inform = {};
    this.requests = {};
};

Game.prototype.getResults = function() {
};

exports.Game = Game;
