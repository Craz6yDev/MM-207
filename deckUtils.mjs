// deckUtils.mjs

// Generer en kortstokk
export function generateDeck() {
    const suits = ['hjerter', 'spar', 'ruter', 'kløver'];
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'knekt', 'dame', 'konge', 'ess'];
    let deck = [];
    for (let suit of suits) {
        for (let value of values) {
            deck.push(`${value}_${suit}`);
        }
    }
    return deck;
}

// Stokke kortstokken
export function shuffleDeck(deck) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}