// initDb.mjs
import fs from 'fs';
import pool from './db.mjs';

async function initializeDatabase() {
  try {
    // Read the SQL file
    const sql = fs.readFileSync('./init-db.sql', 'utf8');
    
    // Execute the SQL
    await pool.query(sql);
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    // End the pool
    pool.end();
  }
}

initializeDatabase();