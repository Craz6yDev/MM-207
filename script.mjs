server.get('/', (req, res) => {
    res.redirect('/solitaire.html');
  });
import express from 'express';
import cors from 'cors'; 
import session from 'express-session';
import solitaireRouter from './solitaireRouter.mjs';

const server = express();
const port = (process.env.PORT || 8000);

// session middleware
server.use(session({
    secret: 'Enferno7970', // nøkkel for å signere session ID
    resave: false, // Unngå å lagre session hvis den ikke er endret
    saveUninitialized: true, // lagre nye sessions selv om de ikke er endret
    cookie: { secure: false } // true hvis man bruker HTTPS
}));

server.set('port', port);
server.use(cors()); // Aktiver cors
server.use(express.static('public'));
server.use(express.json()); 

// POST /temp/session
server.post('/temp/session', (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ error: 'Brukernavn er påkrevd' });
    }
    req.session.username = username; // Lagre brukernavn i session
    res.status(200).json({ message: 'Brukernavn lagret i session' });
});

// GET /temp/session
server.get('/temp/session', (req, res) => {
    const username = req.session.username;
    if (!username) {
        return res.status(404).json({ error: 'Ingen brukerdata funnet i session' });
    }
    res.status(200).json({ username });
});

let decks = {}; 

// generere en kortstokk
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

// stokke kortstokken
export function shuffleDeck(deck) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

server.post('/temp/deck', (req, res) => {
    const deck_id = Date.now().toString(); // Bruker tidsstempel som unik ID
    const deck = generateDeck();
    decks[deck_id] = { cards: deck, drawn: [] };
    res.status(200).json({ deck_id });
});

server.patch('/temp/deck/shuffle/:deck_id', (req, res) => {
    const deck_id = req.params.deck_id;
    if (!decks[deck_id]) {
        return res.status(404).json({ error: 'Kortstokk ikke funnet' });
    }
    const deck = decks[deck_id];
    deck.cards = [...deck.cards, ...deck.drawn]; // Legg tilbake trukkede kort
    deck.drawn = [];
    // Stokker kortstokken
    deck.cards = shuffleDeck(deck.cards);
    res.status(200).json({ message: 'Kortstokken er stokket' });
});

server.get('/temp/deck/:deck_id', (req, res) => {
    const deck_id = req.params.deck_id;
    if (!decks[deck_id]) {
        return res.status(404).json({ error: 'Kortstokk ikke funnet' });
    }
    res.status(200).json({ cards: decks[deck_id].cards });
});

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

// Bruk solitaire-routeren
server.use('/api/solitaire', solitaireRouter);

server.listen(server.get('port'), () => {
    console.log('Server running on port', server.get('port'));
});