
// Type for solitaire-spill
export class SolitaireGame {
    constructor(id) {
        this.id = id;
        this.board = Array(7).fill().map(() => []); // 7 kolonner med kort (tidligere tableau)
        this.foundation = Array(4).fill().map(() => []); // 4 fundamenter (ess-stablene)
        this.library = []; // Kortstokken (tidligere stock)
        this.graveyard = []; // Kastet kort (tidligere waste)
        this.moves = 0; // Antall trekk
        this.startTime = Date.now(); // Starttidspunkt
        this.status = 'active'; // active, completed
    }
    
    // Initialiser spillet
    init(deck) {
        // Kopier kortstokken
        const deckCopy = [...deck];
        
        // Del ut kort til board (7 kolonner)
        for (let i = 0; i < 7; i++) {
            for (let j = 0; j <= i; j++) {
                const card = deckCopy.pop();
                
                // Sist utdelte kort i hver kolonne er synlig
                if (j === i) {
                    // Legg til 'visible:true' til kortene som skal være synlige
                    this.board[i].push({ card, visible: true });
                } else {
                    this.board[i].push({ card, visible: false });
                }
            }
        }
        
        // Resten av kortene går til library (kortstokken)
        this.library = deckCopy.map(card => ({ card, visible: false }));
    }
    
    // Snu kort fra library til graveyard
    drawFromLibrary() {
        if (this.library.length === 0) {
            // Hvis library er tom, flytt alle kort fra graveyard tilbake til library
            if (this.graveyard.length > 0) {
                this.library = [...this.graveyard].reverse();
                this.graveyard = [];
                this.library.forEach(card => card.visible = false);
                return true;
            }
            return false;
        }
        
        // Flytt et kort fra library til graveyard
        const card = this.library.pop();
        card.visible = true;
        this.graveyard.push(card);
        this.moves++;
        return true;
    }
    
    // Flytt kort fra graveyard til foundation
    moveGraveyardToFoundation(foundationIndex) {
        if (this.graveyard.length === 0) return false;
        
        const card = this.graveyard[this.graveyard.length - 1];
        if (this.canAddToFoundation(card.card, foundationIndex)) {
            this.foundation[foundationIndex].push(this.graveyard.pop());
            this.moves++;
            this.checkWinCondition();
            return true;
        }
        
        return false;
    }
    
    // Flytt kort fra graveyard til board
    moveGraveyardToBoard(boardIndex) {
        if (this.graveyard.length === 0) return false;
        
        const card = this.graveyard[this.graveyard.length - 1];
        if (this.canAddToBoard(card.card, boardIndex)) {
            this.board[boardIndex].push(this.graveyard.pop());
            this.moves++;
            return true;
        }
        
        return false;
    }
    
    // Flytt kort fra board til foundation
    moveBoardToFoundation(boardIndex, foundationIndex) {
        const boardStack = this.board[boardIndex];
        if (boardStack.length === 0) return false;
        
        const card = boardStack[boardStack.length - 1];
        if (!card.visible) return false;
        
        if (this.canAddToFoundation(card.card, foundationIndex)) {
            this.foundation[foundationIndex].push(boardStack.pop());
            
            // Snu det øverste kortet i board-kolonnen hvis det er noen kort igjen
            if (boardStack.length > 0 && !boardStack[boardStack.length - 1].visible) {
                boardStack[boardStack.length - 1].visible = true;
            }
            
            this.moves++;
            this.checkWinCondition();
            return true;
        }
        
        return false;
    }
    
    // Flytt kort fra board til board
    moveBoardToBoard(fromIndex, toIndex, cardIndex) {
        const fromStack = this.board[fromIndex];
        
        if (fromStack.length === 0 || cardIndex >= fromStack.length) return false;
        
        // Sjekk om kortet og alle under det er synlige
        if (!fromStack[cardIndex].visible) return false;
        
        const movingCards = fromStack.splice(cardIndex);
        const firstCard = movingCards[0].card;
        
        if (this.canAddToBoard(firstCard, toIndex)) {
            this.board[toIndex] = [...this.board[toIndex], ...movingCards];
            
            // Snu det øverste kortet i kildekolonnen hvis det er noen kort igjen
            if (fromStack.length > 0 && !fromStack[fromStack.length - 1].visible) {
                fromStack[fromStack.length - 1].visible = true;
            }
            
            this.moves++;
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
        
        // Konverter kortverdi til tall
        const cardValues = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'knekt', 'dame', 'konge', 'ess'];
        const valueIndex = cardValues.indexOf(value);
        
        if (foundation.length === 0) {
            // Kun ess kan starte et fundament
            return value === 'ess';
        }
        
        const topCard = foundation[foundation.length - 1].card;
        const [topValue, topSuit] = topCard.split('_');
        const topValueIndex = cardValues.indexOf(topValue);
        
        // Kort må være samme sort og en verdi høyere
        return suit === topSuit && valueIndex === topValueIndex + 1;
    }
    
    // Sjekk om et kort kan legges til en board-kolonne
    canAddToBoard(card, boardIndex) {
        const [value, suit] = card.split('_');
        const board = this.board[boardIndex];
        
        // Konverter kortverdi til tall
        const cardValues = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'knekt', 'dame', 'konge', 'ess'];
        const valueIndex = cardValues.indexOf(value);
        
        if (board.length === 0) {
            // Kun konger kan starte en tom kolonne
            return value === 'konge';
        }
        
        const topCard = board[board.length - 1].card;
        const [topValue, topSuit] = topCard.split('_');
        const topValueIndex = cardValues.indexOf(topValue);
        
        // Sort må være motsatt og en verdi lavere
        const isRedSuit = suit === 'hjerter' || suit === 'ruter';
        const isTopRedSuit = topSuit === 'hjerter' || topSuit === 'ruter';
        
        return isRedSuit !== isTopRedSuit && valueIndex === topValueIndex - 1;
    }
    
    // Sjekk om spillet er vunnet
    checkWinCondition() {
        // Spillet er vunnet når alle fundamental-stablene har 13 kort (hele sorten fra ess til konge)
        const isWon = this.foundation.every(f => f.length === 13);
        
        if (isWon) {
            this.status = 'completed';
        }
        
        return isWon;
    }
}