-- ============================================
-- THE VINTAGE REALTORS - ADMIN PANEL DATABASE SCHEMA
-- Run this in your Supabase SQL Editor
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CONTACT SUBMISSIONS (existing table modifications)
-- ============================================

-- Add status and notes columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contact_submissions' AND column_name = 'status') THEN
    ALTER TABLE contact_submissions ADD COLUMN status TEXT DEFAULT 'new' CHECK (status IN ('new', 'read', 'archived', 'replied'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contact_submissions' AND column_name = 'notes') THEN
    ALTER TABLE contact_submissions ADD COLUMN notes TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contact_submissions' AND column_name = 'replied_at') THEN
    ALTER TABLE contact_submissions ADD COLUMN replied_at TIMESTAMPTZ;
  END IF;
END $$;

-- ============================================
-- NEWSLETTER CAMPAIGNS
-- ============================================

CREATE TABLE IF NOT EXISTS newsletter_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  text_content TEXT,
  sent_at TIMESTAMPTZ,
  recipient_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_newsletter_campaigns_created_at ON newsletter_campaigns(created_at DESC);

-- ============================================
-- AGENTS
-- ============================================

CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  photo_url TEXT,
  phone TEXT,
  email TEXT,
  bio TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agents_sort_order ON agents(sort_order);

-- ============================================
-- TESTIMONIALS
-- ============================================

CREATE TABLE IF NOT EXISTS testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  rating INTEGER DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  content TEXT NOT NULL,
  property_id UUID,
  is_featured BOOLEAN DEFAULT false,
  is_approved BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_testimonials_created_at ON testimonials(created_at DESC);

-- ============================================
-- LEAD MANAGEMENT
-- ============================================

-- Lead Tags
CREATE TABLE IF NOT EXISTS lead_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#8b7355',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contact Tags (junction table)
CREATE TABLE IF NOT EXISTS contact_tags (
  contact_id UUID REFERENCES contact_submissions(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES lead_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, tag_id)
);

-- Contact Notes
CREATE TABLE IF NOT EXISTS contact_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contact_submissions(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_notes_contact_id ON contact_notes(contact_id);

-- Follow-ups
CREATE TABLE IF NOT EXISTS follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contact_submissions(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMPTZ NOT NULL,
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_follow_ups_scheduled_for ON follow_ups(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_follow_ups_contact_id ON follow_ups(contact_id);

-- ============================================
-- PAGE CONTENT (for CMS-like editing)
-- ============================================

CREATE TABLE IF NOT EXISTS page_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page TEXT NOT NULL,
  section TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(page, section)
);

-- ============================================
-- SITE SETTINGS
-- ============================================

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_mailboxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT NOT NULL UNIQUE,
  display_name TEXT,
  direction_mode TEXT NOT NULL DEFAULT 'send_receive' CHECK (direction_mode IN ('send_only', 'receive_only', 'send_receive')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  resend_domain TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id UUID REFERENCES email_mailboxes(id) ON DELETE SET NULL,
  subject TEXT NOT NULL DEFAULT '',
  normalized_subject TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'closed', 'archived')),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  unread_count INTEGER NOT NULL DEFAULT 0,
  assigned_to UUID REFERENCES auth.users(id),
  contact_id UUID REFERENCES contact_submissions(id) ON DELETE SET NULL,
  participants JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_threads_mailbox_id ON email_threads(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_status ON email_threads(status);
CREATE INDEX IF NOT EXISTS idx_email_threads_last_message_at ON email_threads(last_message_at DESC);

CREATE TABLE IF NOT EXISTS email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,
  mailbox_id UUID REFERENCES email_mailboxes(id) ON DELETE SET NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  resend_email_id TEXT,
  message_id TEXT,
  in_reply_to TEXT,
  references_header TEXT,
  from_address TEXT NOT NULL,
  to_addresses JSONB NOT NULL DEFAULT '[]'::jsonb,
  cc_addresses JSONB NOT NULL DEFAULT '[]'::jsonb,
  bcc_addresses JSONB NOT NULL DEFAULT '[]'::jsonb,
  reply_to_addresses JSONB NOT NULL DEFAULT '[]'::jsonb,
  subject TEXT NOT NULL DEFAULT '',
  html_body TEXT,
  text_body TEXT,
  snippet TEXT,
  received_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivery_status TEXT,
  raw_download_url TEXT,
  headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(resend_email_id, direction)
);

CREATE INDEX IF NOT EXISTS idx_email_messages_thread_id ON email_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_mailbox_id ON email_messages(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_direction ON email_messages(direction);
CREATE INDEX IF NOT EXISTS idx_email_messages_received_at ON email_messages(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_sent_at ON email_messages(sent_at DESC);

CREATE TABLE IF NOT EXISTS email_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
  resend_attachment_id TEXT,
  filename TEXT NOT NULL,
  content_type TEXT,
  size INTEGER,
  content_disposition TEXT,
  content_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_attachments_message_id ON email_attachments(message_id);

CREATE TABLE IF NOT EXISTS email_thread_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_thread_notes_thread_id ON email_thread_notes(thread_id);

CREATE TABLE IF NOT EXISTS email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'resend',
  event_type TEXT NOT NULL,
  external_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_events_event_type ON email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_events_external_id ON email_events(external_id);

-- Insert default settings
INSERT INTO site_settings (key, value) VALUES
  ('contact', '{"email": "sales@thevintagerealtors.com", "phone": "+254722865306", "whatsapp": "+254722865306", "address": "Nairobi, Kenya", "hours": "Mon-Sat, 9:00 AM - 6:00 PM"}'),
  ('social', '{"instagram": "https://instagram.com/realtorvintage", "facebook": "https://www.facebook.com/TheVintageRealtors", "tiktok": "https://www.tiktok.com/@the.realtors7", "twitter": "", "linkedin": ""}'),
  ('seo', '{"siteTitle": "The Vintage Realtors", "siteDescription": "Real Estate Excellence in Nairobi - Premium property listings and services", "keywords": "real estate, nairobi, kenya, property, homes, apartments, land"}'),
  ('branding', '{"companyName": "The Vintage Realtors", "tagline": "If you build it, we will list it.", "footerText": "Real Estate Excellence in Nairobi"}')
ON CONFLICT (key) DO NOTHING;

INSERT INTO email_mailboxes (address, display_name, direction_mode, is_active, is_default)
VALUES
  ('sales@thevintagerealtors.com', 'Sales', 'send_receive', true, true),
  ('newsletters@thevintagerealtors.com', 'Newsletter', 'send_receive', true, false)
ON CONFLICT (address) DO NOTHING;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_mailboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_thread_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated admin users
-- These policies allow full access for authenticated users (admins)

CREATE POLICY "Allow all for authenticated users" ON contact_submissions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON newsletter_subscriptions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON newsletter_campaigns FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON agents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON testimonials FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON lead_tags FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON contact_tags FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON contact_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON follow_ups FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON page_content FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON site_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON email_mailboxes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON email_threads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON email_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON email_attachments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON email_thread_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON email_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Public read policies for frontend access
CREATE POLICY "Public read contact_submissions" ON contact_submissions FOR SELECT TO anon USING (false);
CREATE POLICY "Public read newsletter_subscriptions" ON newsletter_subscriptions FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "Public read agents" ON agents FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "Public read testimonials" ON testimonials FOR SELECT TO anon USING (is_approved = true);
CREATE POLICY "Public read site_settings" ON site_settings FOR SELECT TO anon USING (true);
CREATE POLICY "Public read page_content" ON page_content FOR SELECT TO anon USING (true);

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_site_settings_updated_at BEFORE UPDATE ON site_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_page_content_updated_at BEFORE UPDATE ON page_content FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- CREATE ADMIN USER (run this manually after deployment)
-- ============================================
-- To create an admin user, run this in the Supabase Auth section
-- or use the Supabase dashboard to create a user with email/password

-- Example (you'll need to replace with actual values):
-- INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
-- VALUES (gen_random_uuid(), 'admin@thevintagerealtors.com', '<hashed_password>', NOW(), NOW(), NOW());
