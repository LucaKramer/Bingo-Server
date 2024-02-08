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

const PORT = 7777;
const rows = 5;
const columns = 5;

// Set up SQLite database connection
const db = new sqlite3.Database("./pokemon.db");

const game = new Game(rows, columns, db);

// Set up heartbeat interval
setInterval(() => game.heartbeat(socketIO), 500);

// Initialize the gameState
game.initializePokemon().then(() => {
    // Start your server or perform any other actions after initialization
});


socketIO.on("connection", (socket) => {
    console.log(`User Connected: ${socket.id}`);

    // Send current game state to the new client
    //socket.emit("initial_state", gameState);

    socket.on("change_username", (data) => {
        console.log(data);
        socketIO.emit(
            "recieve_event",
            `Player ${data.playerInfo.username} changed username to ${data.inputValue}`
        );
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

    socket.on("change_team", (data) => {
        socketIO.emit(
            "recieve_event",
            `Player ${data.playerInfo.username} changed team from ${data.playerInfo.team} to ${data.color}`
        );
    });

    socket.on("refresh_board", () => {
        console.log("Refreshed Board");
        game.initializePokemon();
    });

    socket.on("shuffle_board", () => {
        console.log("Shuffle Board");
        game.shuffleBoard();
    });

});

http.listen(7777, () => {
    console.log("Listening on *:7777!");
});