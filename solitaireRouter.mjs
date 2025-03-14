// solitaireRouter.mjs
import express from 'express';
import { generateDeck, shuffleDeck } from './deckUtils.mjs';
import { SolitaireGame } from './solitaireTypes.mjs';
import pool from './db.mjs';

const router = express.Router();

let solitaireGames = {};


function logWithTimestamp(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
    if (data) {
        console.log(JSON.stringify(data, null, 2));
    }
}

// Helper function to get or create user ID from session
async function getOrCreateUser(sessionId) {
    try {
        // Check if user exists with this session ID
        const userResult = await pool.query(
            'SELECT user_id FROM users WHERE session_id = $1',
            [sessionId]
        );
        
        if (userResult.rows.length > 0) {
            return userResult.rows[0].user_id;
        }
        
        // Create new user with this session ID
        const newUserResult = await pool.query(
            'INSERT INTO users (session_id) VALUES ($1) RETURNING user_id',
            [sessionId]
        );
        
        return newUserResult.rows[0].user_id;
    } catch (error) {
        console.error('Error getting/creating user:', error);
        throw error;
    }
}

// POST route to save a game
router.post('/games/:gameId/save', async (req, res) => {
    try {  
        const gameId = req.params.gameId;
        const { saveName } = req.body;
            
        if (!saveName) {
            return res.status(400).json({ 
                error: 'Mangler navn på lagringen',
                success: false
            });
        }

        const game = solitaireGames[gameId];
        if (!game) {
            logWithTimestamp(`Save attempt failed: Game ${gameId} not found`);
            return res.status(404).json({ 
                error: 'Spill ikke funnet',
                success: false 
            });
        }
    
        // Ensure we have a session ID
        if (!req.session.id) {
            logWithTimestamp('Save attempt failed: No valid session');
            return res.status(500).json({
                error: 'Ingen gyldig session',
                success: false
            });
        }

        // Get or create user ID from session
        const userId = await getOrCreateUser(req.session.id);
        
        // Save game state as JSON
        const gameState = {
            board: game.board,
            foundation: game.foundation,
            library: game.library,
            graveyard: game.graveyard,
            moves: game.moves,
            startTime: game.startTime,
            status: game.status
        };
        
        logWithTimestamp('Attempting to save game state', {
            userId,
            gameId,
            saveName,
            gameStateSize: JSON.stringify(gameState).length
        });
        // Use upsert pattern (insert or update)
        const upsertQuery = `
            INSERT INTO saved_games (game_id, user_id, save_name, game_state)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, save_name) 
            DO UPDATE SET 
                game_id = EXCLUDED.game_id,
                game_state = EXCLUDED.game_state,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `;

        const result = await pool.query(upsertQuery, [
            gameId, 
            userId, 
            saveName, 
            gameState
        ]);

        logWithTimestamp('Game saved successfully', {
            savedGameId: result.rows[0].game_id,
            saveName: result.rows[0].save_name
        });
        
         req.session.savedGames = req.session.savedGames || {};
         req.session.savedGames[saveName] = gameId;
            

        res.status(200).json({
            message: 'Game saved successfully',
            saveName,
            gameId,
            success: true
        });

        
    
        
    } catch (error) {
        console.error('Feil ved lagring:', error);
        res.status(500).json({
            error: 'Intern serverfeil',
            success: false
        });
    }
});

// GET route to retrieve saved games
router.get('/saves', async (req, res) => {
    try {
        if (!req.session.id) {
            return res.status(200).json({ saves: [] });
        }
        
        // Get user ID
        const userResult = await pool.query(
            'SELECT user_id FROM users WHERE session_id = $1',
            [req.session.id]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(200).json({ saves: [] });
        }
        
        const userId = userResult.rows[0].user_id;
        
        // Get all saved games for this user
        const savedGamesResult = await pool.query(
            'SELECT game_id, save_name FROM saved_games WHERE user_id = $1 ORDER BY updated_at DESC',
            [userId]
        );
        
        const savedGames = savedGamesResult.rows.map(row => ({
            name: row.save_name,
            id: row.game_id,
            exists: !!solitaireGames[row.game_id]
        }));
        
        res.status(200).json({ saves: savedGames });
    } catch (error) {
        console.error('Error retrieving saved games:', error);
        res.status(500).json({ error: 'Intern serverfeil' });
    }
});

// DELETE route to delete a saved game
router.delete('/saves/:saveName', async (req, res) => {
    try {
        const { saveName } = req.params;
        
        if (!req.session.id) {
            return res.status(404).json({ error: 'Ingen gyldig session' });
        }
        
        // Get user ID
        const userResult = await pool.query(
            'SELECT user_id FROM users WHERE session_id = $1',
            [req.session.id]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Bruker ikke funnet' });
        }
        
        const userId = userResult.rows[0].user_id;
        
        // Delete the saved game
        const deleteResult = await pool.query(
            'DELETE FROM saved_games WHERE user_id = $1 AND save_name = $2 RETURNING game_id',
            [userId, saveName]
        );
        
        if (deleteResult.rows.length === 0) {
            return res.status(404).json({ error: 'Lagret spill ikke funnet' });
        }
        
        // Also remove from session for backward compatibility
        if (req.session.savedGames && req.session.savedGames[saveName]) {
            delete req.session.savedGames[saveName];
        }
        
        res.status(200).json({ message: 'Lagret spill slettet' });
    } catch (error) {
        console.error('Error deleting saved game:', error);
        res.status(500).json({ error: 'Intern serverfeil' });
    }
});

// GET route to load a saved game
router.get('/saves/:saveName/load', async (req, res) => {
    try {
        const { saveName } = req.params;
        
        if (!req.session.id) {
            return res.status(404).json({ error: 'Ingen gyldig session' });
        }
        
        // Get user ID
        const userResult = await pool.query(
            'SELECT user_id FROM users WHERE session_id = $1',
            [req.session.id]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Bruker ikke funnet' });
        }
        
        const userId = userResult.rows[0].user_id;
        
        // Get the saved game
        const savedGameResult = await pool.query(
            'SELECT game_id, game_state FROM saved_games WHERE user_id = $1 AND save_name = $2',
            [userId, saveName]
        );
        
        if (savedGameResult.rows.length === 0) {
            return res.status(404).json({ error: 'Lagret spill ikke funnet' });
        }
        
        const { game_id, game_state } = savedGameResult.rows[0];
        
        // Create a new game instance
        const game = new SolitaireGame(game_id);
        
        // Load the game state
        Object.assign(game, game_state);
        
        // Store in memory
        solitaireGames[game_id] = game;
        
        // Update session
        req.session.solitaireGameId = game_id;
        
        res.status(200).json({
            gameId: game.id,
            board: game.board,
            foundation: game.foundation,
            libraryCount: game.library.length,
            graveyardTop: game.graveyard.length > 0 ? game.graveyard[game.graveyard.length - 1] : null,
            status: game.status,
            moves: game.moves
        });
    } catch (error) {
        console.error('Error loading saved game:', error);
        res.status(500).json({ error: 'Intern serverfeil' });
    }
});

// The rest of your existing routes...
router.post('/games', (req, res) => {
    const gameId = Date.now().toString();
    const game = new SolitaireGame(gameId);
    const deck = shuffleDeck(generateDeck());
    
    game.init(deck);
    
    // Store game in memory
    solitaireGames[gameId] = game;
    
    // Store in session
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

// Keep all your other existing routes here...
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

// Include all your other game action routes here...

export default router;