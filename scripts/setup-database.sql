-- Email Outreach Lead Management Database Schema
-- Run this script in your Neon/PostgreSQL database to set up the tables

-- Create the users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create the leads table with user_id foreign key
CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100),
  email VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  website VARCHAR(500),
  status VARCHAR(20) DEFAULT 'cold' CHECK (status IN ('cold', 'contacted', 'replied', 'converted', 'dead')),
  current_layer VARCHAR(10) DEFAULT 'L1' CHECK (current_layer IN ('L1', 'L2', 'L3', 'L4', 'L5+')),
  priority VARCHAR(10) DEFAULT NULL CHECK (priority IN ('high', 'medium', 'low')),
  intent VARCHAR(20) DEFAULT NULL CHECK (intent IN ('cold-outreach', 'follow-up', 'closing', 're-engagement')),
  lead_type VARCHAR(10) DEFAULT 'lead' CHECK (lead_type IN ('lead', 'customer')),
  positive_points TEXT,
  improvements TEXT,
  fb_ads_notes TEXT,
  pixel_status VARCHAR(100),
  custom_notes TEXT,
  last_email_sent TIMESTAMP,
  next_follow_up DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, email)
);

-- Create the email_history table with user_id
CREATE TABLE IF NOT EXISTS email_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  layer VARCHAR(20) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  generated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_current_layer ON leads(current_layer);
CREATE INDEX IF NOT EXISTS idx_leads_priority ON leads(priority);
CREATE INDEX IF NOT EXISTS idx_leads_next_follow_up ON leads(next_follow_up);
CREATE INDEX IF NOT EXISTS idx_email_history_lead_id ON email_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_history_user_id ON email_history(user_id);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at for users
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to auto-update updated_at for leads
DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add last_sync_uid column to mailbox_accounts if not exists
ALTER TABLE mailbox_accounts ADD COLUMN IF NOT EXISTS last_sync_uid INTEGER DEFAULT 0;
