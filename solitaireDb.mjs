
import { pool } from './dbSetup.mjs';


export async function createGame(gameId, status = 'active') {
  const result = await pool.query(
    'INSERT INTO games (id, status) VALUES ($1, $2) RETURNING *',
    [gameId, status]
  );
  return result.rows[0];
}

export async function getGame(gameId) {
  const result = await pool.query('SELECT * FROM games WHERE id = $1', [gameId]);
  return result.rows[0];
}

export async function updateGameStatus(gameId, status) {
  const result = await pool.query(
    'UPDATE games SET status = $1 WHERE id = $2 RETURNING *',
    [status, gameId]
  );
  return result.rows[0];
}

export async function incrementMoves(gameId) {
  const result = await pool.query(
    'UPDATE games SET moves = moves + 1 WHERE id = $1 RETURNING moves',
    [gameId]
  );
  return result.rows[0]?.moves;
}

export async function deleteGame(gameId) {
  await pool.query('DELETE FROM games WHERE id = $1', [gameId]);
}


export async function saveLibrary(gameId, cards) {
  await pool.query('DELETE FROM library WHERE game_id = $1', [gameId]);
  
  if (cards.length === 0) return [];
  
  
  const values = cards.map((card, index) => 
    `('${gameId}', '${card.card}', ${index}, ${card.visible})`
  ).join(', ');
  
  const query = `
    INSERT INTO library (game_id, card, position, visible)
    VALUES ${values}
    RETURNING *
  `;
  
  const result = await pool.query(query);
  return result.rows;
}

export async function getLibrary(gameId) {
  const result = await pool.query(
    'SELECT card, visible FROM library WHERE game_id = $1 ORDER BY position',
    [gameId]
  );
  return result.rows;
}


export async function saveGraveyard(gameId, cards) {
  
  await pool.query('DELETE FROM graveyard WHERE game_id = $1', [gameId]);
  
  if (cards.length === 0) return [];
  
 
  const values = cards.map((card, index) => 
    `('${gameId}', '${card.card}', ${index}, ${card.visible})`
  ).join(', ');
  
  if (!values) return [];
  
  const query = `
    INSERT INTO graveyard (game_id, card, position, visible)
    VALUES ${values}
    RETURNING *
  `;
  
  const result = await pool.query(query);
  return result.rows;
}

export async function getGraveyard(gameId) {
  const result = await pool.query(
    'SELECT card, visible FROM graveyard WHERE game_id = $1 ORDER BY position',
    [gameId]
  );
  return result.rows;
}


export async function saveBoard(gameId, board) {

  await pool.query('DELETE FROM board WHERE game_id = $1', [gameId]);
  

  const valuesArray = [];
  
  board.forEach((column, colIndex) => {
    column.forEach((card, rowIndex) => {
      valuesArray.push(`('${gameId}', ${colIndex}, ${rowIndex}, '${card.card}', ${card.visible})`);
    });
  });
  
  if (valuesArray.length === 0) return [];
  
  const values = valuesArray.join(', ');
  const query = `
    INSERT INTO board (game_id, column_index, row_index, card, visible)
    VALUES ${values}
    RETURNING *
  `;
  
  const result = await pool.query(query);
  return result.rows;
}

export async function getBoard(gameId) {
  const result = await pool.query(
    'SELECT column_index, row_index, card, visible FROM board WHERE game_id = $1 ORDER BY column_index, row_index',
    [gameId]
  );
  

  const board = Array(7).fill().map(() => []);
  
  result.rows.forEach(row => {
    board[row.column_index][row.row_index] = {
      card: row.card,
      visible: row.visible
    };
  });
  
  return board;
}


export async function saveFoundation(gameId, foundation) {

  await pool.query('DELETE FROM foundation WHERE game_id = $1', [gameId]);

  const valuesArray = [];
  
  foundation.forEach((pile, pileIndex) => {
    pile.forEach((card, cardIndex) => {
      valuesArray.push(`('${gameId}', ${pileIndex}, ${cardIndex}, '${card.card}')`);
    });
  });
  
  if (valuesArray.length === 0) return [];
  
  const values = valuesArray.join(', ');
  const query = `
    INSERT INTO foundation (game_id, pile_index, card_index, card)
    VALUES ${values}
    RETURNING *
  `;
  
  const result = await pool.query(query);
  return result.rows;
}

export async function getFoundation(gameId) {
  const result = await pool.query(
    'SELECT pile_index, card_index, card FROM foundation WHERE game_id = $1 ORDER BY pile_index, card_index',
    [gameId]
  );
  

  const foundation = Array(4).fill().map(() => []);
  
  result.rows.forEach(row => {
    foundation[row.pile_index][row.card_index] = {
      card: row.card,
      visible: true 
    };
  });
  
  return foundation;
}


export async function saveGameToSession(gameId, sessionId, saveName) {
  try {
    const result = await pool.query(
      `INSERT INTO saved_games (game_id, session_id, save_name) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (session_id, save_name) 
       DO UPDATE SET game_id = $1, created_at = NOW()
       RETURNING *`,
      [gameId, sessionId, saveName]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error saving game to session:', error);
    throw error;
  }
}

export async function getSavedGamesForSession(sessionId) {
  const result = await pool.query(
    `SELECT sg.id, sg.game_id, sg.save_name, sg.created_at, 
     CASE WHEN g.id IS NOT NULL THEN true ELSE false END AS exists
     FROM saved_games sg
     LEFT JOIN games g ON sg.game_id = g.id
     WHERE sg.session_id = $1
     ORDER BY sg.created_at DESC`,
    [sessionId]
  );
  return result.rows;
}

export async function deleteSavedGame(sessionId, saveName) {
  const result = await pool.query(
    'DELETE FROM saved_games WHERE session_id = $1 AND save_name = $2 RETURNING *',
    [sessionId, saveName]
  );
  return result.rows[0];
}


export async function saveGameState(game) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO games (id, status, moves, start_time) 
       VALUES ($1, $2, $3, to_timestamp($4 / 1000.0)) 
       ON CONFLICT (id) 
       DO UPDATE SET status = $2, moves = $3`,
      [game.id, game.status, game.moves, game.startTime]
    );
    

    await saveLibrary(game.id, game.library);
    await saveGraveyard(game.id, game.graveyard);
    await saveBoard(game.id, game.board);
    await saveFoundation(game.id, game.foundation);
    
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving game state:', error);
    throw error;
  } finally {
    client.release();
  }
}


export async function loadGameState(gameId) {
  const client = await pool.connect();
  try {
    const gameResult = await client.query('SELECT * FROM games WHERE id = $1', [gameId]);
    if (gameResult.rows.length === 0) {
      return null;
    }
    
    const game = gameResult.rows[0];
    

    const library = await getLibrary(gameId);
    const graveyard = await getGraveyard(gameId);
    const board = await getBoard(gameId);
    const foundation = await getFoundation(gameId);
    
    return {
      id: game.id,
      status: game.status,
      moves: game.moves,
      startTime: new Date(game.start_time).getTime(),
      library,
      graveyard,
      board,
      foundation
    };
  } catch (error) {
    console.error('Error loading game state:', error);
    throw error;
  } finally {
    client.release();
  }
}