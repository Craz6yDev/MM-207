
import * as db from './solitaireDb.mjs';
export class SolitaireGame {
    constructor(id) {
        this.id = id;
        this.board = Array(7).fill().map(() => []); // 7 kolonner med kort 
        this.foundation = Array(4).fill().map(() => []); // 4
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

        // Save initial state to database
        await db.createGame(this.id, this.status);
        await this.saveToDb();
    }
    
    async saveToDb() {
        return db.saveGameState({
            id: this.id,
            status: this.status,
            moves: this.moves,
            startTime: this.startTime,
            library: this.library,
            graveyard: this.graveyard,
            board: this.board,
            foundation: this.foundation
        });
    }

    // fra library til graveyard
   async drawFromLibrary() {
        if (this.library.length === 0) {
            if (this.graveyard.length > 0) {
                this.library = [...this.graveyard].reverse();
                this.graveyard = [];
                this.library.forEach(card => card.visible = false);
                await this.saveToDb();
                return true;
            }
            return false;
        }

        const card = this.library.pop();
        card.visible = true;
        this.graveyard.push(card);
        this.moves++;
        await db.incrementMoves(this.id);
        await this.saveToDb();
        return true;
    }
    
    // Flytt kort fra graveyard til foundation
   async moveGraveyardToFoundation(foundationIndex) {
        if (this.graveyard.length === 0) return false;
        
        const card = this.graveyard[this.graveyard.length - 1];
        if (this.canAddToFoundation(card.card, foundationIndex)) {
            this.foundation[foundationIndex].push(this.graveyard.pop());
            this.moves++;
            await db.incrementMoves(this.id);
            this.checkWinCondition();
            await this.saveToDb();
            return true;
        }
        
        return false;
    }
    
    // Flytt kort fra graveyard til board
   async moveGraveyardToBoard(boardIndex) {
        if (this.graveyard.length === 0) return false;
        
        const card = this.graveyard[this.graveyard.length - 1];
        if (this.canAddToBoard(card.card, boardIndex)) {
            this.board[boardIndex].push(this.graveyard.pop());
            this.moves++;
            await db.incrementMoves(this.id);
            await this.saveToDb();
            return true;
        }
        
        return false;
    }
    
    // Flytt kort fra board til foundation
   async moveBoardToFoundation(boardIndex, foundationIndex) {
        const boardStack = this.board[boardIndex];
        if (boardStack.length === 0) return false;
        
        const card = boardStack[boardStack.length - 1];
        if (!card.visible) return false;
        
        if (this.canAddToFoundation(card.card, foundationIndex)) {
            this.foundation[foundationIndex].push(boardStack.pop());
            
        
            if (boardStack.length > 0 && !boardStack[boardStack.length - 1].visible) {
                boardStack[boardStack.length - 1].visible = true;
            }
            
            this.moves++;
            await db.incrementMoves(this.id);
            this.checkWinCondition();
            await this.saveToDb();
            return true;
        }
        
        return false;
    }
    
    // Flytt kort fra board til board
   async moveBoardToBoard(fromIndex, toIndex, cardIndex) {
        const fromStack = this.board[fromIndex];
        
        if (fromStack.length === 0 || cardIndex >= fromStack.length) return false;

        if (!fromStack[cardIndex].visible) return false;
        
        const movingCards = fromStack.splice(cardIndex);
        const firstCard = movingCards[0].card;
        
        if (this.canAddToBoard(firstCard, toIndex)) {
            this.board[toIndex] = [...this.board[toIndex], ...movingCards];
            
            if (fromStack.length > 0 && !fromStack[fromStack.length - 1].visible) {
                fromStack[fromStack.length - 1].visible = true;
            }
            
            this.moves++;
            await db.incrementMoves(this.id);
            await this.saveToDb();
            return true;
        } else {
            // Legg kortene tilbake hvis de ikke kan flyttes
            this.board[fromIndex] = [...fromStack, ...movingCards];
            return false;
        }
    }
    
  // Sjekk om et kort kan legges til et fundament
canAddToFoundation(card, foundationIndex) {
    const [value, suit] = card.split('_');
    const foundation = this.foundation[foundationIndex];
    
    // Bruk korrekt rekkefølge for solitaire 
    const cardValues = ['ess', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'knekt', 'dame', 'konge'];
    const valueIndex = cardValues.indexOf(value);
    
    if (foundation.length === 0) {
        return value === 'ess';
    }
    
    const topCard = foundation[foundation.length - 1].card;
    const [topValue, topSuit] = topCard.split('_');
    const topValueIndex = cardValues.indexOf(topValue);
    return suit === topSuit && valueIndex === topValueIndex + 1;
}
    
// Sjekk om et kort kan legges til en board-kolonne
canAddToBoard(card, boardIndex) {
    const [value, suit] = card.split('_');
    const board = this.board[boardIndex];
    const cardValues = ['konge', 'dame', 'knekt', '10', '9', '8', '7', '6', '5', '4', '3', '2', 'ess'];
    const valueIndex = cardValues.indexOf(value);
    
    if (board.length === 0) {
        // Kun konger kan starte en tom kolonne
        return value === 'konge';
    }
    
    const topCard = board[board.length - 1].card;
    const [topValue, topSuit] = topCard.split('_');
    const topValueIndex = cardValues.indexOf(topValue);
    const isRedSuit = suit === 'hjerter' || suit === 'ruter';
    const isTopRedSuit = topSuit === 'hjerter' || topSuit === 'ruter';
    
    return isRedSuit !== isTopRedSuit && valueIndex === topValueIndex + 1;
}
    
    checkWinCondition() {
        // Spillet er vunnet når alle fundamental-stablene har 13 kort
        const isWon = this.foundation.every(f => f.length === 13);
        
        if (isWon) {
            this.status = 'completed';
        }
        
        return isWon;
    }
}