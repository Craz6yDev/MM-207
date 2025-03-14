// solitaireRouter.mjs
import express from 'express';
import { generateDeck, shuffleDeck } from './deckUtils.mjs';
import { SolitaireGame } from './solitaireTypes.mjs';
import * as db from './solitaireDb.mjs';
import { pool } from './dbSetup.mjs';

const router = express.Router();
let solitaireGames = {};  // Cache for aktive spill

// Middleware for å sjekke om et spill eksisterer
const gameExists = async (req, res, next) => {
    const gameId = req.params.gameId;
    
    console.log(`Sjekker om spill ${gameId} eksisterer`);
    
    // Sjekk om spillet er i minnet
    if (solitaireGames[gameId]) {
        req.game = solitaireGames[gameId];
        return next();
    }
    
    // Prøv å laste fra databasen
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

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Ikke innlogget. Vennligst logg inn for å fortsette.' });
  }
  next();
};

// Opprett et nytt spill
router.post('/games', async (req, res) => {
    try {
        const gameId = Date.now().toString();
        console.log(`Oppretter nytt spill med ID: ${gameId}`);
        
        const game = new SolitaireGame(gameId);
        const deck = shuffleDeck(generateDeck());
        
        await game.init(deck);
        
        // Cache spillet i minnet
        solitaireGames[gameId] = game;
        
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

// Trekk kort fra library
router.post('/games/:gameId/draw', gameExists, async (req, res) => {
    try {
        const game = req.game;
        
        const drawResult = await game.drawFromLibrary();
        
        if (drawResult) {
            res.json({
                success: true,
                libraryCount: game.library.length,
                graveyardTop: game.graveyard.length > 0 ? game.graveyard[game.graveyard.length - 1] : null,
                moves: game.moves
            });
        } else {
            res.status(400).json({ error: 'Kunne ikke trekke kort' });
        }
    } catch (error) {
        console.error('Feil ved trekking av kort:', error);
        res.status(500).json({ error: 'Kunne ikke trekke kort' });
    }
});

// Flytt fra board til foundation
router.post('/games/:gameId/board-to-foundation/:boardIndex/:foundationIndex', gameExists, async (req, res) => {
    try {
        const game = req.game;
        const { boardIndex, foundationIndex } = req.params;
        
        const moveResult = await game.moveToFoundation('board', parseInt(boardIndex), parseInt(foundationIndex));
        
        if (moveResult) {
            res.json({
                success: true,
                board: game.board,
                foundation: game.foundation,
                moves: game.moves
            });
        } else {
            res.status(400).json({ error: 'Kunne ikke flytte kort' });
        }
    } catch (error) {
        console.error('Feil ved flytting av kort til foundation:', error);
        res.status(500).json({ error: 'Kunne ikke flytte kort' });
    }
});

// Flytt fra board til board
router.post('/games/:gameId/board-to-board/:fromIndex/:toIndex/:cardIndex', gameExists, async (req, res) => {
    try {
        const game = req.game;
        const { fromIndex, toIndex, cardIndex } = req.params;
        
        const moveResult = await game.moveBoardToBoard(
            parseInt(fromIndex), 
            parseInt(toIndex), 
            parseInt(cardIndex)
        );
        
        if (moveResult) {
            res.json({
                success: true,
                board: game.board,
                moves: game.moves
            });
        } else {
            res.status(400).json({ error: 'Kunne ikke flytte kort' });
        }
    } catch (error) {
        console.error('Feil ved flytting av kort mellom board-kolonner:', error);
        res.status(500).json({ error: 'Kunne ikke flytte kort' });
    }
});

// Flytt fra graveyard til board
router.post('/games/:gameId/graveyard-to-board/:toIndex', gameExists, async (req, res) => {
    try {
        const game = req.game;
        const { toIndex } = req.params;
        
        const moveResult = await game.moveGraveyardToBoard(parseInt(toIndex));
        
        if (moveResult) {
            res.json({
                success: true,
                board: game.board,
                graveyardTop: game.graveyard.length > 0 ? game.graveyard[game.graveyard.length - 1] : null,
                moves: game.moves
            });
        } else {
            res.status(400).json({ error: 'Kunne ikke flytte kort' });
        }
    } catch (error) {
        console.error('Feil ved flytting av kort fra graveyard til board:', error);
        res.status(500).json({ error: 'Kunne ikke flytte kort' });
    }
});

// Flytt fra graveyard til foundation
router.post('/games/:gameId/graveyard-to-foundation/:foundationIndex', gameExists, async (req, res) => {
    try {
        const game = req.game;
        const { foundationIndex } = req.params;
        
        const moveResult = await game.moveToFoundation('graveyard', null, parseInt(foundationIndex));
        
        if (moveResult) {
            res.json({
                success: true,
                foundation: game.foundation,
                graveyardTop: game.graveyard.length > 0 ? game.graveyard[game.graveyard.length - 1] : null,
                moves: game.moves
            });
        } else {
            res.status(400).json({ error: 'Kunne ikke flytte kort' });
        }
    } catch (error) {
        console.error('Feil ved flytting av kort fra graveyard til foundation:', error);
        res.status(500).json({ error: 'Kunne ikke flytte kort' });
    }
});

// Hent spillstatus
router.get('/games/:gameId', gameExists, async (req, res) => {
    const game = req.game;
    
    res.json({
        gameId: game.id,
        board: game.board,
        foundation: game.foundation,
        libraryCount: game.library.length,
        graveyardTop: game.graveyard.length > 0 ? game.graveyard[game.graveyard.length - 1] : null,
        moves: game.moves,
        status: game.status
    });
});

// Endepunkt for å lagre et spill med et navn
router.post('/games/:gameId/save', [gameExists, isAuthenticated], async (req, res) => {
    try {
        const game = req.game;
        const { saveName } = req.body;
        
        if (!saveName) {
            return res.status(400).json({ 
                error: 'Mangler navn på lagringen',
                success: false
            });
        }
        
        console.log(`Lagrer spill ${game.id} med navn "${saveName}" for bruker ${req.session.userId}`);
        
        // Lagre til databasen med bruker-ID
        const userId = req.session.userId;
        await db.saveGameToUser(game.id, userId, saveName);
        
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

router.post('/games/:savedGameId/load', isAuthenticated, async (req, res) => {
    try {
        const { savedGameId } = req.params;
        const userId = req.session.userId;
        
        console.log(`Forsøker å laste spill med saved game ID: ${savedGameId} for bruker ${userId}`);
        
        // Hent først spillets faktiske game_id fra saved_games-tabellen
        const savedGameResult = await pool.query(
            'SELECT game_id, save_name FROM saved_games WHERE id = $1 AND user_id = $2',
            [savedGameId, userId]
        );
        
        if (savedGameResult.rows.length === 0) {
            console.log(`Ingen lagring funnet med ID ${savedGameId} for bruker ${userId}`);
            return res.status(404).json({ error: 'Lagret spill ikke funnet' });
        }
        
        // Dette er den faktiske game_id som henviser til et spill i games-tabellen
        const gameId = savedGameResult.rows[0].game_id;
        const saveName = savedGameResult.rows[0].save_name;
        
        console.log(`Fant game_id ${gameId} for saved game ID ${savedGameId}`);
        
        // Verifiser at spillet eksisterer i games-tabellen
        const gameExists = await pool.query('SELECT id FROM games WHERE id = $1', [gameId]);
        if (gameExists.rows.length === 0) {
            console.log(`Spill med ID ${gameId} eksisterer ikke i games-tabellen`);
            return res.status(404).json({ error: 'Spill ikke funnet i databasen' });
        }
        
        console.log(`Spill med ID ${gameId} finnes, laster det nå...`);
        
        // Prøv å laste spillet med den korrekte game_id
        const game = await SolitaireGame.loadFromDb(gameId);
        
        if (!game) {
            console.log(`Fant ikke spill med ID ${gameId} i databasen`);
            return res.status(404).json({ error: 'Spill ikke funnet i databasen' });
        }
        
        // Lagre i cache
        solitaireGames[gameId] = game;
        
        console.log(`Spill ${gameId} lastet inn vellykket`);
        res.status(200).json({
            gameId: game.id,
            board: game.board,
            foundation: game.foundation,
            libraryCount: game.library.length,
            graveyardTop: game.graveyard.length > 0 ? game.graveyard[game.graveyard.length - 1] : null,
            moves: game.moves,
            status: game.status,
            elapsedTime: Date.now() - game.startTime
        });
    } catch (error) {
        console.error('Error loading saved game:', error.stack || error);
        res.status(500).json({ error: 'Feil ved lasting av lagret spill: ' + error.message });
    }
});

// Hent alle lagrede spill for denne brukeren
router.get('/saves', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        console.log(`Henter lagrede spill for bruker ${userId}`);
        
        const savedGames = await db.getSavedGamesForUser(userId);
        
        res.status(200).json({ saves: savedGames });
    } catch (error) {
        console.error('Error fetching saved games:', error);
        res.status(500).json({ error: 'Feil ved henting av lagrede spill' });
    }
});

// Delete saved game
router.delete('/saves/:saveName', isAuthenticated, async (req, res) => {
    try {
        const { saveName } = req.params;
        const userId = req.session.userId;
        
        console.log(`Sletter lagret spill "${saveName}" for bruker ${userId}`);
        
        const deleted = await db.deleteSavedGame(userId, saveName);
        
        if (!deleted) {
            return res.status(404).json({ error: 'Lagret spill ikke funnet' });
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting saved game:', error);
        res.status(500).json({ error: 'Feil ved sletting av lagret spill' });
    }
});

// Legg til debugging-endepunkt
router.get('/debug/database', async (req, res) => {
    try {
        // Sjekk games-tabellen
        const gamesResult = await pool.query('SELECT * FROM games ORDER BY created_at DESC LIMIT 10');
        
        // Sjekk saved_games-tabellen
        const savedGamesResult = await pool.query('SELECT * FROM saved_games ORDER BY created_at DESC LIMIT 10');
        
        // Sjekk users-tabellen (ny)
        const usersResult = await pool.query('SELECT id, username, email, created_at FROM users ORDER BY created_at DESC LIMIT 10');
        
        res.json({
            games: gamesResult.rows,
            savedGames: savedGamesResult.rows,
            users: usersResult.rows
        });
    } catch (error) {
        console.error('Feil ved debugging av database:', error);
        res.status(500).json({ error: error.message });
    }
});

// Eksporter routeren
export default router;