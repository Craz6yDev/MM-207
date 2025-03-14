// solitaireRouter.mjs
import express from 'express';
import { generateDeck, shuffleDeck } from './deckUtils.mjs';
import { SolitaireGame } from './solitaireTypes.mjs';
import * as db from './solitaireDb.mjs';
const router = express.Router();

let solitaireGames = {};


const gameExists = async (req, res, next) => {
    const gameId = req.params.gameId;
    

    if (solitaireGames[gameId]) {
        req.game = solitaireGames[gameId];
        return next();
    }
    

    try {
        const game = await SolitaireGame.loadFromDb(gameId);
        if (game) {
            solitaireGames[gameId] = game;
            req.game = game;
            return next();
        }
        
        return res.status(404).json({ error: 'Spill ikke funnet' });
    } catch (error) {
        console.error('Error loading game:', error);
        return res.status(500).json({ error: 'Feil ved lasting av spill' });
    }
};

// Opprett et nytt spill
router.post('/games', async (req, res) => {
    try {
        const gameId = Date.now().toString();
        const game = new SolitaireGame(gameId);
        const deck = shuffleDeck(generateDeck());
        
        await game.init(deck);

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
    } catch (error) {
        console.error('Error creating game:', error);
        res.status(500).json({ error: 'Feil ved opprettelse av spill' });
    }
});

