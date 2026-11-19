"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CircleCheck, CircleDashed, Store, UserRound } from "lucide-react";
import type { ResultadoDoMapa } from "./actions";

export type MapaDaKommo = {
  usuarios: {
    id: number;
    nome: string;
    ativo: boolean;
    administrador: boolean;
    papel: Papel | null;
    profile_id: string | null;
    location_id: string | null;
    negocios_abertos: number;
  }[];
  pessoas: { id: string; nome: string; papel: string }[];
  lojas: { id: string; nome: string }[];
};

type Papel = "loja" | "vendedor" | "diretoria" | "outro";
const PAPEIS: { valor: Papel; nome: string }[] = [
  { valor: "loja", nome: "Loja física" },
  { valor: "vendedor", nome: "Vendedor" },
  { valor: "diretoria", nome: "Diretoria" },
  { valor: "outro", nome: "Outro (agência, teste)" },
];

const campo =
  "w-full min-w-0 rounded-[10px] border border-border bg-white/80 px-3 py-2 text-sm text-ink outline-none focus:border-brand";
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Palpite para quem ainda não foi ligado: usuário com o nome de uma loja vira
 * "loja física" daquela loja ("GRANJA VIANNA" e "Granja Viana" casam pela
 * primeira palavra). É só o valor inicial dos campos: nada é salvo sem o botão.
 */
function palpite(nome: string, lojas: MapaDaKommo["lojas"]): { papel: Papel; loja: string } | null {
  const n = semAcento(nome);
  if (!n) return null;
  const primeira = n.split(" ")[0];
  const loja = lojas.find((l) => {
    const ln = semAcento(l.nome);
    return ln.includes(n) || (primeira.length >= 5 && ln.split(" ").some((p) => p.startsWith(primeira.slice(0, 5))));
  });
  return loja ? { papel: "loja", loja: loja.id } : null;
}

