// authRouter.mjs
import express from 'express';
import bcrypt from 'bcrypt';
import { pool } from './dbSetup.mjs';

const router = express.Router();

// Register a new user
router.post('/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Brukernavn og passord er påkrevd' 
      });
    }

    // Check if username already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ 
        success: false, 
        error: 'Brukernavnet er allerede i bruk' 
      });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert new user
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, email) VALUES ($1, $2, $3) RETURNING id, username, created_at',
      [username, passwordHash, email]
    );

    // Set user session
    req.session.userId = result.rows[0].id;
    req.session.username = result.rows[0].username;

    res.status(201).json({
      success: true,
      user: {
        id: result.rows[0].id,
        username: result.rows[0].username,
        created_at: result.rows[0].created_at
      }
    });
  } catch (error) {
    console.error('Feil ved registrering:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Kunne ikke registrere brukeren' 
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Brukernavn og passord er påkrevd' 
      });
    }

    // Get user by username
    const result = await pool.query(
      'SELECT id, username, password_hash FROM users WHERE username = $1',
      [username]
    );

    // Check if user exists
    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        error: 'Ugyldig brukernavn eller passord' 
      });
    }

    const user = result.rows[0];

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ 
        success: false, 
        error: 'Ugyldig brukernavn eller passord' 
      });
    }

    // Set user session
    req.session.userId = user.id;
    req.session.username = user.username;

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username
      }
    });
  } catch (error) {
    console.error('Feil ved innlogging:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Kunne ikke logge inn' 
    });
  }
});

// Get current user
router.get('/current', (req, res) => {
  if (req.session.userId) {
    res.json({
      success: true,
      user: {
        id: req.session.userId,
        username: req.session.username
      }
    });
  } else {
    res.status(401).json({ 
      success: false, 
      error: 'Ikke innlogget' 
    });
  }
});

// Logout user
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Feil ved utlogging:', err);
      return res.status(500).json({ 
        success: false, 
        error: 'Kunne ikke logge ut' 
      });
    }
    
    res.json({ success: true });
  });
});

export default router;