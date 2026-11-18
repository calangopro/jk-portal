"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlert, Lightbulb, Loader2, Monitor, Smartphone } from "lucide-react";
import type { SugestaoNaTela } from "@/lib/sugestoes/dados";
import { ABERTAS, ESTADOS, NOME_DO_ESTADO, contarPorEstado, telaDoPainel, type EstadoDaSugestao } from "@/lib/sugestoes/sugestoes";
import type { Tom } from "@/lib/painel/tons";
import { avisarQueAsContagensMudaram } from "../ContagensDoMenu";
import { SeloDeTom } from "../Pecas";
import { abrirSugestao } from "./abrir";

type Mudar = (id: number, estado: string, resposta: string) => Promise<{ ok: true } | { ok: false; erro: string }>;
type Filtro = "abertas" | "todas" | EstadoDaSugestao;

/** Nova pede o olhar da diretoria; feita é o que deu certo. O resto é estado, não juízo. */
const TOM_DO_ESTADO: Record<EstadoDaSugestao, Tom> = { nova: "atencao", planejada: "neutro", em_andamento: "neutro", feita: "bom", recusada: "neutro" };

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function BotaoDeSugerirNaTela() {
  return (
    <button
      type="button"
      onClick={abrirSugestao}
      className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink/85"
    >
      <Lightbulb size={15} aria-hidden="true" /> Sugerir melhoria
    </button>
  );
}

/**
 * A lista do roadmap. A diretoria filtra por estado (abre nas abertas) e muda
 * o estado de cada uma; os outros veem as próprias, todas, com a resposta.
 */
export function ListaDeSugestoes({ itens, diretoria, mudar }: { itens: SugestaoNaTela[]; diretoria: boolean; mudar?: Mudar }) {
  const [filtro, setFiltro] = useState<Filtro>(diretoria ? "abertas" : "todas");
  const conta = useMemo(() => contarPorEstado(itens), [itens]);
  const visiveis = useMemo(
    () => itens.filter((s) => filtro === "todas" || (filtro === "abertas" ? ABERTAS.includes(s.estado) : s.estado === filtro)),
    [itens, filtro],
  );

  if (itens.length === 0) {
    return (
      <p className="glass mt-6 rounded-[16px] p-5 text-sm text-muted">
        {diretoria
          ? "Nenhuma sugestão ainda. Quando alguém do time usar o botão Sugerir melhoria, no topo de qualquer tela, ela aparece aqui."
          : "Você ainda não mandou nenhuma sugestão. Use o botão Sugerir melhoria, no topo de qualquer tela."}
      </p>
    );
  }

  const abas: { chave: Filtro; nome: string; n: number }[] = diretoria
    ? [
        { chave: "abertas", nome: "Abertas", n: ABERTAS.reduce((n, e) => n + conta[e], 0) },
        ...ESTADOS.map((e) => ({ chave: e, nome: NOME_DO_ESTADO[e], n: conta[e] })),
        { chave: "todas", nome: "Todas", n: itens.length },
      ]
    : [];

  return (
    <section className="mt-6" aria-label="Sugestões">
      {abas.length > 0 ? (
        <nav aria-label="Filtrar por estado" className="relative flex gap-1.5 overflow-x-auto pb-1">
          {abas.map((a) => (
            <button
              key={a.chave}
              type="button"
              aria-pressed={filtro === a.chave}
              onClick={() => setFiltro(a.chave)}
              className={`painel-toque shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold ${
                filtro === a.chave ? "border-ink bg-ink text-white" : "border-border bg-white text-ink"
              }`}
            >
              {a.nome} <span className="numeros opacity-70">{a.n}</span>
            </button>
          ))}
        </nav>
      ) : null}

      {visiveis.length === 0 ? (
        <p className="mt-5 text-sm text-muted">Nenhuma sugestão neste estado.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-3">
          {visiveis.map((s) => (
            <CartaoDaSugestao key={s.id} s={s} diretoria={diretoria} mudar={mudar} />
          ))}
        </ul>
      )}
    </section>
  );
}

