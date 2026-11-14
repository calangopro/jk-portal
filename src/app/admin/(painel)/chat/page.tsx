import { ehAdmin } from "@/lib/auth/acessos";
import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { lerSala, textoSobreProduto } from "@/lib/time/chat";
import { lerAberturaDoChat, lerProdutoDoChat } from "@/lib/time/dados";
import { TelaDoChat } from "./Tela";

export const metadata = { title: "Chat do time" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Chat do time: a conversa entre setores, ao vivo, com quem está online.
 *
 * Toda pessoa ativa lê e escreve em todas as salas (área `time`, de todos os
 * níveis). O servidor faz só a primeira leitura; daí em diante a tela fala com
 * o banco direto do navegador (`api.ts`) e ouve o canal ao vivo
 * (`lib/time/ao-vivo.ts`). O desenho mora em `Tela.tsx`.
 *
 * O endereço aceita três coisas, e nenhuma é texto digitado:
 *   `?sala=<sala>`     abre naquela sala;
 *   `?produto=<id>`    começa a mensagem citando a peça (é por onde chega quem
 *                      clicou em "Perguntar ao time" na consulta);
 *   `?m=<número>`      vai até a mensagem (o link que a biblioteca guarda da
 *                      conversa de onde a resposta nasceu).
 * `?pedir=1` deixa "Pedir resposta" já ligado.
 */
export default async function ChatPage({ searchParams }: { searchParams: Promise<{ sala?: string; produto?: string; m?: string; pedir?: string }> }) {
  const perfil = await requireArea("time");
  const sp = await searchParams;
  const db = await createClient();
  const [abertura, produto] = await Promise.all([
    lerAberturaDoChat(db),
    sp.produto && UUID.test(sp.produto) ? lerProdutoDoChat(db, sp.produto) : null,
  ]);
  const destaque = sp.m && /^\d{1,12}$/.test(sp.m) ? Number(sp.m) : null;

  return (
    <TelaDoChat
      abertura={abertura}
      meuId={perfil.id}
      souAdmin={ehAdmin(perfil.role)}
      salaInicial={lerSala(sp.sala)}
      rascunho={produto ? textoSobreProduto(produto) : ""}
      pedirDeInicio={Boolean(produto) || sp.pedir === "1"}
      destaqueInicial={destaque}
      podeMeta={perfil.areas.includes("vendas")}
    />
  );
}
