import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || "https://qfaqatylideyjsgavtfz.supabase.co";
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmYXFhdHlsaWRleWpzZ2F2dGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0MTYwMDAsImV4cCI6MjA2Njk5MjAwMH0.dummy";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper function to send real Email OTP via Supabase
export async function sendRealEmailOtp(email) {
  try {
    const { data, error } = await supabase.auth.signInWithOtp({ email });
    if (error) throw error;
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Helper function to send real SMS OTP via Supabase
export async function sendRealSmsOtp(phone) {
  try {
    const formattedPhone = phone.startsWith("+") ? phone : `+91${phone}`;
    const { data, error } = await supabase.auth.signInWithOtp({ phone: formattedPhone });
    if (error) throw error;
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
