import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireArea } from "@/lib/auth/session";
import { contaDaFicha, lerFichaDoCliente, lerLojasFisicas } from "@/lib/clientes/dados";
import { lerRef } from "@/lib/clientes/identidade";
import { oportunidadesDoCliente, sugestoesDaGravacao } from "@/lib/clientes/oportunidades";
import { createClient } from "@/lib/supabase/server";
import { hojeEmSaoPaulo } from "@/lib/vendas/periodo";
import { marcar, salvar } from "../actions";
import { TelaDaFicha } from "./TelaDaFicha";

/** O título da aba não leva o nome do cliente: título fica no histórico do navegador. */
export const metadata = { title: "Ficha do cliente" };

/** Quantos dias à frente a ficha olha para dizer o que há para oferecer. */
const DIAS_NA_FICHA = 90;

const SEM_FICHA: Record<string, { titulo: string; texto: string }> = {
  nao_encontrado: {
    titulo: "Não achei este cliente.",
    texto: "O endereço pode estar errado, ou o pedido que levava a ele saiu do painel. Volte para a busca e procure pelo nome ou pelo telefone.",
  },
  sem_telefone: {
    titulo: "Esta venda foi lançada sem telefone.",
    texto: "A ficha junta as compras pelo telefone do cliente. Sem ele, não dá para saber de quem é a venda. Na próxima, registre a venda com o telefone.",
  },
  sem_acesso: { titulo: "O seu acesso não abre a ficha de clientes.", texto: "Peça a quem cuida dos acessos para liberar a área de vendas." },
  erro: { titulo: "Não deu para abrir a ficha agora.", texto: "Recarregue a página em alguns segundos." },
};

/**
 * A ficha de um cliente.
 *
 * O endereço traz uma REFERÊNCIA (`p` mais um pedido, `v` mais uma venda por
 * fora, `l` mais um cadastro no grupo), nunca o telefone ou o e-mail: endereço
 * fica em histórico e em registro de servidor. Quem troca a referência pela
 * pessoa é o banco, depois de conferir a área `lancar_venda`.
 *
 * As sugestões da gravação e as oportunidades são CONTA sobre a ficha lida
 * (`lib/clientes/oportunidades.ts`), feita aqui a cada visita.
 */
export default async function FichaDoClientePage({ params }: { params: Promise<{ ref: string }> }) {
  const profile = await requireArea("lancar_venda");
  const { ref } = await params;

  const leitura = lerRef(ref)
    ? await lerFichaDoCliente(await createClient(), ref)
    : ({ ok: false, motivo: "nao_encontrado" } as const);

  if (!leitura.ok) {
    const aviso = SEM_FICHA[leitura.motivo];
    return (
      <div data-painel-largo>
        <Link href="/admin/clientes" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink">
          <ArrowLeft size={14} aria-hidden="true" /> Clientes
        </Link>
        <p className="glass mt-5 rounded-[18px] p-6 text-sm text-muted">
          <span className="font-semibold text-ink">{aviso.titulo}</span> {aviso.texto}
        </p>
      </div>
    );
  }

  const hoje = hojeEmSaoPaulo();
  const conta = contaDaFicha(leitura.ficha);
  const lojas = await lerLojasFisicas();

  return (
    <TelaDaFicha
      f={leitura.ficha}
      sugestoes={sugestoesDaGravacao(conta)}
      oportunidades={oportunidadesDoCliente(conta, hoje, DIAS_NA_FICHA, lojas)}
      hoje={hoje}
      podeVerRecuperacao={profile.areas.includes("recuperacao")}
      salvar={salvar}
      marcar={marcar}
    />
  );
}
