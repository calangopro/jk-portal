"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CircleCheck, CircleDashed, Sparkles } from "lucide-react";
import { EXPLICACAO_DA_FASE, FASES, NOME_DA_FASE, palpiteDaFase, type Fase } from "@/lib/kommo/funil";
import type { ResultadoDaFase } from "./actions";

/** O que `kommo_fases_lista` (0162) devolve. */
export type FunisComFases = {
  funil_id: number;
  funil: string;
  principal: boolean;
  etapas: {
    etapa_id: number;
    etapa: string;
    tipo: "entrada" | "aberta" | "ganho" | "perdido";
    ordem: number;
    fase: Fase | null;
    origem: "palpite" | "pessoa" | null;
    definido_em: string | null;
    definido_por: string | null;
    abertos: number;
  }[];
}[];

type Props = {
  funis: FunisComFases | null;
  aoSalvar: (funil: number, etapa: number, fase: string) => Promise<ResultadoDaFase>;
  aoConfirmar: () => Promise<ResultadoDaFase>;
};

const campo = "w-full min-w-0 rounded-[10px] border border-border bg-white/80 px-3 py-2 text-sm text-ink outline-none focus:border-brand";

function Etapa({ funil, e, aoSalvar }: { funil: FunisComFases[number]; e: FunisComFases[number]["etapas"][number]; aoSalvar: Props["aoSalvar"] }) {
  const [fase, setFase] = useState<string>(e.fase ?? "");
  const [origem, setOrigem] = useState(e.origem);
  const [recado, setRecado] = useState<{ ok: boolean; texto: string } | null>(null);
  const [salvando, comecar] = useTransition();
  // Sem linha no banco, a tela mostra o que o palpite diria, sem salvar: a etapa continua sem fase até alguém escolher.
  const sugestao = origem === null ? palpiteDaFase({ funil_id: funil.funil_id, funil: funil.funil, etapa_id: e.etapa_id, etapa: e.etapa, tipo: e.tipo }) : null;

  const estado =
    origem === "pessoa"
      ? { Icone: CircleCheck, cor: "text-emerald-800", texto: fase ? "Conferida" : "Sem fase, por decisão" }
      : origem === "palpite"
        ? { Icone: Sparkles, cor: "text-amber-800", texto: "Palpite pelo nome, confira" }
        : { Icone: CircleDashed, cor: "text-amber-800", texto: "Sem fase" };

  return (
    <li className="grid min-w-0 grid-cols-1 gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)] sm:items-center">
      <div className="min-w-0">
        <p className="break-words text-sm font-medium text-ink">
          {e.etapa}
          {e.etapa_id === 142 || e.etapa_id === 143 ? <span className="ml-1 text-xs text-muted">({e.etapa_id === 142 ? "fechado ganho" : "fechado perdido"} na Kommo)</span> : null}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
          <span className={`inline-flex items-center gap-1 font-semibold ${estado.cor}`}>
            <estado.Icone size={12} aria-hidden /> {estado.texto}
          </span>
          <span className="text-muted">
            {e.abertos.toLocaleString("pt-BR")} {e.abertos === 1 ? "aberto" : "abertos"}
          </span>
          {sugestao ? <span className="text-muted">O nome sugere: {NOME_DA_FASE[sugestao]}</span> : null}
          {origem === "pessoa" && e.definido_por ? <span className="text-muted">por {e.definido_por}</span> : null}
        </p>
      </div>
      <div className="min-w-0">
        <label className="sr-only" htmlFor={`fase-${funil.funil_id}-${e.etapa_id}`}>Fase de {e.etapa}</label>
        <select
          id={`fase-${funil.funil_id}-${e.etapa_id}`}
          className={campo}
          value={fase}
          disabled={salvando}
          onChange={(ev) => {
            const nova = ev.target.value;
            const antes = fase;
            setFase(nova);
            setRecado(null);
            comecar(async () => {
              const r = await aoSalvar(funil.funil_id, e.etapa_id, nova);
              if (r.ok) {
                setOrigem("pessoa");
                setRecado({ ok: true, texto: "Salvo." });
              } else {
                setFase(antes);
                setRecado({ ok: false, texto: r.erro ?? "Não deu para salvar." });
              }
            });
          }}
        >
          <option value="">Sem fase</option>
          {FASES.map((f) => (
            <option key={f} value={f}>{NOME_DA_FASE[f]}</option>
          ))}
        </select>
        {salvando ? <p className="mt-1 text-xs text-muted" role="status">Salvando...</p> : null}
        {recado ? (
          <p role={recado.ok ? "status" : "alert"} className={`mt-1 text-xs ${recado.ok ? "text-emerald-800" : "text-red-800"}`}>{recado.texto}</p>
        ) : null}
      </div>
    </li>
  );
}

