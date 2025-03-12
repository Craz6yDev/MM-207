import express from 'express';
import { generateDeck, shuffleDeck } from './deckUtils.mjs'; // Importer kortstokk-funksjoner

const router = express.Router();

// Midlertidig lagring av poker-spill
let pokerGames = {};

// POST /poker - Opprett et nytt poker-spill
router.post('/', (req, res) => {
    const gameId = Date.now().toString();
    pokerGames[gameId] = {
        id: gameId,
        players: [],
        deck: generateDeck(), // Ny kortstokk
        board: []
    };
    res.status(201).json(pokerGames[gameId]);
});

// PATCH /poker/:gameId/deck - Stokke kortstokken
router.patch('/:gameId/deck', (req, res) => {
    const gameId = req.params.gameId;
    if (!pokerGames[gameId]) {
        return res.status(404).json({ error: 'Spill ikke funnet' });
    }
    pokerGames[gameId].deck = shuffleDeck(pokerGames[gameId].deck); // Stokke kortstokken
    res.status(200).json(pokerGames[gameId]);
});

// GET /poker/:gameId - Hent detaljer om et poker-spill
router.get('/:gameId', (req, res) => {
    const gameId = req.params.gameId;
    const game = pokerGames[gameId];
    if (!game) {
        return res.status(404).json({ error: 'Spill ikke funnet' });
    }
    res.status(200).json(game);
});

// PUT /poker/:gameId/players - Legg til eller oppdater spillere
router.put('/:gameId/players', (req, res) => {
    const gameId = req.params.gameId;
    const { player } = req.body;
    if (!pokerGames[gameId]) {
        return res.status(404).json({ error: 'Spill ikke funnet' });
    }
    pokerGames[gameId].players.push(player);
    res.status(200).json(pokerGames[gameId]);
});

// DELETE /poker/:gameId - Slett et poker-spill
router.delete('/:gameId', (req, res) => {
    const gameId = req.params.gameId;
    if (!pokerGames[gameId]) {
        return res.status(404).json({ error: 'Spill ikke funnet' });
    }
    delete pokerGames[gameId];
    res.status(200).json({ message: 'Spill slettet' });
});

export default router;