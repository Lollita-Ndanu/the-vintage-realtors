(function() {
  'use strict';

  const SUPABASE_URL = 'https://avhnytuowvhvhssbfpkt.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2aG55dHVvd3Zodmhzc2JmcGt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzODAzOTEsImV4cCI6MjA4OTk1NjM5MX0.LgaJJLMvulFZmq_hOS3ncwW8Njthw49Gc2QV2Wvf5EU';

  let supabaseClient = null;
  let isInitialized = false;
  let initError = null;

  function checkSupabaseLoaded() {
    if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
      return false;
    }
    return true;
  }

  async function initSupabase() {
    if (isInitialized) {
      return supabaseClient;
    }

    if (!checkSupabaseLoaded()) {
      initError = 'Supabase library not loaded. Please ensure the Supabase JS SDK is included.';
      console.error(initError);
      return null;
    }

    try {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });

      isInitialized = true;
      console.log('Supabase client initialized successfully');
      return supabaseClient;
    } catch (error) {
      initError = `Failed to initialize Supabase: ${error.message}`;
      console.error(initError);
      return null;
    }
  }

  async function submitContactForm(data) {
    const client = await initSupabase();
    if (!client) {
      return { success: false, error: initError || 'Failed to initialize database connection' };
    }

    try {
      const submissionData = {
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        message: data.message
      };

      const { data: result, error } = await client
        .from('contact_submissions')
        .insert([submissionData])
        .select('id')
        .single();

      if (error) {
        console.error('Contact form submission error:', error);
        return { success: false, error: getErrorMessage(error) };
      }

      return { success: true, id: result.id };
    } catch (error) {
      console.error('Unexpected error submitting contact form:', error);
      return { success: false, error: 'An unexpected error occurred. Please try again.' };
    }
  }

  async function subscribeNewsletter(data) {
    const client = await initSupabase();
    if (!client) {
      return { success: false, error: initError || 'Failed to initialize database connection' };
    }

    try {
      const subscriptionData = {
        name: data.name,
        email: data.email,
        source: 'website'
      };

      const { data: result, error } = await client
        .from('newsletter_subscriptions')
        .upsert([subscriptionData], {
          onConflict: 'email',
          ignoreDuplicates: false
        })
        .select('id')
        .single();

      if (error) {
        console.error('Newsletter subscription error:', error);
        
        if (error.code === '23505') {
          return { success: true, message: 'You are already subscribed!' };
        }
        
        return { success: false, error: getErrorMessage(error) };
      }

      return { success: true, id: result.id };
    } catch (error) {
      console.error('Unexpected error subscribing to newsletter:', error);
      return { success: false, error: 'An unexpected error occurred. Please try again.' };
    }
  }

  function getErrorMessage(error) {
    const errorMessages = {
      '23505': 'This email is already registered.',
      '23503': 'Invalid reference data.',
      '23502': 'Required field is missing.',
      'PGRST116': 'No data found.',
      '08006': 'Connection failed. Please check your internet.',
      'ECONNREFUSED': 'Unable to connect to the server. Please try again later.',
      'ETIMEDOUT': 'Request timed out. Please try again.',
      'network': 'Network error. Please check your connection and try again.'
    };

    if (error.code && errorMessages[error.code]) {
      return errorMessages[error.code];
    }

    if (error.message) {
      if (error.message.includes('network') || error.message.includes('fetch')) {
        return 'Network error. Please check your connection and try again.';
      }
      if (error.message.includes('timeout')) {
        return 'Request timed out. Please try again.';
      }
    }

    return 'Something went wrong. Please try again later.';
  }

  function getConnectionStatus() {
    return {
      initialized: isInitialized,
      hasError: !!initError,
      error: initError
    };
  }

  window.TVR = window.TVR || {};
  window.TVR.db = {
    init: initSupabase,
    submitContact: submitContactForm,
    subscribe: subscribeNewsletter,
    getStatus: getConnectionStatus
  };

})();
