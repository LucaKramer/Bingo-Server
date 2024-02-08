const express = require("express");
const app = express();
const http = require("http").createServer(app);
const socketIO = require("socket.io")(http, {
    cors: {
        origin: "*",
    },
});
const sqlite3 = require("sqlite3");

const db = new sqlite3.Database("./pokemon.db");

const getRandomPokemon = (excludeList, callback) => {
    let query =
        "SELECT Shiny, [Name] FROM pokedex WHERE Exclusive = 'No' AND [ShinyLocked] = 0 ORDER BY RANDOM() LIMIT 1";

    db.get(query, (err, row) => {
        if (err) {
            console.error(err.message);
            callback(null);
        } else {
            callback(row ? { pokemonName: row.Name, pokemonImage: row.Shiny } : null);
        }
    });
};

setInterval(heartbeat, 500);

function heartbeat() {
    socketIO.emit("initial_state", gameState);
}

// Initialize the gameState
const rows = 5;
const columns = 5;
function create2DArray(
    rows,
    columns,
    initialValue = {
        coords: [],
        color: ["white"],
        pokemonImage: "",
        pokemonName: "",
    }
) {
    const result = [];
    for (let i = 0; i < rows; i++) {
        result.push(Array(columns).fill({ ...initialValue }));
    }
    return result;
}

let gameState = create2DArray(rows, columns);

function shuffle2DArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        for (let j = array[i].length - 1; j > 0; j--) {
            const randRow = Math.floor(Math.random() * (i + 1));
            const randCol = Math.floor(Math.random() * (j + 1));

            // Swap elements
            [array[i][j], array[randRow][randCol]] = [
                array[randRow][randCol],
                array[i][j],
            ];
        }
    }
}

const initializePokemon = async () => {
    const selectedPokemonNames = new Set();
    for (let i = 0; i < rows * columns; i++) {
        for (let j = 0; j < columns; j++) {
            let pokemonData;
            do {
                pokemonData = await new Promise((resolve) => {
                    getRandomPokemon([selectedPokemonNames], (data) => {
                        resolve(data);
                    });
                });
            } while (
                !pokemonData ||
                isPokemonNameInColumn(pokemonData.pokemonName, j)
                );
            gameState[i][j] = {
                coords: [i, j],
                color: ["white"],
                pokemonName: pokemonData.pokemonName,
                pokemonImage: pokemonData.pokemonImage,
            };
            selectedPokemonNames.add(pokemonData.pokemonName);
        }
    }
    selectedPokemonNames.clear();
};

const isPokemonNameInColumn = (pokemonName, column) => {
    for (let i = 0; i < rows; i++) {
        if (gameState[i][column].pokemonName === pokemonName) {
            return true;
        }
    }
    return false;
};

initializePokemon().then(() => {
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

        const colors = gameState[data.coords[0]][data.coords[1]].color;
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

        gameState[data.coords[0]][data.coords[1]].color = colors;

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
        gameState = create2DArray(rows, columns);
        initializePokemon();
        //socketIO.emit("initial_state", gameState);
    });

    socket.on("shuffle_board", () => {
        console.log("Shuffle Board");
        shuffle2DArray(gameState);
    });
});

http.listen(3001, () => {
    console.log("Listening on *:3001!");
});