router.get('/games/:gameId', gameExists, (req, res) => {
    const game = req.game;
    
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

router.post('/games/:gameId/draw', gameExists, async (req, res) => {
    try {
        const game = req.game;
        const success = await game.drawFromLibrary();
        
        res.status(200).json({
            success,
            libraryCount: game.library.length,
            graveyardTop: game.graveyard.length > 0 ? game.graveyard[game.graveyard.length - 1] : null,
            moves: game.moves
        });
    } catch (error) {
        console.error('Error drawing card:', error);
        res.status(500).json({ error: 'Feil ved trekking av kort' });
    }
});

// Flytt kort fra graveyard til foundation
router.post('/games/:gameId/graveyard-to-foundation/:foundationIndex', gameExists, async (req, res) => {
    try {
        const game = req.game;
        const foundationIndex = parseInt(req.params.foundationIndex);
        
        if (isNaN(foundationIndex) || foundationIndex < 0 || foundationIndex > 3) {
            return res.status(400).json({ error: 'Ugyldig foundation-indeks' });
        }
        
        const success = await game.moveGraveyardToFoundation(foundationIndex);
        
        res.status(200).json({
            success,
            foundation: game.foundation,
            graveyardTop: game.graveyard.length > 0 ? game.graveyard[game.graveyard.length - 1] : null,
            moves: game.moves,
            status: game.status
        });
    } catch (error) {
        console.error('Error moving card from graveyard to foundation:', error);
        res.status(500).json({ error: 'Feil ved flytting av kort' });
    }
});

// Flytt kort fra graveyard til board
router.post('/games/:gameId/graveyard-to-board/:boardIndex', gameExists, async (req, res) => {
    try {
        const game = req.game;
        const boardIndex = parseInt(req.params.boardIndex);
        
        if (isNaN(boardIndex) || boardIndex < 0 || boardIndex > 6) {
            return res.status(400).json({ error: 'Ugyldig board-indeks' });
        }
        
        const success = await game.moveGraveyardToBoard(boardIndex);
        
        res.status(200).json({
            success,
            board: game.board,
            graveyardTop: game.graveyard.length > 0 ? game.graveyard[game.graveyard.length - 1] : null,
            moves: game.moves
        });
    } catch (error) {
        console.error('Error moving card from graveyard to board:', error);
        res.status(500).json({ error: 'Feil ved flytting av kort' });
    }
});

// Flytt kort fra board til foundation
router.post('/games/:gameId/board-to-foundation/:boardIndex/:foundationIndex', gameExists, async (req, res) => {
    try {
        const game = req.game;
        const boardIndex = parseInt(req.params.boardIndex);
        const foundationIndex = parseInt(req.params.foundationIndex);
        
        if (isNaN(boardIndex) || boardIndex < 0 || boardIndex > 6) {
            return res.status(400).json({ error: 'Ugyldig board-indeks' });
        }
        
        if (isNaN(foundationIndex) || foundationIndex < 0 || foundationIndex > 3) {
            return res.status(400).json({ error: 'Ugyldig foundation-indeks' });
        }
        
        const success = await game.moveBoardToFoundation(boardIndex, foundationIndex);
        
        res.status(200).json({
            success,
            board: game.board,
            foundation: game.foundation,
            moves: game.moves,
            status: game.status
        });
    } catch (error) {
        console.error('Error moving card from board to foundation:', error);
        res.status(500).json({ error: 'Feil ved flytting av kort' });
    }
});

// Flytt kort fra board til board
router.post('/games/:gameId/board-to-board/:fromIndex/:toIndex/:cardIndex', gameExists, async (req, res) => {
    try {
        const game = req.game;
        const fromIndex = parseInt(req.params.fromIndex);
        const toIndex = parseInt(req.params.toIndex);
        const cardIndex = parseInt(req.params.cardIndex);
        
        if (isNaN(fromIndex) || fromIndex < 0 || fromIndex > 6) {
            return res.status(400).json({ error: 'Ugyldig kilde-board-indeks' });
        }
        
        if (isNaN(toIndex) || toIndex < 0 || toIndex > 6) {
            return res.status(400).json({ error: 'Ugyldig mål-board-indeks' });
        }
        
        if (isNaN(cardIndex) || cardIndex < 0) {
            return res.status(400).json({ error: 'Ugyldig kort-indeks' });
        }
        
        const success = await game.moveBoardToBoard(fromIndex, toIndex, cardIndex);
        
        res.status(200).json({
            success,
            board: game.board,
            moves: game.moves
        });
    } catch (error) {
        console.error('Error moving card from board to board:', error);
        res.status(500).json({ error: 'Feil ved flytting av kort' });
    }
});

// Endepunkt for å lagre et spill med et navn
router.post('/games/:gameId/save', gameExists, async (req, res) => {
    try {
        const game = req.game;
        const { saveName } = req.body;
        
        if (!saveName) {
            return res.status(400).json({ 
                error: 'Mangler navn på lagringen',
                success: false
            });
        }
        
        const sessionId = req.session.id;
        await db.saveGameToSession(game.id, sessionId, saveName);
        
        res.status(200).json({
            message: 'Spill lagret',
            saveName,
            gameId: game.id,
            success: true
        });
    } catch (error) {
        console.error('Error saving game:', error);
        res.status(500).json({
            error: 'Feil ved lagring av spill',
            success: false
        });
    }
});

// Hent alle lagrede spill for denne brukeren
router.get('/saves', async (req, res) => {
    try {
        const sessionId = req.session.id;
        const savedGames = await db.getSavedGamesForSession(sessionId);
        
        res.status(200).json({ saves: savedGames });
    } catch (error) {
        console.error('Error fetching saved games:', error);
        res.status(500).json({ error: 'Feil ved henting av lagrede spill' });
    }
});

// Slett et lagret spill
router.delete('/saves/:saveName', async (req, res) => {
    try {
        const { saveName } = req.params;
        const sessionId = req.session.id;
        
        const deleted = await db.deleteSavedGame(sessionId, saveName);
        
        if (!deleted) {
            return res.status(404).json({ error: 'Lagret spill ikke funnet' });
        }
        
        res.status(200).json({ message: 'Lagret spill slettet' });
    } catch (error) {
        console.error('Error deleting saved game:', error);
        res.status(500).json({ error: 'Feil ved sletting av lagret spill' });
    }
});

export default router;