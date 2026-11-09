import { createBrowserClient } from "@supabase/ssr";
import { OPCOES_DO_COOKIE } from "./cookie";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: OPCOES_DO_COOKIE },
  );
}
