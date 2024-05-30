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

let bingo = { red: 0, blue: 0, orange: 0, green: 0, purple: 0 };

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

function hasBingo(gameState, color) {
    console.log("Checking for Bingo:", color);

    // Check rows for Bingo
    for (let i = 0; i < rows; i++) {
        let rowBingo = true;
        for (let j = 0; j < columns; j++) {
            if (gameState[i][j].states[color] !== 1) {
                rowBingo = false;
                break;
            }
        }
        if (rowBingo) {
            console.log("Bingo in row", i);
            if(bingo[color] == 0){
                return true;
            }
            return false;
        }
    }

    // Check columns for Bingo
    for (let i = 0; i < columns; i++) {
        let colBingo = true;
        for (let j = 0; j < rows; j++) {
            if (gameState[j][i].states[color] !== 1) {
                colBingo = false;
                break;
            }
        }
        if (colBingo) {
            console.log("Bingo in column", i);
            if(bingo[color] == 0){
                return true;
            }
            return false;
        }
    }

    // Check diagonal (top-left to bottom-right) for Bingo
    let diag1Bingo = true;
    for (let i = 0; i < rows; i++) {
        if (gameState[i][i].states[color] !== 1) {
            diag1Bingo = false;
            break;
        }
    }
    if (diag1Bingo) {
        console.log("Bingo in diagonal (top-left to bottom-right)");
        if(bingo[color] == 0){
            return true;
        }
        return false;
    }

    // Check diagonal (top-right to bottom-left) for Bingo
    let diag2Bingo = true;
    for (let i = 0; i < rows; i++) {
        if (gameState[i][rows - 1 - i].states[color] !== 1) {
            diag2Bingo = false;
            break;
        }
    }
    if (diag2Bingo) {
        console.log("Bingo in diagonal (top-right to bottom-left)");
        if(bingo[color] == 0){
            return true;
        }
        return false;
    }

    console.log("No Bingo found");
    return false;
}

