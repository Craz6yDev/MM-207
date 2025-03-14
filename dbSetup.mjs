// dbSetup.mjs
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Opprett en PostgreSQL pool
export const pool = new pg.Pool({
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  host: 'dpg-cv9nuiin91rc738r2un0-a.frankfurt-postgres.render.com',
  port: process.env.PG_PORT,
  database: 'solitaire_db',
  ssl: {
    rejectUnauthorized: false // Required for Render PostgreSQL
  }
});

export async function pingDb() {
    const client = await pool.connect();
    try {
      await client.query('SELECT NOW()');
      console.log('Database tilkobling er vellykket');
      return true;
    } catch (err) {
      console.error('Feil ved tilkobling til database:', err);
      return false;
    } finally {
      client.release();
    }
  }

// Initialiser databaseskjema hvis det trengs
export async function initializeDb() {
  const client = await pool.connect();
  try {
    console.log('Sjekker database-tilkobling...');
    const result = await client.query('SELECT NOW()');
    console.log('Database tilkoblet:', result.rows[0].now);
    
    // Tabellene er allerede opprettet i pgAdmin, så vi trenger ikke gjøre det her
  } catch (error) {
    console.error('Feil ved initialisering av database:', error);
    throw error;
  } finally {
    client.release();
  }
}