const Player = require("./player");

class Players {
    playerArray = [];

    addPlayer(id){
        this.playerArray.push(new Player(id));
    }

    removePlayer(id){
        this.playerArray = this.playerArray.filter(player => player.id !== id);
    }

    nameChange(id, name){
        let player = this.playerArray.find(player => player.id === id);
        if(player){
            player.nameChange(name);
        }
    }

    teamChange(id, team) {
        let player = this.playerArray.find(player => player.id === id);
        if (player) {
            player.teamChange(team);
        }
    }
}

module.exports = Players;