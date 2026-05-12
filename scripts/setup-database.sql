-- Email Outreach Lead Management Database Schema
-- Run this script in your Neon/PostgreSQL database to set up the tables

-- Create the leads table
CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100),
  email VARCHAR(255) NOT NULL UNIQUE,
  company_name VARCHAR(255),
  website VARCHAR(500),
  status VARCHAR(20) DEFAULT 'cold' CHECK (status IN ('cold', 'contacted', 'replied', 'converted', 'dead')),
  current_layer VARCHAR(10) DEFAULT 'L1' CHECK (current_layer IN ('L1', 'L2', 'L3', 'L4', 'L5+')),
  positive_points TEXT,
  improvements TEXT,
  fb_ads_notes TEXT,
  pixel_status VARCHAR(100),
  custom_notes TEXT,
  last_email_sent TIMESTAMP,
  next_follow_up DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create the email_history table
CREATE TABLE IF NOT EXISTS email_history (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  layer VARCHAR(10) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  generated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_current_layer ON leads(current_layer);
CREATE INDEX IF NOT EXISTS idx_leads_next_follow_up ON leads(next_follow_up);
CREATE INDEX IF NOT EXISTS idx_email_history_lead_id ON email_history(lead_id);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
