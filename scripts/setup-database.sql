saved signature is not seen in rih-- Email Outreach Lead Management Database Schema
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

-- Lead groups for organizing leads
CREATE TABLE IF NOT EXISTS lead_groups (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, name)
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
  group_id INTEGER REFERENCES lead_groups(id) ON DELETE SET NULL,
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

-- Email templates for reuse
CREATE TABLE IF NOT EXISTS email_templates (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  category VARCHAR(50) DEFAULT 'general',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Import columns tracking - stores column names from last imported Excel/CSV
CREATE TABLE IF NOT EXISTS import_columns (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  columns JSONB NOT NULL DEFAULT '[]',
  imported_at TIMESTAMP DEFAULT NOW()
);

-- Email campaigns for bulk sending
CREATE TABLE IF NOT EXISTS email_campaigns (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'paused', 'cancelled', 'failed')),
  send_type VARCHAR(20) DEFAULT 'instant' CHECK (send_type IN ('instant', 'scheduled', 'smart_spacing')),
  scheduled_at TIMESTAMP,
  gap_minutes INTEGER DEFAULT 3,
  gap_min_max INTEGER DEFAULT 0,
  business_hours_only BOOLEAN DEFAULT false,
  daily_cap INTEGER DEFAULT 0,
  business_hours_start TIME DEFAULT '09:00',
  business_hours_end TIME DEFAULT '18:00',
  last_sent_date DATE,
  today_sent_count INTEGER DEFAULT 0,
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  signature TEXT DEFAULT '',
  from_email TEXT DEFAULT '',
  from_name TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Campaign recipients
CREATE TABLE IF NOT EXISTS campaign_recipients (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  company_name VARCHAR(255),
  personalization_data JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
  sent_at TIMESTAMP,
  error_message TEXT,
  message_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_current_layer ON leads(current_layer);
CREATE INDEX IF NOT EXISTS idx_leads_priority ON leads(priority);
CREATE INDEX IF NOT EXISTS idx_leads_next_follow_up ON leads(next_follow_up);
CREATE INDEX IF NOT EXISTS idx_email_history_lead_id ON email_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_history_user_id ON email_history(user_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_user_id ON email_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_user_id ON email_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_id ON campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status ON campaign_recipients(status);
CREATE INDEX IF NOT EXISTS idx_import_columns_user_id ON import_columns(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_groups_user_id ON lead_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_group_id ON leads(group_id);

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

-- Trigger to auto-update updated_at for email_templates
DROP TRIGGER IF EXISTS update_email_templates_updated_at ON email_templates;
CREATE TRIGGER update_email_templates_updated_at
    BEFORE UPDATE ON email_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to auto-update updated_at for email_campaigns
DROP TRIGGER IF EXISTS update_email_campaigns_updated_at ON email_campaigns;
CREATE TRIGGER update_email_campaigns_updated_at
    BEFORE UPDATE ON email_campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to auto-update updated_at for lead_groups
DROP TRIGGER IF EXISTS update_lead_groups_updated_at ON lead_groups;
CREATE TRIGGER update_lead_groups_updated_at
    BEFORE UPDATE ON lead_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add last_sync_uid column to mailbox_accounts if not exists
ALTER TABLE mailbox_accounts ADD COLUMN IF NOT EXISTS last_sync_uid INTEGER DEFAULT 0;
