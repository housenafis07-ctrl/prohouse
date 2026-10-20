import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// One browser client for the whole app. Multiple GoTrue clients can race while
// hydrating/refreshing the same local session, which is especially dangerous in
// the Telegram Mini App where we intentionally replace the browser identity.
let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export const createClient = () => {
  if (!browserClient) {
    browserClient = createBrowserClient(supabaseUrl!, supabaseKey!);
  }
  return browserClient;
};