export function TelaDasFases({ funis, aoSalvar, aoConfirmar }: Props) {
  const [confirmando, comecar] = useTransition();
  const [recado, setRecado] = useState<{ ok: boolean; texto: string } | null>(null);
  const etapas = funis?.flatMap((f) => f.etapas) ?? [];
  const palpites = etapas.filter((e) => e.origem === "palpite").length;
  const semFase = etapas.filter((e) => e.fase === null).length;

  return (
    <>
      <header>
        <p className="eyebrow">Sistema</p>
        <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Fases da Kommo</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted sm:text-base">
          Cada etapa dos funis da Kommo ligada a uma fase padrão, para o{" "}
          <Link href="/admin/funil" className="font-semibold underline underline-offset-2">Funil da Kommo</Link> somar loja com
          loja. A leitura da Kommo preenche a etapa nova com um palpite pelo nome; etapa com nome que o palpite não reconhece
          fica sem fase até alguém escolher aqui. Mudar aqui não mexe em nada na Kommo.
        </p>
      </header>

      <details className="glass mt-6 rounded-[16px] p-4">
        <summary className="cursor-pointer text-sm font-semibold text-ink">O que é cada fase</summary>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {FASES.map((f) => (
            <div key={f} className="min-w-0">
              <dt className="font-semibold text-ink">{NOME_DA_FASE[f]}</dt>
              <dd className="text-muted">{EXPLICACAO_DA_FASE[f]}</dd>
            </div>
          ))}
        </dl>
      </details>

      {!funis ? (
        <p className="glass mt-6 rounded-[16px] p-4 text-sm text-muted">Não deu para ler as etapas agora.</p>
      ) : funis.length === 0 ? (
        <p className="glass mt-6 rounded-[16px] p-4 text-sm text-ink">
          Nenhum funil da Kommo no painel ainda. Os funis chegam na primeira leitura, depois que a chave da Kommo estiver colada
          em <Link href="/admin/integracoes" className="font-semibold underline underline-offset-2">Integrações</Link>.
        </p>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <p className="text-sm text-ink">
              {palpites === 0 && semFase === 0
                ? "Todas as etapas estão conferidas."
                : [
                    palpites > 0 ? `${palpites} ${palpites === 1 ? "etapa com fase por palpite" : "etapas com fase por palpite"}` : null,
                    semFase > 0 ? `${semFase} ${semFase === 1 ? "etapa sem fase" : "etapas sem fase"}` : null,
                  ].filter(Boolean).join(", ") + "."}
            </p>
            {palpites > 0 ? (
              <button
                type="button"
                disabled={confirmando}
                onClick={() => {
                  setRecado(null);
                  comecar(async () => {
                    const r = await aoConfirmar();
                    setRecado(r.ok ? { ok: true, texto: `${r.confirmadas ?? 0} confirmadas.` } : { ok: false, texto: r.erro ?? "Não deu para confirmar." });
                  });
                }}
                className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-ink transition-colors hover:bg-brand-light disabled:opacity-60"
              >
                {confirmando ? "Confirmando..." : "Confirmar todos os palpites"}
              </button>
            ) : null}
            {recado ? (
              <p role={recado.ok ? "status" : "alert"} className={`text-xs ${recado.ok ? "text-emerald-800" : "text-red-800"}`}>{recado.texto}</p>
            ) : null}
          </div>

          <ul className="mt-4 grid grid-cols-1 gap-3">
            {funis.map((f) => (
              <li key={f.funil_id} className="glass min-w-0 rounded-[16px] p-4">
                <h2 className="break-words text-base font-semibold text-ink">
                  {f.funil}
                  {f.principal ? <span className="ml-2 text-xs font-normal text-muted">(funil principal)</span> : null}
                </h2>
                <ul className="mt-1 divide-y divide-border/60">
                  {f.etapas.map((e) => (
                    <Etapa key={e.etapa_id} funil={f} e={e} aoSalvar={aoSalvar} />
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
