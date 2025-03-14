import express from 'express';
import cors from 'cors'; 
import session from 'express-session';
import dotenv from 'dotenv';
import solitaireRouter from './solitaireRouter.mjs';
import pool from './db.mjs';

// Load environment variables
dotenv.config();

const server = express();
const port = (process.env.PORT || 8000);

// session middleware with longer cookie maxAge for persistence
server.use(session({
    secret: process.env.SESSION_SECRET || 'Enferno7970',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: process.env.NODE_ENV === 'production', 
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
}));

server.set('port', port);
server.use(cors()); 
server.use(express.static('public'));
server.use(express.json()); 
server.use(express.urlencoded({extended: true}));
server.use('/api/solitaire', solitaireRouter);
server.use(express.static('public', {
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) {
            res.setHeader('Service-Worker-Allowed', '/');
        }
    }
}));

// Test database connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
    console.log('Server starting without database connection.');
  } else {
    console.log('Database connected successfully at:', res.rows[0].now);
  }
});

// Error handling middleware
server.use((err, req, res, next) => {
    console.error('Uventet feil:', err);
    res.status(500).json({
        error: 'En uventet feil oppstod',
        details: err.message
    });
});

// Existing routes from the original script.mjs
server.post('/temp/session', (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ error: 'Brukernavn er påkrevd' });
    }
    req.session.username = username;
    res.status(200).json({ message: 'Brukernavn lagret i session' });
});

server.get('/temp/session', (req, res) => {
    const username = req.session.username;
    if (!username) {
        return res.status(404).json({ error: 'Ingen brukerdata funnet i session' });
    }
    res.status(200).json({ username });
});

import { generateDeck, shuffleDeck } from './deckUtils.mjs';

let decks = {}; 

server.post('/temp/deck', (req, res) => {
    const deck_id = Date.now().toString();
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
    deck.cards = [...deck.cards, ...deck.drawn];
    deck.drawn = [];
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
    const card = deck.cards.pop();
    deck.drawn.push(card);
    res.status(200).json({ card });
});

// Start the server
server.listen(server.get('port'), () => {
    console.log('Server running on port', server.get('port'));
});