function updateURLsForBingo(gameState, color) {

    if(bingo[color] == 1){
        return;
    }

    const bingoLetters = ['B', 'I', 'N', 'G', 'O'];
    const bingoTypes = ['row', 'column', 'diagonal1', 'diagonal2'];
    const previousURLs = {}; // Object to store previous URLs
    const previousBalls = {};

    // Store previous URLs
    for (let i = 0; i < gameState.length; i++) {
        for (let j = 0; j < gameState[i].length; j++) {
            previousURLs[`${i}-${j}`] = gameState[i][j].pokemonImage;
            previousBalls[`${i}-${j}`] = gameState[i][j].ball;
        }
    }

    for (let i = 0; i < rows; i++) {
        for (let type of bingoTypes) {
            let bingoFound = true;
            for (let j = 0; j < columns; j++) {
                let cellState;
                if (type === 'row') {
                    cellState = gameState[i][j].states[color];
                } else if (type === 'column') {
                    cellState = gameState[j][i].states[color];
                } else if (type === 'diagonal1') {
                    cellState = gameState[j][j].states[color];
                } else if (type === 'diagonal2') {
                    cellState = gameState[j][rows - 1 - j].states[color];
                }
                if (cellState !== 1) {
                    bingoFound = false;
                    break;
                }
            }
            if (bingoFound) {
                bingo[color] = 1;
                for (let j = 0; j < columns; j++) {
                    const letter = bingoLetters[j];
                    let url;
                    if (type === 'row') {
                        url = `https://shinydust.de/${letter}.png`;
                        gameState[i][j].pokemonImage = url;
                        gameState[i][j].ball = "";
                    } else if (type === 'column') {
                        url = `https://shinydust.de/${letter}.png`;
                        gameState[j][i].pokemonImage = url;
                        gameState[j][i].ball = "";
                    } else if (type === 'diagonal1') {
                        url = `https://shinydust.de/${letter}.png`;
                        gameState[j][j].pokemonImage = url;
                        gameState[j][j].ball = "";
                    } else if (type === 'diagonal2') {
                        url = `https://shinydust.de/${bingoLetters[rows - 1 - j]}.png`;
                        gameState[j][rows - 1 - j].pokemonImage = url;
                        gameState[j][rows - 1 - j].ball = "";
                    }
                }

                // Set timeout to reset URLs after 10 seconds
                setTimeout(() => {
                    // Restore previous URLs
                    for (let i = 0; i < gameState.length; i++) {
                        for (let j = 0; j < gameState[i].length; j++) {
                            gameState[i][j].pokemonImage = previousURLs[`${i}-${j}`];
                            gameState[i][j].ball = previousBalls[`${i}-${j}`];
                        }
                    }
                }, 10000); // 10 seconds in milliseconds
            }
        }
    }
}

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

    socket.on('race-endStreams', () => {
        socketIO.emit('race-camera1', "");
        socketIO.emit('race-camera2', "");
        socketIO.emit('race-camera3', "");
        socketIO.emit('race-camera4', "");
        socketIO.emit('race-game1', "");
        socketIO.emit('race-game2', "");
        socketIO.emit('race-game3', "");
        socketIO.emit('race-game4', "");
        socketIO.emit('race-name1', "");
        socketIO.emit('race-name2', "");
        socketIO.emit('race-name3', "");
        socketIO.emit('race-name4', "");
    });

    socket.on('race-streams', ({link1, link2, link3, link4, link5, link6, link7, link8, link9, link10, link11, link12}) => {
        socketIO.emit('race-camera1', link1);
        socketIO.emit('race-camera2', link2);
        socketIO.emit('race-camera3', link3);
        socketIO.emit('race-camera4', link4);
        socketIO.emit('race-game1', link5);
        socketIO.emit('race-game2', link6);
        socketIO.emit('race-game3', link7);
        socketIO.emit('race-game4', link8);
        socketIO.emit('race-name1', link9);
        socketIO.emit('race-name2', link10);
        socketIO.emit('race-name3', link11);
        socketIO.emit('race-name4', link12);
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
        const { coords, playerInfo } = data;
        const { team } = playerInfo;

        const color = team.toLowerCase();

        const currentState = game.gameState[coords[0]][coords[1]].states[color];

        game.gameState[coords[0]][coords[1]].states[color] = (currentState + 1) % 3;

        if(currentState == 0){
            if (hasBingo(game.gameState, color)) {
                updateURLsForBingo(game.gameState, color);
                socketIO.emit(
                    "recieve_event",
                    `Player ${data.playerInfo.username} (${data.playerInfo.team}) has achieved Bingo!`
                );
                socketIO.emit("shiny_animation", {coords: data.coords, color: data.playerInfo.team});
                socketIO.emit("play_sound", 1);
            }else{
                socketIO.emit(
                    "recieve_event",
                    `Player ${data.playerInfo.username} (${data.playerInfo.team}) marked field ${data.coords[0]}, ${data.coords[1]}`
                );
                socketIO.emit("shiny_animation", {coords: data.coords, color: data.playerInfo.team});
                socketIO.emit("play_sound");
            }
        }else if(currentState == 1){
            socketIO.emit(
                "recieve_event",
                `Player ${data.playerInfo.username} (${data.playerInfo.team}) unmarked field ${data.coords[0]}, ${data.coords[1]}`
            );
        }else{
            socketIO.emit(
                "recieve_event",
                `Player ${data.playerInfo.username} (${data.playerInfo.team}) marked field ${data.coords[0]}, ${data.coords[1]} as blocked`
            );
        }
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

    socket.on("refresh_board", (generatePokemon) => {
        console.log("Refreshed Board");
        bingo = { red: 0, blue: 0, orange: 0, green: 0, purple: 0 };
        game.initializePokemon(generatePokemon.withCheckbox);
        socketIO.emit("reset-votes");
    });

    socket.on("votes", (data) => {
        console.log(`Ja: ${data.ja}, Nein: ${data.nein}`);
        socketIO.emit("vote-data", data);
    });

    socket.on("shuffle_board", () => {
        console.log("Shuffle Board");
        game.shuffleBoard();
    });

    socket.on("shift_left_right", (data) => {
        game.shiftRow(data.row-1, data.direction);
        socketIO.emit("recieve_shift", `Row ${data.row} moved ${data.direction}`);
    });

    socket.on("shift_up_down", (data) => {
        game.shiftColumn(data.column-1, data.direction);
        if(data.column == 1) {
            socketIO.emit("recieve_shift", `Column A moved ${data.direction}`);
        }else if(data.column == 2) {
            socketIO.emit("recieve_shift", `Column B moved ${data.direction}`);
        }else if(data.column == 3) {
            socketIO.emit("recieve_shift", `Column C moved ${data.direction}`);
        }else if(data.column == 4) {
            socketIO.emit("recieve_shift", `Column D moved ${data.direction}`);
        }else if(data.column == 5) {
            socketIO.emit("recieve_shift", `Column E moved ${data.direction}`);
        }
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
