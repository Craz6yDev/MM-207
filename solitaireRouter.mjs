// solitaireRouter.mjs
import express from 'express';
import { generateDeck, shuffleDeck } from './deckUtils.mjs';
import { SolitaireGame } from './solitaireTypes.mjs';

const router = express.Router();

// Lagring av solitaire-spill
let solitaireGames = {};

// Opprett et nytt spill
router.post('/games', (req, res) => {
    const gameId = Date.now().toString();
    const game = new SolitaireGame(gameId);
    
    // Generer og stokk kortstokken
    const deck = shuffleDeck(generateDeck());
    
    // Initialiser spillet
    game.init(deck);
    
    // Lagre spillet
    solitaireGames[gameId] = game;
    
    // Lagre i session
    if (req.session) {
        req.session.solitaireGameId = gameId;
    }
    
    res.status(201).json({
        gameId: game.id,
        board: game.board,
        foundation: game.foundation,
        libraryCount: game.library.length,
        graveyardTop: game.graveyard.length > 0 ? game.graveyard[game.graveyard.length - 1] : null,
        moves: game.moves
    });
});

// Hent spilltilstand
router.get('/games/:gameId', (req, res) => {
    const gameId = req.params.gameId;
    const game = solitaireGames[gameId];
    
    if (!game) {
        return res.status(404).json({ error: 'Spill ikke funnet' });
    }
    
    res.status(200).json({
        gameId: game.id,
        board: game.board,
        foundation: game.foundation,
        libraryCount: game.library.length,
        graveyardTop: game.graveyard.length > 0 ? game.graveyard[game.graveyard.length - 1] : null,
        graveyard: game.graveyard,
        moves: game.moves,
        status: game.status,
        elapsedTime: Date.now() - game.startTime
    });
});

// Trekk fra biblioteket
router.post('/games/:gameId/draw', (req, res) => {
    const gameId = req.params.gameId;
    const game = solitaireGames[gameId];
    
    if (!game) {
        return res.status(404).json({ error: 'Spill ikke funnet' });
    }
    
    const success = game.drawFromLibrary();
    
    res.status(200).json({
        success,
        libraryCount: game.library.length,
        graveyardTop: game.graveyard.length > 0 ? game.graveyard[game.graveyard.length - 1] : null,
        moves: game.moves
    });
});

// Flytt kort fra graveyard til foundation
router.post('/games/:gameId/graveyard-to-foundation/:foundationIndex', (req, res) => {
    const gameId = req.params.gameId;
    const foundationIndex = parseInt(req.params.foundationIndex);
    const game = solitaireGames[gameId];
    
    if (!game) {
        return res.status(404).json({ error: 'Spill ikke funnet' });
    }
    
    if (isNaN(foundationIndex) || foundationIndex < 0 || foundationIndex > 3) {
        return res.status(400).json({ error: 'Ugyldig foundation-indeks' });
    }
    
    const success = game.moveGraveyardToFoundation(foundationIndex);
    
    res.status(200).json({
        success,
        foundation: game.foundation,
        graveyardTop: game.graveyard.length > 0 ? game.graveyard[game.graveyard.length - 1] : null,
        moves: game.moves,
        status: game.status
    });
});

// Flytt kort fra graveyard til board
router.post('/games/:gameId/graveyard-to-board/:boardIndex', (req, res) => {
    const gameId = req.params.gameId;
    const boardIndex = parseInt(req.params.boardIndex);
    const game = solitaireGames[gameId];
    
    if (!game) {
        return res.status(404).json({ error: 'Spill ikke funnet' });
    }
    
    if (isNaN(boardIndex) || boardIndex < 0 || boardIndex > 6) {
        return res.status(400).json({ error: 'Ugyldig board-indeks' });
    }
    
    const success = game.moveGraveyardToBoard(boardIndex);
    
    res.status(200).json({
        success,
        board: game.board,
        graveyardTop: game.graveyard.length > 0 ? game.graveyard[game.graveyard.length - 1] : null,
        moves: game.moves
    });
});

// Flytt kort fra board til foundation
router.post('/games/:gameId/board-to-foundation/:boardIndex/:foundationIndex', (req, res) => {
    const gameId = req.params.gameId;
    const boardIndex = parseInt(req.params.boardIndex);
    const foundationIndex = parseInt(req.params.foundationIndex);
    const game = solitaireGames[gameId];
    
    if (!game) {
        return res.status(404).json({ error: 'Spill ikke funnet' });
    }
    
    if (isNaN(boardIndex) || boardIndex < 0 || boardIndex > 6) {
        return res.status(400).json({ error: 'Ugyldig board-indeks' });
    }
    
    if (isNaN(foundationIndex) || foundationIndex < 0 || foundationIndex > 3) {
        return res.status(400).json({ error: 'Ugyldig foundation-indeks' });
    }
    
    const success = game.moveBoardToFoundation(boardIndex, foundationIndex);
    
    res.status(200).json({
        success,
        board: game.board,
        foundation: game.foundation,
        moves: game.moves,
        status: game.status
    });
});

// Flytt kort fra board til board
router.post('/games/:gameId/board-to-board/:fromIndex/:toIndex/:cardIndex', (req, res) => {
    const gameId = req.params.gameId;
    const fromIndex = parseInt(req.params.fromIndex);
    const toIndex = parseInt(req.params.toIndex);
    const cardIndex = parseInt(req.params.cardIndex);
    const game = solitaireGames[gameId];
    
    if (!game) {
        return res.status(404).json({ error: 'Spill ikke funnet' });
    }
    
    if (isNaN(fromIndex) || fromIndex < 0 || fromIndex > 6) {
        return res.status(400).json({ error: 'Ugyldig kilde-board-indeks' });
    }
    
    if (isNaN(toIndex) || toIndex < 0 || toIndex > 6) {
        return res.status(400).json({ error: 'Ugyldig mål-board-indeks' });
    }
    
    if (isNaN(cardIndex) || cardIndex < 0) {
        return res.status(400).json({ error: 'Ugyldig kort-indeks' });
    }
    
    const success = game.moveBoardToBoard(fromIndex, toIndex, cardIndex);
    
    res.status(200).json({
        success,
        board: game.board,
        moves: game.moves
    });
});

export default router;