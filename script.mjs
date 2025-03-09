import express from 'express';
import cors from 'cors'; // Importer cors-pakken

const server = express();
const port = (process.env.PORT || 8000);

server.set('port', port);
server.use(cors()); // Aktiver CORS for alle ruter
server.use(express.static('public'));
server.use(express.json()); // For å håndtere JSON i POST/PATCH

// Data for kortstokker
let decks = {}; // { deck_id: { cards: [array of cards], drawn: [array of drawn cards] } }

// Hjelpefunksjon for å generere en kortstokk
function generateDeck() {
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

// POST /temp/deck
server.post('/temp/deck', (req, res) => {
    const deck_id = Date.now().toString(); // Bruker tidsstempel som unik ID
    const deck = generateDeck();
    decks[deck_id] = { cards: deck, drawn: [] };
    res.status(200).json({ deck_id });
});

// PATCH /temp/deck/shuffle/:deck_id
server.patch('/temp/deck/shuffle/:deck_id', (req, res) => {
    const deck_id = req.params.deck_id;
    if (!decks[deck_id]) {
        return res.status(404).json({ error: 'Kortstokk ikke funnet' });
    }
    const deck = decks[deck_id];
    deck.cards = [...deck.cards, ...deck.drawn]; // Legg tilbake trukkede kort
    deck.drawn = [];
    // Stokker kortstokken
    for (let i = deck.cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck.cards[i], deck.cards[j]] = [deck.cards[j], deck.cards[i]];
    }
    res.status(200).json({ message: 'Kortstokken er stokket' });
});

// GET /temp/deck/:deck_id
server.get('/temp/deck/:deck_id', (req, res) => {
    const deck_id = req.params.deck_id;
    if (!decks[deck_id]) {
        return res.status(404).json({ error: 'Kortstokk ikke funnet' });
    }
    res.status(200).json({ cards: decks[deck_id].cards });
});

// GET /temp/deck/:deck_id/card
server.get('/temp/deck/:deck_id/card', (req, res) => {
    const deck_id = req.params.deck_id;
    if (!decks[deck_id]) {
        return res.status(404).json({ error: 'Kortstokk ikke funnet' });
    }
    const deck = decks[deck_id];
    if (deck.cards.length === 0) {
        return res.status(400).json({ error: 'Ingen kort igjen i kortstokken' });
    }
    const card = deck.cards.pop(); // Trekker et kort
    deck.drawn.push(card); // Legger til i trukkede kort
    res.status(200).json({ card });
});

server.listen(server.get('port'), () => {
    console.log('Server running on port', server.get('port'));
});