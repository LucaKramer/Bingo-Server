const ballList = [
    "https://www.serebii.net/itemdex/sprites/sv/ultraball.png",
    "https://www.serebii.net/itemdex/sprites/sv/timerball.png",
    "https://www.serebii.net/itemdex/sprites/sv/repeatball.png",
    "https://www.serebii.net/itemdex/sprites/sv/quickball.png",
    "https://www.serebii.net/itemdex/sprites/sv/premierball.png",
    "https://www.serebii.net/itemdex/sprites/sv/pokeball.png",
    "https://www.serebii.net/itemdex/sprites/sv/netball.png",
    "https://www.serebii.net/itemdex/sprites/sv/nestball.png",
    "https://www.serebii.net/itemdex/sprites/sv/luxuryball.png",
    "https://www.serebii.net/itemdex/sprites/sv/healball.png",
    "https://www.serebii.net/itemdex/sprites/sv/greatball.png",
    "https://www.serebii.net/itemdex/sprites/sv/duskball.png",
    "https://www.serebii.net/itemdex/sprites/sv/diveball.png",
    "apriko"
];

const aprikoBallList = [
    "https://www.serebii.net/itemdex/sprites/sv/beastball.png",
    "https://www.serebii.net/itemdex/sprites/sv/dreamball.png",
    "https://www.serebii.net/itemdex/sprites/sv/fastball.png",
    "https://www.serebii.net/itemdex/sprites/sv/friendball.png",
    "https://www.serebii.net/itemdex/sprites/sv/heavyball.png",
    "https://www.serebii.net/itemdex/sprites/sv/levelball.png",
    "https://www.serebii.net/itemdex/sprites/sv/loveball.png",
    "https://www.serebii.net/itemdex/sprites/sv/lureball.png",
    "https://www.serebii.net/itemdex/sprites/sv/masterball.png",
    "https://www.serebii.net/itemdex/sprites/sv/moonball.png",
    "https://www.serebii.net/itemdex/sprites/sv/safariball.png",
]

class Game {
    constructor(rows, columns, db) {
        this.rows = rows;
        this.columns = columns;
        this.db = db;
        this.gameState = this.create2DArray(rows, columns);
    }

    create2DArray(rows, columns, initialValue = { coords: [], states: { red: 0, blue: 0, orange: 0, green: 0, purple: 0 }, pokemonImage: "", name: "", ball: "" }) {
        const result = [];
        for (let i = 0; i < rows; i++) {
            result.push(Array(columns).fill({ ...initialValue }));
        }
        return result;
    }

    getRandomPokemon(excludeList, callback) {
        let query =
            "SELECT Shiny, [Name] FROM pokedex WHERE Exclusive = 'No' AND [ShinyLocked] = 0 ORDER BY RANDOM() LIMIT 1";

        this.db.get(query, (err, row) => {
            if (err) {
                console.error(err.message);
                callback(null);
            } else {
                callback(row ? { pokemonName: row.Name, pokemonImage: row.Shiny } : null);
            }
        });
    }

    isPokemonNameInColumn(pokemonName, column) {
        for (let i = 0; i < this.rows; i++) {
            if (this.gameState[i][column].pokemonName === pokemonName) {
                return true;
            }
        }
        return false;
    }

    async initializePokemon(generateBall) {
        const allPokemonNames = new Set();

        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
                let pokemonData;
                let isDuplicate;

                do {
                    isDuplicate = false;

                    pokemonData = await new Promise((resolve) => {
                        this.getRandomPokemon([...allPokemonNames], (data) => {
                            resolve(data);
                        });
                    });

                    if (allPokemonNames.has(pokemonData.pokemonName)) {
                        isDuplicate = true;
                    }

                } while (isDuplicate);


                var randomBall = "";
                if(generateBall) {
                    var randomIndex = Math.floor(Math.random() * ballList.length);
                    randomBall = ballList[randomIndex];
                    if(randomBall === "apriko"){
                        randomIndex = Math.floor(Math.random() * aprikoBallList.length);
                        randomBall = aprikoBallList[randomIndex];
                    }
                };

                this.gameState[i][j] = {
                    coords: [i, j],
                    states: { red: 0, blue: 0, orange: 0, green: 0, purple: 0 },
                    name: pokemonData.pokemonName,
                    pokemonImage: pokemonData.pokemonImage,
                    ball: randomBall,
                };

                allPokemonNames.add(pokemonData.pokemonName);
            }
        }

        // Clear the set after initializing the entire board
        allPokemonNames.clear();
    }

    shuffleBoard() {
        let array = this.gameState;
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

    shiftRow(rowIndex, direction) {
        if (rowIndex < 0 || rowIndex >= this.rows) {
            console.log("Invalid row index.");
            return;
        }

        const rowToShift = this.gameState[rowIndex];
        if (direction === 'left') {
            const shiftedRow = [...rowToShift.slice(1), rowToShift[0]];
            this.gameState[rowIndex] = shiftedRow;
        } else if (direction === 'right') {
            const shiftedRow = [rowToShift[this.columns - 1], ...rowToShift.slice(0, this.columns - 1)];
            this.gameState[rowIndex] = shiftedRow;
        } else {
            console.log("Invalid direction for shifting row.");
        }
    }

    shiftColumn(columnIndex, direction) {
        if (columnIndex < 0 || columnIndex >= this.columns) {
            console.log("Invalid column index.");
            return;
        }

        const columnToShift = this.gameState.map(row => row[columnIndex]);
        if (direction === 'down') {
            const shiftedColumn = [columnToShift[this.rows - 1], ...columnToShift.slice(0, this.rows - 1)];
            for (let i = 0; i < this.rows; i++) {
                this.gameState[i][columnIndex] = shiftedColumn[i];
            }
        } else if (direction === 'up') {
            const shiftedColumn = [...columnToShift.slice(1), columnToShift[0]];
            for (let i = 0; i < this.rows; i++) {
                this.gameState[i][columnIndex] = shiftedColumn[i];
            }
        } else {
            console.log("Invalid direction for shifting column.");
        }
    }

    heartbeat(socketIO) {
        socketIO.emit("initial_state", this.gameState);
    }
}

module.exports = Game;