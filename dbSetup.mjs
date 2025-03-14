
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false 
  }
});

export async function initializeDb() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS games (
        id VARCHAR(255) PRIMARY KEY,
        status VARCHAR(50) NOT NULL,
        moves INTEGER NOT NULL DEFAULT 0,
        start_time TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS library (
        game_id VARCHAR(255) REFERENCES games(id) ON DELETE CASCADE,
        card VARCHAR(50) NOT NULL,
        position INTEGER NOT NULL,
        visible BOOLEAN NOT NULL DEFAULT FALSE,
        PRIMARY KEY (game_id, position)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS graveyard (
        game_id VARCHAR(255) REFERENCES games(id) ON DELETE CASCADE,
        card VARCHAR(50) NOT NULL,
        position INTEGER NOT NULL,
        visible BOOLEAN NOT NULL DEFAULT TRUE,
        PRIMARY KEY (game_id, position)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS board (
        game_id VARCHAR(255) REFERENCES games(id) ON DELETE CASCADE,
        column_index INTEGER NOT NULL,
        row_index INTEGER NOT NULL,
        card VARCHAR(50) NOT NULL,
        visible BOOLEAN NOT NULL,
        PRIMARY KEY (game_id, column_index, row_index)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS foundation (
        game_id VARCHAR(255) REFERENCES games(id) ON DELETE CASCADE,
        pile_index INTEGER NOT NULL,
        card_index INTEGER NOT NULL,
        card VARCHAR(50) NOT NULL,
        PRIMARY KEY (game_id, pile_index, card_index)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS saved_games (
        id SERIAL PRIMARY KEY,
        game_id VARCHAR(255) REFERENCES games(id) ON DELETE CASCADE,
        session_id VARCHAR(255) NOT NULL,
        save_name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (session_id, save_name)
      )
    `);

    await client.query('COMMIT');
    console.log('Database schema initialized successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error initializing database schema:', error);
    throw error;
  } finally {
    client.release();
  }
}


// initializeDb().catch(console.error);