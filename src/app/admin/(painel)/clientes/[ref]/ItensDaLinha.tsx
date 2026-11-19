import Link from "next/link";
import {
  ArrowRightLeft, BadgeCheck, CircleDollarSign, ExternalLink, Factory, Handshake, LifeBuoy, Megaphone, MessageSquare,
  MousePointerClick, PackageCheck, RefreshCcw, Trash2, Truck, UserRoundCheck, UserRoundCog, XCircle, type LucideIcon,
} from "lucide-react";
import type { ItemDaLinha } from "@/lib/clientes/linha-do-tempo";
import type { Area } from "@/lib/auth/acessos";
import { textoDoEvento, type EventoDoPedido } from "@/lib/pedidos/historico";
import { NOME_DO_CANAL, type Canal } from "@/lib/vendas/origem";
import { BotaoDoHistorico } from "../../pedido/abrir";
import { SeloDeTom } from "../../Pecas";

/**
 * Os itens da linha do tempo que vêm da 0185: a Kommo, as chegadas ao site e
 * o que o histórico de cada pedido sabe (fábrica, suporte, quem vendeu, chat).
 * Cada um em uma frase, com o link para onde ele mora. As frases dos
 * acontecimentos do pedido são as MESMAS da gaveta do histórico
 * (`textoDoEvento`).
 */

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const canal = (c: string) => NOME_DO_CANAL[c as Canal] ?? c;
const link = "inline-flex items-center gap-1 text-xs font-semibold text-ink underline underline-offset-2";

/** A moldura de cada item: o ícone na trilha, a data e o conteúdo. */
export function Evento({ Icone, quando, children }: { Icone: LucideIcon; quando: string; children: React.ReactNode }) {
  return (
    <li className="relative min-w-0 pl-9">
      <span className="painel-selo absolute left-0 top-0 grid h-7 w-7 place-items-center rounded-full">
        <Icone size={14} aria-hidden="true" />
      </span>
      <p className="numeros text-[0.7rem] font-semibold uppercase tracking-wider text-muted">{quando}</p>
      <div className="mt-1 min-w-0">{children}</div>
    </li>
  );
}

