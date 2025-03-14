// db.mjs
import pg from 'pg';
import dotenv from 'dotenv';
import url from 'url';

dotenv.config();

// Create a PostgreSQL connection pool
const pool = new pg.Pool({
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  database: process.env.PG_DATABASE,
  ssl: { rejectUnauthorized: false } // Needed for Render's PostgreSQL service
});

// Test the database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully at:', res.rows[0].now);
  }
});



export default pool;