import { createBrowserClient } from "@supabase/ssr";

// This project currently does not have a generated Supabase Database type that
// covers the full production schema. A hand-written partial schema causes
// PostgREST to infer false SelectQueryError/unknown shapes for legacy tables
// and relationships. Keep the browser client intentionally untyped until the
// generated production schema is restored; feature boundaries own their types.
type LooseDatabase = any;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// One browser client for the whole app. Multiple GoTrue clients can race while
// hydrating/refreshing the same local session, which is especially dangerous in
// the Telegram Mini App where we intentionally replace the browser identity.
let browserClient: ReturnType<typeof createBrowserClient<LooseDatabase>> | undefined;

export const createClient = () => {
  if (!browserClient) {
    browserClient = createBrowserClient<LooseDatabase>(supabaseUrl!, supabaseKey!);
  }
  return browserClient;
};
