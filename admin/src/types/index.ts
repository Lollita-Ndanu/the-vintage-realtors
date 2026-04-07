export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: 'new' | 'read' | 'archived' | 'replied';
  notes: string | null;
  replied_at: string | null;
  created_at: string;
}

export interface NewsletterSubscriber {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  source: string | null;
  subscribed_at: string;
  unsubscribed_at: string | null;
}

export interface NewsletterCampaign {
  id: string;
  subject: string;
  html_content: string;
  text_content: string | null;
  sent_at: string | null;
  recipient_count: number;
  created_by: string | null;
  created_at: string;
}

export interface Agent {
  id: string;
  name: string;
  photo_url: string | null;
  phone: string | null;
  email: string | null;
  bio: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Testimonial {
  id: string;
  client_name: string;
  rating: number;
  content: string;
  property_id: string | null;
  is_featured: boolean;
  is_approved: boolean;
  created_at: string;
}

export interface LeadTag {
  id: string;
  name: string;
  color: string;
}

export interface ContactNote {
  id: string;
  contact_id: string;
  note: string;
  created_by: string | null;
  created_at: string;
}

export interface FollowUp {
  id: string;
  contact_id: string;
  scheduled_for: string;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface SiteSetting {
  key: string;
  value: Record<string, unknown>;
  updated_at: string;
}

export interface PageContent {
  id: string;
  page: string;
  section: string;
  content: Record<string, unknown>;
  updated_at: string;
  updated_by: string | null;
}

export interface Property {
  id: string;
  title: string;
  description: string;
  price: number;
  location: string;
  category: string[];
  status: string;
  bedrooms: number;
  bathrooms: number;
  area: number | null;
  slug?: string;
  mainImage?: {
    id: string;
    url: string;
    title: string;
    type: 'image' | 'video';
  };
  gallery?: Array<{
    id: string;
    url: string;
    title: string;
    type: 'image' | 'video';
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalContacts: number;
  newContacts: number;
  totalSubscribers: number;
  activeSubscribers: number;
  totalProperties: number;
  featuredProperties: number;
  pendingFollowUps: number;
  recentContacts: Contact[];
}

export interface EmailMailbox {
  id: string;
  address: string;
  display_name: string | null;
  direction_mode: 'send_only' | 'receive_only' | 'send_receive';
  is_active: boolean;
  is_default: boolean;
  resend_domain: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailAttachment {
  id: string;
  message_id: string;
  resend_attachment_id: string | null;
  filename: string;
  content_type: string | null;
  size: number | null;
  content_disposition: string | null;
  content_id: string | null;
  created_at: string;
}

export interface EmailMessage {
  id: string;
  thread_id: string;
  mailbox_id: string | null;
  direction: 'inbound' | 'outbound';
  resend_email_id: string | null;
  message_id: string | null;
  in_reply_to: string | null;
  references_header: string | null;
  from_address: string;
  to_addresses: string[];
  cc_addresses: string[];
  bcc_addresses: string[];
  reply_to_addresses: string[];
  subject: string;
  html_body: string | null;
  text_body: string | null;
  snippet: string | null;
  received_at: string | null;
  sent_at: string | null;
  delivery_status: string | null;
  raw_download_url: string | null;
  headers: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  attachments?: EmailAttachment[];
}

export interface EmailThreadNote {
  id: string;
  thread_id: string;
  body: string;
  created_by: string | null;
  created_at: string;
}

export interface EmailThread {
  id: string;
  mailbox_id: string | null;
  subject: string;
  normalized_subject: string;
  status: 'open' | 'pending' | 'closed' | 'archived';
  last_message_at: string;
  unread_count: number;
  assigned_to: string | null;
  contact_id: string | null;
  participants: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  mailbox?: EmailMailbox | null;
  contact?: Pick<Contact, 'id' | 'name' | 'email' | 'phone' | 'status'> | null;
  latest_message?: EmailMessage | null;
  messages?: EmailMessage[];
  notes?: EmailThreadNote[];
}
