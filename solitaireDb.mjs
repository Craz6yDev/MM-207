// solitaireDb.mjs
import { pool } from './dbSetup.mjs';

// Game operations
export async function createGame(gameId, status = 'active') {
  console.log(`Oppretter nytt spill med ID: ${gameId}`);
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

// Library operations
export async function saveLibrary(gameId, cards) {
  // Slett eksisterende library-kort
  await pool.query('DELETE FROM library WHERE game_id = $1', [gameId]);
  
  if (cards.length === 0) return [];
  
  // Byggspørring for å sette inn alle kort med posisjoner
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

// Graveyard operations
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

// Board operations
export async function saveBoard(gameId, board) {
  await pool.query('DELETE FROM board WHERE game_id = $1', [gameId]);
  
  // Prepare values for batch insert
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
  
  // Konverter flate resultater til nøstet board-struktur
  const board = Array(7).fill().map(() => []);
  
  result.rows.forEach(row => {
    board[row.column_index][row.row_index] = {
      card: row.card,
      visible: row.visible
    };
  });
  
  return board;
}

// Foundation operations
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
  
  // Konverter flate resultater til nøstet foundation-struktur
  const foundation = Array(4).fill().map(() => []);
  
  result.rows.forEach(row => {
    foundation[row.pile_index][row.card_index] = {
      card: row.card,
      visible: true // Foundation-kort er alltid synlige
    };
  });
  
  return foundation;
}

// Lagre spill for en bruker
export async function saveGameToUser(gameId, userId, saveName) {
  try {
    console.log(`Lagrer spill ${gameId} for bruker ${userId} med navn "${saveName}"`);
    
    // Sjekk om spillet faktisk eksisterer først
    const gameExists = await pool.query('SELECT id FROM games WHERE id = $1', [gameId]);
    if (gameExists.rows.length === 0) {
      console.error(`Spill ${gameId} finnes ikke i databasen`);
      throw new Error(`Spill ${gameId} finnes ikke i databasen`);
    }
    
    const result = await pool.query(
      `INSERT INTO saved_games (game_id, user_id, save_name) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (user_id, save_name) 
       DO UPDATE SET game_id = $1, created_at = NOW()
       RETURNING *`,
      [gameId, userId, saveName]
    );
    
    console.log(`Lagring vellykket, resultat:`, result.rows[0]);
    return result.rows[0];
  } catch (error) {
    console.error('Error saving game for user:', error);
    throw error;
  }
}

// Hent lagrede spill for en bruker
export async function getSavedGamesForUser(userId) {
  console.log(`Henter lagrede spill for bruker ${userId}`);
  try {
    const result = await pool.query(
      `SELECT sg.id, sg.game_id, sg.save_name, sg.created_at, 
       CASE WHEN g.id IS NOT NULL THEN true ELSE false END AS exists
       FROM saved_games sg
       LEFT JOIN games g ON sg.game_id = g.id
       WHERE sg.user_id = $1
       ORDER BY sg.created_at DESC`,
      [userId]
    );
    
    console.log(`Fant ${result.rows.length} lagrede spill:`, result.rows);
    return result.rows;
  } catch (error) {
    console.error(`Feil ved henting av lagrede spill:`, error);
    throw error;
  }
}

// Slett et lagret spill
export async function deleteSavedGame(userId, saveName) {
  console.log(`Sletter lagret spill "${saveName}" for bruker ${userId}`);
  const result = await pool.query(
    'DELETE FROM saved_games WHERE user_id = $1 AND save_name = $2 RETURNING *',
    [userId, saveName]
  );
  return result.rows[0];
}

// Lagre hele spilltilstanden
export async function saveGameState(game) {
  console.log(`Lagrer fullstendig spilltilstand for spill ${game.id}`);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Oppdater eller opprett spilloppføring
    await client.query(
      `INSERT INTO games (id, status, moves, start_time) 
       VALUES ($1, $2, $3, to_timestamp($4 / 1000.0)) 
       ON CONFLICT (id) 
       DO UPDATE SET status = $2, moves = $3`,
      [game.id, game.status, game.moves, game.startTime]
    );
    
    // Lagre alle spillkomponenter
    await saveLibrary(game.id, game.library);
    await saveGraveyard(game.id, game.graveyard);
    await saveBoard(game.id, game.board);
    await saveFoundation(game.id, game.foundation);
    
    await client.query('COMMIT');
    console.log(`Spilltilstand lagret for spill ${game.id}`);
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving game state:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Last hele spilltilstanden
export async function loadGameState(gameId) {
  console.log(`Forsøker å laste spilltilstand for spill ${gameId}`);
  if (typeof gameId !== 'string') {
    console.log(`ADVARSEL: gameId er ikke en streng, men ${typeof gameId}, konverterer til streng`);
    gameId = String(gameId);
  }
  const client = await pool.connect();
  try {
    const gameResult = await client.query('SELECT * FROM games WHERE id = $1', [gameId]);
    console.log(`Spørreresultat: ${gameResult.rows.length} rader funnet`);
    
    if (gameResult.rows.length === 0) {
      console.log(`Spill ${gameId} ikke funnet i games-tabellen`);
      return null;
    }
    
    const game = gameResult.rows[0];
    
    // Last alle spillkomponenter
    const library = await getLibrary(gameId);
    const graveyard = await getGraveyard(gameId);
    const board = await getBoard(gameId);
    const foundation = await getFoundation(gameId);
    
    console.log(`Spilltilstand lastet for spill ${gameId}`);
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
    console.error(`Detaljert feil ved lasting av spill ${gameId}:`, error);
    throw error;
  } finally {
    client.release();
  }
}