const express = require("express");
const app = express();
const http = require("http").createServer(app);
const socketIO = require("socket.io")(http, {
    cors: {
        origin: "*",
    },
});
const sqlite3 = require("sqlite3");

const Game = require("./src/game");
const Players = require("./src/players");

const PORT = 7777;
const rows = 5;
const columns = 5;

// Set up SQLite database connection
const db = new sqlite3.Database("./pokemon.db");

const game = new Game(rows, columns, db);
const players  = new Players();
const clients = {};

let activeTeams = [];

// Set up heartbeat interval
setInterval(() => game.heartbeat(socketIO), 500);

// Initialize the gameState
game.initializePokemon().then(() => {
    // Start your server or perform any other actions after initialization
});


socketIO.on("connection", (socket) => {
    players.addPlayer(socket.id);

    // Send current game state to the new client
    //socket.emit("initial_state", gameState);


    socket.on("change_username", (data) => {
        players.nameChange(socket.id, data.inputValue);
        socketIO.emit(
            "recieve_event",
            `Player ${data.playerInfo.username} changed username to ${data.inputValue}`
        );
        socketIO.emit("update_players", players.playerArray);
    });

    socket.on("get_state", () => {
        //socketIO.emit("initial_state", gameState);
    });

    socket.on("send_field", (data) => {
        console.log(data);

        const colors = game.gameState[data.coords[0]][data.coords[1]].color;
        const team = data.playerInfo.team;
        const teamIndex = colors.indexOf(team);
        if (teamIndex != -1) {
            colors.splice(teamIndex, 1);
            socketIO.emit(
                "recieve_event",
                `Player ${data.playerInfo.username} (${data.playerInfo.team}) unmarked field ${data.coords[0]}, ${data.coords[1]}`
            );
        } else {
            colors.push(team);
            colors.sort();
            socketIO.emit(
                "recieve_event",
                `Player ${data.playerInfo.username} (${data.playerInfo.team}) marked field ${data.coords[0]}, ${data.coords[1]}`
            );

            socketIO.emit("play_sound", data.playerInfo.team);
        }
        if (colors.length == 0) {
            colors.push("white");
        }

        game.gameState[data.coords[0]][data.coords[1]].color = colors;

        //socketIO.emit("color_update", data);
    });

    socket.on('videoStream', ({ frame, team, name})  => {
        socketIO.emit(`videoStream-${team}`, {frame, name});
        if (!activeTeams.includes(team)){
            activeTeams.push(team);
        }
        socketIO.emit('activeTeams', {activeTeams});
    });

    socket.on('leaveTeam', (team) => {
        // Remove the team from the activeTeams array
        activeTeams = activeTeams.filter((activeTeam) => activeTeam !== team);

        // Emit the updated list of active teams to all clients
        socketIO.emit('activeTeams', { activeTeams });
    });

    socket.on("change_team", (data) => {
        socketIO.emit(
            "recieve_event",
            `Player ${data.playerInfo.username} changed team from ${data.playerInfo.team} to ${data.color}`
        );
        players.teamChange(socket.id, data.color);
        socketIO.emit("update_players", players.playerArray);
    });

    socket.on("refresh_board", () => {
        console.log("Refreshed Board");
        game.initializePokemon();
    });

    socket.on("shuffle_board", () => {
        console.log("Shuffle Board");
        game.shuffleBoard();
    });

    socket.on("disconnect", () => {
        players.removePlayer(socket.id);
        socketIO.emit("update_players", players.playerArray);
        delete clients[socket.id];
        socket.broadcast.emit('stream', null);
    });

});

http.listen(7777, () => {
    console.log("Listening on *:7777!");
});