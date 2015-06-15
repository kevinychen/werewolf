
const Role = {
    WEREWOLF: "werewolf",
    SEER: "seer",
    VILLAGER: "villager",
    MASON: "mason",
    MINION: "minion",
    TANNER: "tanner",
    ROBBER: "robber",
    TROUBLEMAKER: "troublemaker",
};

function Game(players, roleCounts) {
    if (players.length < 1) {
        throw "invalid number of players";
    }
    this.players = players.slice();
    this.roleCounts = roleCounts;
}

Game.prototype.setRoles = function() {
    var roleSet = [];
    for (var role in this.roleCounts) {
        for (var i = 0; i < this.roleCounts[role]; i++) {
            roleSet.push(role);
        }
    }
    if (roleSet.length !== this.players.length + 3) {
        throw "invalid number of roles";
    }

    this.roles = {};
    this.initialRoleList = {};
    for (var key in Role) {
        this.initialRoleList[Role[key]] = [];
    }

    for (var i = 0; i < this.players.length; i++) {
        var card = 'PLAYER ' + this.players[i].playerID;
        var index = Math.floor(Math.random() * roleSet.length);
        var role = roleSet.splice(index, 1)[0];
        this.roles[card] = role;
        this.initialRoleList[role].push(card);
    }

    for (var i = 0; i < roleSet.length; i++) {
        var card = 'CENTER ' + i;
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

Game.prototype.confirmChoice = function(card, choice, requests) {
    var numPlayerCards = 0, numCenterCards = 0;
    for (var i = 0; i < choice.length; i++) {
        if (choice[i].substring(0, 6) === 'PLAYER') {
            numPlayerCards++;
        } else {
            numCenterCards++;
        }
    }
    return (
            (numPlayerCards >= 1 &&
             numPlayerCards <= requests[card].playerCards &&
             numCenterCards === 0) ||
            (numCenterCards >= 1 &&
             numCenterCards <= requests[card].centerCards &&
             numPlayerCards === 0)
           );
};

Game.prototype.requestPhase = function() {
    this.inform = {};
    this.requests = {};

    for (var i = 0; i < this.players.length; i++) {
        var card = 'PLAYER ' + this.players[i].playerID;
        this.informTarget(card, [card]);
    }

    // Seer
    var seer = this.initialRoleList[Role.SEER][0];
    if (seer) {
        this.requests[seer] = {
            playerCards: 1,
            centerCards: 2,
        };
    }

    // Robber
    var robber = this.initialRoleList[Role.ROBBER][0];
    if (robber) {
        this.requests[robber] = {
            playerCards: 1,
        };
    }

    // Troublemaker
    var troublemaker = this.initialRoleList[Role.TROUBLEMAKER][0];
    if (troublemaker) {
        this.requests[troublemaker] = {
            playerCards: 2,
        };
    }
};

Game.prototype.actionPhase = function(requests) {
    var prevRequests = this.requests;
    this.inform = {};
    this.requests = {};

    // Werewolf
    var werewolves = this.initialRoleList[Role.WEREWOLF];
    for (var i = 0; i < werewolves.length; i++) {
        this.informTarget(werewolves[i], werewolves);
    }

    // Minion
    var minion = this.initialRoleList[Role.MINION][0];
    if (minion) {
        this.informTarget(minion, werewolves);
    }

    // Mason
    var masons = this.initialRoleList[Role.MASON];
    for (var i = 0; i < masons.length; i++) {
        this.informTarget(masons[i], masons);
    }

    // Seer
    var seer = this.initialRoleList[Role.SEER][0];
    if (seer) {
        var seerChoice = requests[seer] || [];
        if (this.confirmChoice(seer, seerChoice, prevRequests)) {
            this.informTarget(seer, seerChoice);
        }
    }

    // Robber
    var robber = this.initialRoleList[Role.ROBBER][0];
    if (robber) {
        var robberChoice = requests[robber] || [];
        if (this.confirmChoice(robber, robberChoice, prevRequests)) {
            this.informTarget(robber, robberChoice);
            this.swapCards(robber, robberChoice[0]);
        }
    }

    // Troublemaker
    var troublemaker = this.initialRoleList[Role.TROUBLEMAKER][0];
    if (troublemaker) {
        var troublemakerChoice = requests[troublemaker] || [];
        if (this.confirmChoice(troublemaker, troublemakerChoice, prevRequests)) {
            this.swapCards(troublemakerChoice[0], troublemakerChoice[1]);
        }
    }
};

Game.prototype.discussionPhase = function() {
    this.inform = {};
    this.requests = {};
};

Game.prototype.getResults = function(requests) {
    var votesMap = {};
    for (var playerCard in requests) {
        var vote = requests[playerCard];
        if (!votesMap[vote]) {
            votesMap[vote] = 0;
        }
        votesMap[vote]++;
    }
    var maxNumVotes = 0;
    for (var vote in votesMap) {
        if (votesMap[vote] > maxNumVotes) {
            maxNumVotes = votesMap[vote];
        }
    }
    var killed = [];
    for (var vote in votesMap) {
        if (votesMap[vote] == maxNumVotes) {
            killed.push(vote);
        }
    }

    var tanner = undefined;
    var allWerewolves = [];
    var allBad = [];
    var allGood = [];
    for (var i = 0; i < this.players.length; i++) {
        var card = 'PLAYER ' + this.players[i].playerID;
        if (this.roles[card] === Role.TANNER) {
            tanner = card;
        } else if (this.roles[card] === Role.WEREWOLF) {
            allWerewolves.push(card);
        }
        if (this.roles[card] === Role.WEREWOLF ||
                this.roles[card] === Role.MINION) {
            allBad.push(card);
        } else if (this.roles[card] !== Role.TANNER) {
            allGood.push(card);
        }
    }

    var tannerKilled = false;
    var werewolfKilled = false;
    var anyoneKilled = false;
    for (var i = 0; i < killed.length; i++) {
        if (killed[i]) {
            anyoneKilled = true;
        }
        if (this.roles[killed[i]] === Role.TANNER) {
            tannerKilled = true;
        } else if (this.roles[killed[i]] === Role.WEREWOLF) {
            werewolfKilled = true;
        }
    }

    var winners;
    if (tanner && tannerKilled) {
        winners = [tanner];
    } else if (allWerewolves && werewolfKilled ||
            !allWerewolves && !anyoneKilled) {
        winners = allGood;
    } else {
        winners = allBad;
    }

    var results = {
        allRoles: this.roles,
        killed: killed,
        winners: winners,
    };
    return results;
};

exports.Role = Role;
exports.Game = Game;
