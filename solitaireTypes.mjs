// solitaireTypes.mjs
import * as db from './solitaireDb.mjs';

export class SolitaireGame {
    constructor(id) {
        this.id = id;
        this.board = Array(7).fill().map(() => []); // 7 kolonner med kort 
        this.foundation = Array(4).fill().map(() => []); // 4 fundamentstabler
        this.library = []; // Kortstokken
        this.graveyard = []; // Kastet kort
        this.moves = 0; // Antall trekk
        this.startTime = Date.now(); // Starttidspunkt
        this.status = 'active';
    }
    
    async init(deck) {
        // Kopier kortstokken
        const deckCopy = [...deck];
        
        // Del ut kort til board 
        for (let i = 0; i < 7; i++) {
            for (let j = 0; j <= i; j++) {
                const card = deckCopy.pop();
                
                // Sist utdelte kort i hver kolonne er synlig
                if (j === i) {
                    this.board[i].push({ card, visible: true });
                } else {
                    this.board[i].push({ card, visible: false });
                }
            }
        }
        
        // Resten av kortene går til library
        this.library = deckCopy.map(card => ({ card, visible: false }));
        
        // Lagre første tilstand til databasen
        try {
            console.log(`Initialiserer spill ${this.id} i databasen`);
            await db.createGame(this.id, this.status);
            await this.saveToDb();
            console.log(`Spill ${this.id} initialisert i databasen`);
        } catch (error) {
            console.error(`Feil ved initialisering av spill ${this.id}:`, error);
            throw error;
        }
    }
    
    // Hjelpemetode for å lagre spilltilstand til databasen
    async saveToDb() {
        try {
            return await db.saveGameState({
                id: this.id,
                status: this.status,
                moves: this.moves,
                startTime: this.startTime,
                library: this.library,
                graveyard: this.graveyard,
                board: this.board,
                foundation: this.foundation
            });
        } catch (error) {
            console.error(`Feil ved lagring av spill ${this.id} til databasen:`, error);
            throw error;
        }
    }
    
    // fra library til graveyard
    async drawFromLibrary() {
        // Hvis library er tom, resirkuler graveyard
        if (this.library.length === 0) {
            if (this.graveyard.length > 0) {
                // Snu bunken og gjør alle kortene usynlige
                this.library = [...this.graveyard].reverse();
                this.graveyard = [];
                this.library.forEach(card => card.visible = false);
                await this.saveToDb();
                
                // Trekk første kort
                return this.drawFromLibrary();
            }
            return false;
        }

        const card = this.library.pop();
        card.visible = true;
        this.graveyard.push(card);
        this.moves++;
        
        try {
            await db.incrementMoves(this.id);
            await this.saveToDb();
        } catch (error) {
            console.error(`Feil ved trekking av kort i spill ${this.id}:`, error);
            throw error;
        }
        
        return true;
    }

    // Oppdatert canMoveToBoard-funksjon for solitaireTypes.mjs
canMoveToBoard(fromCard, toBoardColumn) {
    // Hvis kolonnen er tom, kan kun en KONGE flyttes dit
    if (toBoardColumn.length === 0) {
        return fromCard.card.split('_')[0] === 'konge';
    }

    const targetCard = toBoardColumn[toBoardColumn.length - 1];
    
    // Korrekte rangeringer for norske kortnavn
    const ranks = ['konge', 'dame', 'knekt', '10', '9', '8', '7', '6', '5', '4', '3', '2', 'ess'];
    
    const colors = {
        'hjerter': 'red', 
        'ruter': 'red', 
        'kløver': 'black', 
        'spar': 'black'
    };

    // Sjekk alternerende farger og synkende rangering
    const fromColor = colors[fromCard.card.split('_')[1]];
    const targetColor = colors[targetCard.card.split('_')[1]];

    const fromRankIndex = ranks.indexOf(fromCard.card.split('_')[0]);
    const targetRankIndex = ranks.indexOf(targetCard.card.split('_')[0]);

    // Sikre at fargene er motsatte (rødt på svart eller svart på rødt) 
    // og at kortet er én rang lavere enn target-kortet
    return fromColor !== targetColor && fromRankIndex === targetRankIndex + 1;
}

