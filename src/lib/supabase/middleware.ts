import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Mantém a sessão do Supabase atualizada (refresh do cookie) e protege a área
 * /admin: sem sessão, redireciona para /admin/login.
 *
 * O portal público NÃO passa por aqui (ver `matcher` em middleware.ts na raiz)
 * — crawlers de busca e IA precisam ler o conteúdo sem login.
 *
 * A autorização fina (perfil ativo, papel) é feita no layout do admin, que lê
 * o profile no banco. Aqui verificamos apenas a autenticação.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Guarda os cookies emitidos pelo Supabase (refresh de token) para que eles
  // sobrevivam mesmo quando a resposta final for um redirect.
  const pending: { name: string; value: string; options?: Record<string, unknown> }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[],
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
            pending.push({ name, value, options });
          });
        },
      },
    },
  );

  // IMPORTANTE: não coloque lógica entre createServerClient e getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /** Redirect que preserva os cookies de sessão renovados. */
  const redirectTo = (pathname: string, search = "") => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = search;
    const res = NextResponse.redirect(url);
    pending.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
    return res;
  };

  const { pathname } = request.nextUrl;
  const isLoginRoute = pathname.startsWith("/admin/login");

  if (!user && !isLoginRoute) {
    return redirectTo("/admin/login", `?next=${encodeURIComponent(pathname)}`);
  }

  // Já logado tentando ver o login: manda para o painel.
  if (user && isLoginRoute) {
    return redirectTo("/admin");
  }

  return supabaseResponse;
}
