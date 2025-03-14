// script.mjs
import express from 'express';
import cors from 'cors'; 
import session from 'express-session';
import solitaireRouter from './solitaireRouter.mjs';
import authRouter from './authRouter.mjs';
import dotenv from 'dotenv';
import { pingDb, pool } from './dbSetup.mjs';

// Last miljøvariabler
dotenv.config();

const server = express();
const port = (process.env.PORT || 8000);

// Initialiser databasen før serveren starter
pingDb().then((isConnected) => {
    if (isConnected) {
        console.log('Database tilkobling bekreftet');
    } else {
        console.error('Kunne ikke koble til databasen');
        process.exit(1);
    }
}).catch(err => {
    console.error('Feil ved sjekk av databasetilkobling:', err);
    process.exit(1);
});

// session middleware
server.use(session({
    secret: process.env.SESSION_SECRET || 'Enferno7970', // Bruk miljøvariabel
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 86400000 } // 24 timer
}));

server.set('port', port);
server.use(cors()); // Aktiver cors
server.use(express.static('public'));
server.use(express.json()); 
server.use(express.urlencoded({extended: true}));

// Registrer routere
server.use('/api/solitaire', solitaireRouter);
server.use('/api/auth', authRouter);

server.use(express.static('public', {
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) {
            res.setHeader('Service-Worker-Allowed', '/');
        }
    }
}));

// Test-endepunkt for databasetilkobling
server.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as time');
    res.json({ 
      message: 'Database connection successful',
      time: result.rows[0].time
    });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ error: 'Failed to connect to database' });
  }
});

// Error handling middleware
server.use((err, req, res, next) => {
    console.error('Uventet feil:', err);
    res.status(500).json({
        error: 'En uventet feil oppstod',
        details: err.message
    });
});

// Start serveren
server.listen(server.get('port'), () => {
    console.log('Server running on port', server.get('port'));
});