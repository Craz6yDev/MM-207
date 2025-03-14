-- Tables for Solitaire game
-- Run this script to initialize your database

-- Users table (for session management)
CREATE TABLE IF NOT EXISTS users (
  user_id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Saved games table
CREATE TABLE IF NOT EXISTS saved_games (
  game_id VARCHAR(255) PRIMARY KEY,
  user_id INTEGER REFERENCES users(user_id),
  save_name VARCHAR(255) NOT NULL,
  game_state JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, save_name)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_saved_games_user_id ON saved_games(user_id);