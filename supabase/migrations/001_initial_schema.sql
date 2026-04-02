-- =============================================
-- The Vintage Realtors - Supabase Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- Contact submissions table
CREATE TABLE IF NOT EXISTS contact_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'read', 'responded', 'archived')),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Newsletter subscriptions table
CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  source TEXT DEFAULT 'website',
  ip_address TEXT
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at ON contact_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_status ON contact_submissions(status);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_email ON contact_submissions(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscriptions(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_active ON newsletter_subscriptions(is_active);

-- Enable Row Level Security
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contact_submissions
-- Allow anonymous users to insert (for form submissions)
CREATE POLICY "Allow anonymous insert on contact_submissions"
  ON contact_submissions
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow authenticated users (admins) full access
CREATE POLICY "Allow full access for authenticated users on contact_submissions"
  ON contact_submissions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for newsletter_subscriptions
-- Allow anonymous users to insert
CREATE POLICY "Allow anonymous insert on newsletter_subscriptions"
  ON newsletter_subscriptions
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow authenticated users (admins) full access
CREATE POLICY "Allow full access for authenticated users on newsletter_subscriptions"
  ON newsletter_subscriptions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for contact_submissions
DROP TRIGGER IF EXISTS update_contact_submissions_updated_at ON contact_submissions;
CREATE TRIGGER update_contact_submissions_updated_at
  BEFORE UPDATE ON contact_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to handle newsletter subscription upsert logic
CREATE OR REPLACE FUNCTION handle_newsletter_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- If re-subscribing, set is_active to true and clear unsubscribed_at
  IF TG_OP = 'INSERT' THEN
    -- Check if email already exists (but is unsubscribed)
    UPDATE newsletter_subscriptions
    SET 
      is_active = true,
      name = NEW.name,
      subscribed_at = NOW(),
      unsubscribed_at = NULL,
      source = COALESCE(NEW.source, 'website')
    WHERE email = NEW.email AND is_active = false
    RETURNING id INTO NEW.id;
    
    -- If we updated an existing record, skip the insert
    IF FOUND THEN
      RETURN NULL;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS handle_newsletter_subscription_trigger ON newsletter_subscriptions;
CREATE TRIGGER handle_newsletter_subscription_trigger
  BEFORE INSERT ON newsletter_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION handle_newsletter_subscription();

-- Create a view for admin dashboard (future use)
CREATE OR REPLACE VIEW recent_contact_submissions AS
SELECT 
  id,
  name,
  email,
  phone,
  message,
  status,
  created_at
FROM contact_submissions
ORDER BY created_at DESC
LIMIT 100;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT ON contact_submissions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON contact_submissions TO authenticated;
GRANT SELECT, INSERT ON newsletter_subscriptions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON newsletter_subscriptions TO authenticated;
GRANT SELECT ON recent_contact_submissions TO authenticated;

-- Optional: Create storage bucket for future file uploads
-- INSERT INTO storage.buckets (id, name, public) VALUES ('uploads', 'uploads', true);
