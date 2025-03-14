// dbUtils.mjs
import pool from './db.mjs';

// User functions
export async function createUser(sessionId, username = null) {
  const result = await pool.query(
    'INSERT INTO users (session_id, username) VALUES ($1, $2) RETURNING user_id',
    [sessionId, username]
  );
  return result.rows[0].user_id;
}

export async function getUserBySessionId(sessionId) {
  const result = await pool.query(
    'SELECT * FROM users WHERE session_id = $1',
    [sessionId]
  );
  return result.rows[0] || null;
}

export async function getOrCreateUser(sessionId) {
  let user = await getUserBySessionId(sessionId);
  
  if (!user) {
    const userId = await createUser(sessionId);
    user = { user_id: userId, session_id: sessionId };
  }
  
  return user;
}

// Game functions
export async function saveGame(gameId, userId, saveName, gameState) {
  try {
    // Check if game already exists
    const existingGame = await pool.query(
      'SELECT game_id FROM saved_games WHERE user_id = $1 AND save_name = $2',
      [userId, saveName]
    );
    
    if (existingGame.rows.length > 0) {
      // Update existing game
      const result = await pool.query(
        'UPDATE saved_games SET game_state = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND save_name = $3 RETURNING *',
        [gameState, userId, saveName]
      );
      return result.rows[0];
    } else {
      // Insert new game
      const result = await pool.query(
        'INSERT INTO saved_games (game_id, user_id, save_name, game_state) VALUES ($1, $2, $3, $4) RETURNING *',
        [gameId, userId, saveName, gameState]
      );
      return result.rows[0];
    }
  } catch (error) {
    console.error('Error saving game:', error);
    throw error;
  }
}

export async function getSavedGames(userId) {
  const result = await pool.query(
    'SELECT game_id, save_name, updated_at FROM saved_games WHERE user_id = $1 ORDER BY updated_at DESC',
    [userId]
  );
  return result.rows;
}

export async function getSavedGame(userId, saveName) {
  const result = await pool.query(
    'SELECT * FROM saved_games WHERE user_id = $1 AND save_name = $2',
    [userId, saveName]
  );
  return result.rows[0] || null;
}

export async function deleteSavedGame(userId, saveName) {
  const result = await pool.query(
    'DELETE FROM saved_games WHERE user_id = $1 AND save_name = $2 RETURNING *',
    [userId, saveName]
  );
  return result.rows[0] || null;
}