    // Flytt kort mellom board-kolonner
    async moveBoardToBoard(fromColumnIndex, toColumnIndex, fromCardIndex) {
        const fromColumn = this.board[fromColumnIndex];
        const toColumn = this.board[toColumnIndex];

        // Hent ut kortene som skal flyttes
        const cardsToMove = fromColumn.slice(fromCardIndex);

        // Sjekk om det første kortet kan flyttes
        const firstCard = cardsToMove[0];
        if (!this.canMoveToBoard(firstCard, toColumn)) {
            return false;
        }

        // Fjern kortene fra opprinnelig kolonne
        fromColumn.splice(fromCardIndex);

        // Legg til kortene i ny kolonne
        toColumn.push(...cardsToMove);

        // Snu øverste kort i opprinnelig kolonne hvis nødvendig
        if (fromColumn.length > 0 && !fromColumn[fromColumn.length - 1].visible) {
            fromColumn[fromColumn.length - 1].visible = true;
        }

        // Øk antall trekk
        this.moves++;

        // Lagre spilltilstand
        await this.saveToDb();

        return true;
    }

    // Flytt et kort fra graveyard til board
    async moveGraveyardToBoard(toColumnIndex) {
        if (this.graveyard.length === 0) {
            return false;
        }

        const toColumn = this.board[toColumnIndex];
        const graveyardCard = this.graveyard[this.graveyard.length - 1];

        // Sjekk om kortet kan flyttes
        if (this.canMoveToBoard(graveyardCard, toColumn)) {
            // Fjern kortet fra graveyard
            this.graveyard.pop();

            // Legg til kortet i ny kolonne
            toColumn.push(graveyardCard);

            // Øk antall trekk
            this.moves++;

            // Lagre spilltilstand
            await this.saveToDb();

            return true;
        }

        return false;
    }

    // Valider om et kort kan flyttes til foundation
    canMoveToFoundation(card, foundationPile) {
        const ranks = ['ess', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'knekt', 'dame', 'konge'];

        // Første kort MÅ VÆRE et ess
        if (foundationPile.length === 0) {
            return card.card.split('_')[0] === 'ess';
        }

        const lastCard = foundationPile[foundationPile.length - 1];
        
        // Sjekk at det er samme farge
        const cardSuit = card.card.split('_')[1];
        const lastCardSuit = lastCard.card.split('_')[1];
        
        if (cardSuit !== lastCardSuit) {
            return false;
        }

        // Sjekk at det er neste kort i rekken
        const cardRank = card.card.split('_')[0];
        const lastCardRank = lastCard.card.split('_')[0];

        return ranks.indexOf(cardRank) === ranks.indexOf(lastCardRank) + 1;
    }

    // Flytt kort til foundation
    async moveToFoundation(sourceType, sourceIndex, foundationIndex) {
        let sourceCard;

        // Bestem kilde for kortet
        if (sourceType === 'board') {
            const sourceColumn = this.board[sourceIndex];
            sourceCard = sourceColumn[sourceColumn.length - 1];
        } else if (sourceType === 'graveyard') {
            sourceCard = this.graveyard[this.graveyard.length - 1];
        }

        // Valider om kortet kan flyttes til foundation
        const targetFoundation = this.foundation[foundationIndex];
        const isValidMove = this.canMoveToFoundation(sourceCard, targetFoundation);

        if (isValidMove) {
            // Fjern kortet fra kilden
            if (sourceType === 'board') {
                this.board[sourceIndex].pop();
                // Snu øverste kort hvis nødvendig
                if (this.board[sourceIndex].length > 0) {
                    const topCard = this.board[sourceIndex][this.board[sourceIndex].length - 1];
                    if (!topCard.visible) {
                        topCard.visible = true;
                    }
                }
            } else if (sourceType === 'graveyard') {
                this.graveyard.pop();
            }

            // Legg til i foundation
            this.foundation[foundationIndex].push(sourceCard);

            // Øk antall trekk
            this.moves++;

            // Sjekk om spillet er vunnet
            if (this.isGameWon()) {
                this.status = 'completed';
            }

            // Lagre spilltilstand
            await this.saveToDb();

            return true;
        }

        return false;
    }

    // Sjekk om spillet er vunnet
    isGameWon() {
        // Alle 4 foundation-bunker må ha 13 kort (fullstendig)
        return this.foundation.every(pile => pile.length === 13);
    }
    
    // Statisk metode for å laste et spill fra databasen
    static async loadFromDb(gameId) {
        try {
            console.log(`Forsøker å laste spill ${gameId} fra databasen`);
            const gameData = await db.loadGameState(gameId);
            
            if (!gameData) {
                console.log(`Ingen data funnet for spill ${gameId}`);
                return null;
            }
            
            const game = new SolitaireGame(gameId);
            game.status = gameData.status;
            game.moves = gameData.moves;
            game.startTime = gameData.startTime;
            game.library = gameData.library;
            game.graveyard = gameData.graveyard;
            game.board = gameData.board;
            game.foundation = gameData.foundation;
            
            console.log(`Spill ${gameId} lastet fra databasen`);
            return game;
        } catch (error) {
            console.error(`Feil ved lasting av spill ${gameId} fra databasen:`, error);
            throw error;
        }
    }
}