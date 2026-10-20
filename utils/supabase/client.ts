import { createBrowserClient } from "@supabase/ssr";

type LooseTable = {
  Row: any;
  Insert: any;
  Update: any;
  Relationships: any[];
};

type LooseDatabase = {
  public: {
    Tables: Record<string, LooseTable>;
    Views: Record<string, LooseTable>;
    Functions: Record<string, { Args: any; Returns: any }>;
    Enums: Record<string, string>;
    CompositeTypes: Record<string, any>;
  };
};

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
