import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://nhdowqzecpwmkunczodl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZG93cXplY3B3bWt1bmN6b2RsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDAyNTUsImV4cCI6MjA5NjE3NjI1NX0.Tdfx0e610t059HG1QZVtsqO_UIppi8Axd02fU6jqqTo";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
