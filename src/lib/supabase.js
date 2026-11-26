import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.https://jefoegkxnwpxqdcgbxwr.supabase.co;
const supabasePublishableKey =
  import.meta.env.sb_publishable_YpYnrCtNFJedfKwNQWlECw_2vXfEGMX;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey)
  : null;
