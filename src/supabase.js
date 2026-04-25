import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tswbjjpbssfmzoqrczoj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzd2JqanBic3NmbXpvcXJjem9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNjEzNzgsImV4cCI6MjA5MjYzNzM3OH0.cesIhNyVSWBEypSWbGB7Gz5foPuQgUbIWc5DUDCDvHU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
