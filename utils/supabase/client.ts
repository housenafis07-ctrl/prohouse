import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Keep one browser client for the whole app. Creating a new GoTrue client for
// Telegram setSession while another client is initializing can contend on the
// browser auth lock and leave the Mini App spinner waiting indefinitely.
let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export const createClient = (): any => {
  if (!browserClient) {
    browserClient = createBrowserClient(supabaseUrl!, supabaseKey!);
  }
  return browserClient;
};