function Linha({ u, mapa, aoSalvar }: { u: MapaDaKommo["usuarios"][number]; mapa: MapaDaKommo; aoSalvar: Props["aoSalvar"] }) {
  const sugerido = u.papel ? null : palpite(u.nome, mapa.lojas);
  const [papel, setPapel] = useState<Papel>(u.papel ?? sugerido?.papel ?? "vendedor");
  const [pessoa, setPessoa] = useState(u.profile_id ?? "");
  const [loja, setLoja] = useState(u.location_id ?? sugerido?.loja ?? "");
  const [recado, setRecado] = useState<{ ok: boolean; texto: string } | null>(null);
  const [salvando, comecar] = useTransition();
  const ligado = Boolean(u.papel);

  return (
    <li className="glass min-w-0 rounded-[16px] p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold text-ink">{u.nome}</p>
          <p className="mt-0.5 text-xs text-muted">
            {u.ativo ? "Ativo na Kommo" : "Desativado na Kommo"}
            {u.administrador ? ", administrador" : ""}
            {`, ${u.negocios_abertos.toLocaleString("pt-BR")} ${u.negocios_abertos === 1 ? "negócio aberto" : "negócios abertos"}`}
          </p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 text-xs font-semibold ${ligado ? "text-emerald-800" : "text-amber-800"}`}>
          {ligado ? <CircleCheck aria-hidden className="h-4 w-4" /> : <CircleDashed aria-hidden className="h-4 w-4" />}
          {ligado ? "Ligado" : sugerido ? "Sem ligação (palpite abaixo)" : "Sem ligação"}
        </span>
      </div>

      <form
        className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3"
        onSubmit={(ev) => {
          ev.preventDefault();
          setRecado(null);
          comecar(async () => {
            const r = await aoSalvar(u.id, papel, pessoa, loja);
            setRecado(r.ok ? { ok: true, texto: "Salvo." } : { ok: false, texto: r.erro ?? "Não deu para salvar." });
          });
        }}
      >
        <label className="block min-w-0">
          <span className="text-xs font-semibold text-ink">É</span>
          <select className={`${campo} mt-1`} value={papel} onChange={(e) => setPapel(e.target.value as Papel)}>
            {PAPEIS.map((p) => (
              <option key={p.valor} value={p.valor}>{p.nome}</option>
            ))}
          </select>
        </label>
        <label className="block min-w-0">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink"><UserRound aria-hidden className="h-3.5 w-3.5" /> Pessoa do painel</span>
          <select className={`${campo} mt-1`} value={pessoa} onChange={(e) => setPessoa(e.target.value)}>
            <option value="">Nenhuma</option>
            {mapa.pessoas.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
        </label>
        <label className="block min-w-0">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink"><Store aria-hidden className="h-3.5 w-3.5" /> Loja física</span>
          <select className={`${campo} mt-1`} value={loja} onChange={(e) => setLoja(e.target.value)}>
            <option value="">Nenhuma</option>
            {mapa.lojas.map((l) => (
              <option key={l.id} value={l.id}>{l.nome}</option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
          <button
            type="submit"
            disabled={salvando}
            className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-ink transition-colors hover:bg-brand-light disabled:opacity-60"
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
          {recado ? (
            <p role={recado.ok ? "status" : "alert"} className={`text-xs ${recado.ok ? "text-emerald-800" : "text-red-800"}`}>{recado.texto}</p>
          ) : null}
        </div>
      </form>
    </li>
  );
}

type Props = { mapa: MapaDaKommo | null; aoSalvar: (usuario: number, papel: string, pessoa: string, loja: string) => Promise<ResultadoDoMapa> };

export function TelaDoMapa({ mapa, aoSalvar }: Props) {
  const ativos = mapa?.usuarios.filter((u) => u.ativo) ?? [];
  const inativos = mapa?.usuarios.filter((u) => !u.ativo) ?? [];
  const semLigacao = ativos.filter((u) => !u.papel).length;

  return (
    <>
      <header>
        <p className="eyebrow">Sistema</p>
        <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Quem é quem na Kommo</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted sm:text-base">
          Cada usuário da Kommo ligado à pessoa do painel e à loja física. As lojas são usuários lá, e os vendedores do
          site também. É com este mapa que o painel diz de quem é cada negócio e de qual loja veio a venda.
        </p>
      </header>

      {!mapa ? (
        <p className="glass mt-6 rounded-[16px] p-4 text-sm text-muted">Não deu para ler o mapa agora.</p>
      ) : mapa.usuarios.length === 0 ? (
        <p className="glass mt-6 rounded-[16px] p-4 text-sm text-ink">
          Nenhum usuário da Kommo no painel ainda. Os usuários chegam na primeira leitura, depois que a chave da Kommo
          estiver colada em{" "}
          <Link href="/admin/integracoes" className="font-semibold underline underline-offset-2">Integrações</Link>.
        </p>
      ) : (
        <>
          <p className="mt-6 text-sm text-ink">
            {semLigacao === 0
              ? "Todos os usuários ativos estão ligados."
              : `${semLigacao} ${semLigacao === 1 ? "usuário ativo ainda sem ligação" : "usuários ativos ainda sem ligação"}. O palpite vem do nome da loja e só vale depois de salvar.`}
          </p>
          <ul className="mt-4 grid grid-cols-1 gap-3">
            {ativos.map((u) => (
              <Linha key={u.id} u={u} mapa={mapa} aoSalvar={aoSalvar} />
            ))}
          </ul>
          {inativos.length ? (
            <details className="mt-6">
              <summary className="cursor-pointer text-sm font-semibold text-ink">
                {inativos.length} {inativos.length === 1 ? "usuário desativado" : "usuários desativados"} na Kommo
              </summary>
              <ul className="mt-3 grid grid-cols-1 gap-3">
                {inativos.map((u) => (
                  <Linha key={u.id} u={u} mapa={mapa} aoSalvar={aoSalvar} />
                ))}
              </ul>
            </details>
          ) : null}
        </>
      )}
    </>
  );
}
