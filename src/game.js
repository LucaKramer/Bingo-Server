class Game {
    constructor(rows, columns, db) {
        this.rows = rows;
        this.columns = columns;
        this.db = db;
        this.gameState = this.create2DArray(rows, columns);
    }

    create2DArray(rows, columns, initialValue = { coords: [], color: ["white"], pokemonImage: "", pokemonName: "" }) {
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

    async initializePokemon() {
        const selectedPokemonNames = new Set();
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
                let pokemonData;
                do {
                    pokemonData = await new Promise((resolve) => {
                        this.getRandomPokemon([selectedPokemonNames], (data) => {
                            resolve(data);
                        });
                    });
                } while (
                    !pokemonData ||
                    this.isPokemonNameInColumn(pokemonData.pokemonName, j)
                    );
                this.gameState[i][j] = {
                    coords: [i, j],
                    color: ["white"],
                    pokemonName: pokemonData.pokemonName,
                    pokemonImage: pokemonData.pokemonImage,
                };
                selectedPokemonNames.add(pokemonData.pokemonName);
            }
        }
        selectedPokemonNames.clear();
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

    heartbeat(socketIO) {
        socketIO.emit("initial_state", this.gameState);
    }
}

module.exports = Game;