const express = require('express');
const https = require('https');
const socket = require('socket.io');
const fs = require("fs");
const cors = require('cors');

const app = express();
const privateKey = fs.readFileSync("privkey.pem", "utf8");
const certificate = fs.readFileSync("fullchain.pem", "utf8");
const credentials = { key: privateKey, cert: certificate };
const server = https.createServer(credentials ,app);
const socketIO = socket(server, {
    cors: {
        origin: "https://shinydust.de",
        methods: ["GET", "POST"]
    }
});

const sqlite3 = require("sqlite3");

const Game = require("./src/game");
const Players = require("./src/players");

const rows = 5;
const columns = 5;

// Set up SQLite database connection
const db = new sqlite3.Database("./pokemon.db");

const game = new Game(rows, columns, db);
const players  = new Players();
const clients = {};

let activeTeams = [];
const activeStreams = [];

app.use(cors());

// Set up heartbeat interval
setInterval(() => game.heartbeat(socketIO), 500);

// Initialize the gameState
game.initializePokemon().then(() => {
    // Start your server or perform any other actions after initialization
});

// Define a route for the root path
app.get('/', (req, res) => {
    res.header('Access-Control-Allow-Origin', 'https://shinydust.de');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', true);

    res.send('Hello, this is your Express server with Socket.IO!');
});

// Set up a connection event for Socket.IO
socketIO.on('connection', (socket) => {
    players.addPlayer(socket.id);

    socketIO.to(socket.id).emit('activeStreams', activeStreams);

    socket.on('startStream', (data) => {
        // Assuming the link is the stream identifier
        activeStreams.push({ id: socket.id, link: data.link, team: data.team, name: data.name });
        socketIO.emit('activeStreams', activeStreams);
        console.log(`Started stream: ${data.link}`);
    });

    socket.on('closeStream', () => {
        // Close active stream for the specific socket connection
        const index = activeStreams.findIndex((stream) => stream.id === socket.id);
        if (index !== -1) {
            const closedStream = activeStreams.splice(index, 1)[0];
            socketIO.emit('activeStreams', activeStreams);
            console.log(`Closed stream: ${closedStream}`);
        }
    });

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

        const index = activeStreams.findIndex((stream) => stream.id === socket.id);
        if (index !== -1) {
            const disconnectedStream = activeStreams.splice(index, 1)[0];
            socketIO.emit('activeStreams', activeStreams);
            console.log(`User disconnected: ${disconnectedStream.id}`);
        }
    });
});

// Start the server on port 7777
const PORT = 7777;
server.listen(PORT, () => {
    console.log(`Server is running on https://localhost:${PORT}`);
});
