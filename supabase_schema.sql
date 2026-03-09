-- SQL Schema for Supabase
-- Run this in your Supabase SQL Editor

-- 1. Transactions Table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  type TEXT CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  receipt_url TEXT,
  whatsapp_message_id UUID
);

-- 2. Events Table
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  completed BOOLEAN DEFAULT FALSE,
  whatsapp_message_id UUID
);

-- 3. WhatsApp Messages Table
CREATE TABLE whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  whatsapp_id TEXT UNIQUE,
  sender_number TEXT NOT NULL,
  message_text TEXT,
  raw_data JSONB,
  status TEXT DEFAULT 'received' CHECK (status IN ('received', 'processed', 'pending_confirmation', 'error')),
  interpretation JSONB
);

-- 4. Categories Table (Optional, for predefined categories)
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  type TEXT CHECK (type IN ('income', 'expense')),
  color TEXT
);

-- Insert some default categories
INSERT INTO categories (name, type, color) VALUES 
('Alimentação', 'expense', '#ef4444'),
('Transporte', 'expense', '#f59e0b'),
('Lazer', 'expense', '#8b5cf6'),
('Saúde', 'expense', '#ec4899'),
('Salário', 'income', '#10b981'),
('Investimentos', 'income', '#6366f1');

-- Enable Row Level Security (RLS) - for demo purposes we can keep it simple or enable it
-- ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE events ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
