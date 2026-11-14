import { createBrowserClient } from "@supabase/ssr";
import { OPCOES_DO_COOKIE } from "./cookie";

/**
 * O cliente do Supabase no navegador.
 *
 * `worker: true` é por causa do chat do time. A ligação ao vivo manda um
 * batimento a cada 25 segundos para não cair, e o navegador segura os relógios
 * de aba em segundo plano (depois de cinco minutos, um disparo por minuto):
 * o batimento atrasa, a ligação cai, e a pessoa some da lista de quem está
 * online e para de receber o aviso de mensagem nova justamente quando está em
 * outra janela. Com o batimento num worker, ele não é segurado. O worker é
 * montado de um texto que vem dentro do próprio pacote, sem buscar nada de
 * fora, e só nasce quando alguma ligação ao vivo é aberta.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: OPCOES_DO_COOKIE,
      // Sem `Worker` (não há navegador de hoje assim), o cliente recusaria nascer: aí fica o batimento comum.
      ...(typeof Worker === "undefined" ? {} : { realtime: { worker: true } }),
    },
  );
}
