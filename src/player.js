class Player {
    constructor(id) {
        this.id = id;
        this.name = null;
        this.team = null;
    }

    nameChange(name){
        this.name = name;
    }

    teamChange(team){
        this.team = team;
    }
}

module.exports = Player;