function Frase({
  titulo, detalhe, quem, com, children,
}: { titulo: string; detalhe?: string | null; quem?: string | null; com?: string | null; children?: React.ReactNode }) {
  // "Thiago marcou que vendeu" já diz quem foi: sem o ", por Thiago Lourenço" repetido.
  const jaDiz = (nome: string) => titulo.includes(nome.trim().split(/\s+/)[0]);
  const autor = quem && !jaDiz(quem) ? `, por ${quem}` : com && !jaDiz(com) ? `, com ${com}` : null;
  return (
    <>
      <p className="break-words text-sm text-ink [overflow-wrap:anywhere]">
        <span className="font-semibold">{titulo}</span>
        {autor ? <span className="text-muted">{autor}</span> : null}
      </p>
      {detalhe ? <p className="mt-0.5 break-words text-xs text-muted [overflow-wrap:anywhere]">{detalhe}</p> : null}
      {children ? <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">{children}</div> : null}
    </>
  );
}

const ICONE_DO_PEDIDO: Record<EventoDoPedido["tipo"], LucideIcon> = {
  criado: PackageCheck,
  chegada: MousePointerClick,
  pago: CircleDollarSign,
  status: RefreshCcw,
  envio: Truck,
  fabrica: Factory,
  recuperacao: RefreshCcw,
  venda_fora: Handshake,
  suporte: LifeBuoy,
  vendedor: UserRoundCheck,
  chat: MessageSquare,
};

function DoPedido({ i, areas }: { i: Extract<ItemDaLinha, { tipo: "do_pedido" }>; areas: Area[] }) {
  const t = textoDoEvento(i.evento, canal);
  const e = i.evento;
  return (
    // Pagamento e envio só têm o dia na loja: a hora de ordenação (fim do dia) não vai para a tela.
    <Evento Icone={ICONE_DO_PEDIDO[e.tipo]} quando={e.tipo === "pago" || e.tipo === "envio" ? quando(i.em).slice(0, 10) : quando(i.em)}>
      <Frase titulo={t.titulo} detalhe={t.detalhe} quem={t.quem}>
        {i.pedido !== null ? <span className="numeros text-xs text-muted">Pedido {i.pedido}</span> : <span className="text-xs text-muted">Venda por fora</span>}
        {e.tipo === "fabrica" && areas.includes("fabrica") && i.pedido !== null ? (
          <Link href={`/admin/fabrica?busca=${i.pedido}`} className={link}>Ver na fábrica</Link>
        ) : null}
        {e.tipo === "suporte" && (areas.includes("suporte") || areas.includes("lancar_venda")) ? (
          <Link href="/admin/suporte" className={link}>Ver no suporte</Link>
        ) : null}
        {i.pedido !== null ? <BotaoDoHistorico numero={i.pedido} /> : null}
      </Frase>
    </Evento>
  );
}

function Chegada({ i }: { i: Extract<ItemDaLinha, { tipo: "chegada" }> }) {
  const anuncio = i.plataforma !== null;
  const nomeDoAnuncio = [i.campanha, i.anuncio].filter(Boolean).join(" · ");
  const deQuem = i.plataforma === "google" ? "do Google" : i.plataforma === "meta" ? "do Meta" : "";
  return (
    <Evento Icone={anuncio ? Megaphone : MousePointerClick} quando={quando(i.em)}>
      <Frase
        titulo={anuncio ? `Clicou num anúncio ${deQuem}`.trim() : `Chegou ao site por ${i.canal ? canal(i.canal) : "um caminho sem nome"}`}
        detalhe={anuncio ? nomeDoAnuncio || null : i.campaign}
      >
        {i.levou ? <SeloDeTom tom="bom">Levou à compra do pedido {i.pedido}</SeloDeTom> : null}
        <BotaoDoHistorico numero={i.pedido} rotulo={`Pedido ${i.pedido}`} />
      </Frase>
    </Evento>
  );
}

function NaKommo({ i }: { i: Extract<ItemDaLinha, { tipo: "kommo_criado" | "kommo_fechado" | "kommo_evento" }> }) {
  const n = i.negocio;
  const abrir = n ? (
    <a href={n.link} target="_blank" rel="noreferrer" className={link}>
      <ExternalLink size={11} aria-hidden="true" /> Abrir na Kommo
    </a>
  ) : null;
  const nome = n?.nome ? `"${n.nome}"` : null;

  if (i.tipo === "kommo_criado" && n) {
    return (
      <Evento Icone={Handshake} quando={quando(i.em)}>
        <Frase titulo="Negócio aberto na Kommo" detalhe={[nome, n.funil ? `funil ${n.funil}` : null].filter(Boolean).join(", ") || null}>{abrir}</Frase>
      </Evento>
    );
  }
  if (i.tipo === "kommo_fechado" && n) {
    return (
      <Evento Icone={n.ganho ? BadgeCheck : XCircle} quando={quando(i.em)}>
        <Frase titulo={n.ganho ? "Venda ganha na Kommo" : "Negócio perdido na Kommo"} detalhe={nome} com={n.pessoa ?? n.responsavel}>
          {abrir}
        </Frase>
      </Evento>
    );
  }
  if (i.tipo !== "kommo_evento") return null;
  const e = i.evento;
  const quem = e.robo ? "automação da Kommo" : e.quem;
  if (e.tipo === "lead_status_changed") {
    const para = e.etapaPara?.etapa ?? "outra etapa";
    const mudouDeFunil = e.etapaDe?.funil && e.etapaPara?.funil && e.etapaDe.funil !== e.etapaPara.funil;
    return (
      <Evento Icone={ArrowRightLeft} quando={quando(i.em)}>
        <Frase
          titulo={`Na Kommo, foi para "${para}"`}
          detalhe={[
            e.etapaDe?.etapa ? `Estava em "${e.etapaDe.etapa}"` : null,
            mudouDeFunil ? `mudou do funil ${e.etapaDe?.funil} para ${e.etapaPara?.funil}` : null,
            nome,
          ].filter(Boolean).join(", ") || null}
          quem={quem}
        >
          {abrir}
        </Frase>
      </Evento>
    );
  }
  if (e.tipo === "entity_responsible_changed") {
    return (
      <Evento Icone={UserRoundCog} quando={quando(i.em)}>
        <Frase titulo={`Na Kommo, passou para ${e.responsavelPara ?? "outra pessoa"}`} detalhe={nome} quem={quem}>{abrir}</Frase>
      </Evento>
    );
  }
  const titulo = e.tipo === "lead_deleted" ? "Negócio apagado na Kommo" : e.tipo === "lead_restored" ? "Negócio restaurado na Kommo" : "Negócio aberto na Kommo";
  return (
    <Evento Icone={e.tipo === "lead_deleted" ? Trash2 : Handshake} quando={quando(i.em)}>
      <Frase titulo={titulo} detalhe={nome} quem={quem}>{abrir}</Frase>
    </Evento>
  );
}

/** O desenho de um item que veio da 0185. Os da ficha (pedido, venda, cadastro, recuperação) a tela desenha. */
export function ItemNovo({ i, areas }: { i: ItemDaLinha; areas: Area[] }) {
  switch (i.tipo) {
    case "do_pedido":
      return <DoPedido i={i} areas={areas} />;
    case "chegada":
      return <Chegada i={i} />;
    case "kommo_criado":
    case "kommo_fechado":
    case "kommo_evento":
      return <NaKommo i={i} />;
    default:
      return null;
  }
}
