import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { lerTipo, textoSobreProduto } from "@/lib/time/chamados";
import { lerChamados, lerMeusSetores, lerPessoas, lerProdutoDoChamado } from "@/lib/time/dados";
import { abrir } from "./actions";
import { TelaDosChamados, type Novo } from "./Tela";

export const metadata = { title: "Chamados" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Chamados entre setores: pedir uma coisa a outro setor, com dono e relógio.
 *
 * Toda pessoa ativa vê todos os chamados e pode abrir e responder (área
 * `time`, de todos os níveis). O desenho mora em `Tela.tsx`.
 *
 * `?novo=<tipo>` abre a tela já no formulário, e `&produto=<id>` cita a peça:
 * é por onde chega quem clicou em "Perguntar ao time sobre esta peça" na
 * consulta. O endereço leva só o id do produto, nunca texto digitado.
 */
export default async function ChamadosPage({ searchParams }: { searchParams: Promise<{ novo?: string; produto?: string }> }) {
  const perfil = await requireArea("time");
  const sp = await searchParams;
  const db = await createClient();
  const [chamados, meusSetores, pessoas, produto] = await Promise.all([
    lerChamados(db),
    lerMeusSetores(db),
    lerPessoas(db),
    sp.produto && UUID.test(sp.produto) ? lerProdutoDoChamado(db, sp.produto) : null,
  ]);

  const novo: Novo | null =
    sp.novo !== undefined || produto
      ? {
          tipo: lerTipo(sp.novo) ?? (produto ? "estoque_prazo" : null),
          texto: produto ? textoSobreProduto(produto) : "",
          produto: produto?.id ?? null,
          produtoNome: produto?.nome ?? null,
        }
      : null;

  return (
    <TelaDosChamados
      chamados={chamados}
      meuId={perfil.id}
      meusSetores={meusSetores}
      pessoas={pessoas}
      agora={new Date().toISOString()}
      novo={novo}
      abrir={abrir}
    />
  );
}
