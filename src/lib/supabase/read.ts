import { createClient } from "@supabase/supabase-js";

/**
 * Cliente de LEITURA pública, sem cookies — usado em SSG/ISR (build e
 * revalidação) para buscar conteúdo publicado. Usa a anon key: a RLS do banco
 * garante que só linhas com status='published' são retornadas.
 *
 * Retorna null se as variáveis de ambiente não estiverem configuradas, para
 * que a camada de dados caia no conteúdo de exemplo sem quebrar o build.
 */
export function createReadClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;

  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