function CartaoDaSugestao({ s, diretoria, mudar }: { s: SugestaoNaTela; diretoria: boolean; mudar?: Mudar }) {
  const Aparelho = s.aparelho === "celular" ? Smartphone : s.aparelho === "computador" ? Monitor : null;
  return (
    <li className="glass min-w-0 rounded-[16px] p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        <SeloDeTom tom={TOM_DO_ESTADO[s.estado]}>{NOME_DO_ESTADO[s.estado]}</SeloDeTom>
        <span className="numeros">{quando(s.criadaEm)}</span>
        {diretoria ? <span className="font-semibold text-ink">{s.minha ? "Você" : (s.autor ?? "Alguém do time")}</span> : null}
        <span className="inline-flex min-w-0 items-center gap-1">
          {Aparelho ? <Aparelho size={12} aria-label={s.aparelho ?? undefined} /> : null}
          {telaDoPainel(s.tela) ? (
            <Link href={s.tela} className="text-brand-nav underline decoration-brand-nav/30 underline-offset-2 hover:decoration-brand-nav [overflow-wrap:anywhere]">
              {s.telaNome ?? s.tela}
            </Link>
          ) : (
            <span className="[overflow-wrap:anywhere]">{s.telaNome ?? s.tela}</span>
          )}
        </span>
      </div>

      <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-ink [overflow-wrap:anywhere]">{s.texto}</p>

      {s.imagens.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {s.imagens.map((img, i) => (
            <a
              key={img.caminho}
              href={img.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block h-24 w-32 overflow-hidden rounded-[10px] border border-ink/10 bg-ink/[0.03] hover:border-ink/30"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={`Print ${i + 1} da sugestão`} loading="lazy" className="h-full w-full object-cover object-top" />
            </a>
          ))}
        </div>
      ) : null}

      {diretoria && mudar ? (
        <Decisao s={s} mudar={mudar} />
      ) : s.resposta ? (
        <div className="mt-3 rounded-[12px] bg-ink/[0.04] px-3 py-2.5">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted">Resposta{s.estadoPor ? ` de ${s.estadoPor.split(" ")[0]}` : ""}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink [overflow-wrap:anywhere]">{s.resposta}</p>
        </div>
      ) : null}
    </li>
  );
}

/** O estado e a resposta, para a diretoria. A resposta é o que quem sugeriu lê. */
function Decisao({ s, mudar }: { s: SugestaoNaTela; mudar: Mudar }) {
  const router = useRouter();
  const [estado, setEstado] = useState<EstadoDaSugestao>(s.estado);
  const [resposta, setResposta] = useState(s.resposta ?? "");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const mudou = estado !== s.estado || resposta.trim() !== (s.resposta ?? "");

  const salvar = async () => {
    setSalvando(true);
    setAviso(null);
    const r = await mudar(s.id, estado, resposta).catch(() => ({ ok: false as const, erro: "Sem conexão. Tente de novo." }));
    setSalvando(false);
    if (!r.ok) {
      setAviso({ ok: false, texto: r.erro });
      return;
    }
    setAviso({ ok: true, texto: "Salvo" });
    avisarQueAsContagensMudaram();
    router.refresh();
  };

  return (
    <div className="mt-3 border-t border-ink/[0.07] pt-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[11rem_minmax(0,1fr)]">
        <label className="block min-w-0">
          <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted">Estado</span>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value as EstadoDaSugestao)}
            className="mt-1 w-full rounded-[10px] border border-border bg-white px-2.5 py-2 text-sm text-ink"
          >
            {ESTADOS.map((e) => (
              <option key={e} value={e}>{NOME_DO_ESTADO[e]}</option>
            ))}
          </select>
        </label>
        <label className="block min-w-0">
          <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted">Resposta para quem sugeriu</span>
          <textarea
            value={resposta}
            onChange={(e) => setResposta(e.target.value)}
            maxLength={2000}
            rows={2}
            placeholder="Opcional. Ex.: entra na semana que vem."
            className="mt-1 w-full resize-y rounded-[10px] border border-border bg-white px-2.5 py-2 text-sm text-ink placeholder:text-muted"
          />
        </label>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void salvar()}
          disabled={!mudou || salvando}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink/85 disabled:opacity-50"
        >
          {salvando ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
          Salvar
        </button>
        {aviso ? (
          <span role={aviso.ok ? "status" : "alert"} className="inline-flex items-center gap-1.5 text-sm" style={{ color: aviso.ok ? "#047857" : "#b91c1c" }}>
            {aviso.ok ? null : <CircleAlert size={15} aria-hidden="true" />}
            {aviso.texto}
          </span>
        ) : null}
        {s.estadoMudouEm ? (
          <span className="text-xs text-muted">
            Último ajuste {quando(s.estadoMudouEm)}
            {s.estadoPor ? `, por ${s.estadoPor.split(" ")[0]}` : ""}
          </span>
        ) : null}
      </div>
    </div>
  );
}
