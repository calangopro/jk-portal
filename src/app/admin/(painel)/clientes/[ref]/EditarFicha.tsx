"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, Loader2 } from "lucide-react";
import type { CamposDaFicha, DadosDaFicha } from "@/lib/clientes/dados";
import {
  FASES, dataPorExtenso, interpretarDataDigitada, type Fase, type Sugestao,
} from "@/lib/clientes/oportunidades";
import { nomeLimpo } from "@/lib/vendas/origem";
import { SeloDeTom } from "../../Pecas";

/**
 * O que o time sabe do cliente: fase, nome do par, as quatro datas, quem cuida
 * e as anotações.
 *
 * Poucos campos e um botão só. Salvar grava SÓ o que mudou e não tira a pessoa
 * da tela. As datas aceitam dia e mês ("12/06") ou a data inteira
 * ("12/06/2024"): aniversário quase nunca vem com o ano.
 *
 * As datas lidas da gravação da aliança aparecem aqui como sugestão, e nada é
 * guardado sozinho: alguém diz o que a data é (começo do namoro, casamento) ou
 * diz que não é do casal.
 *
 * A ação vem de fora, como propriedade, para a tela poder ser vista sem sessão.
 */

type Salvar = (ref: string, campos: CamposDaFicha) => Promise<{ ok: true } | { ok: false; erro: string }>;

const DATAS = [
  { campo: "aniversario", rotulo: "Aniversário do cliente" },
  { campo: "aniversario_par", rotulo: "Aniversário do par" },
  { campo: "data_namoro", rotulo: "Começo do namoro" },
  { campo: "data_casamento", rotulo: "Casamento" },
] as const;

type CampoDeData = (typeof DATAS)[number]["campo"];

type Estado = {
  fase: Fase;
  par: string;
  datas: Record<CampoDeData, string>;
  responsavel: string;
  notas: string;
};

function estadoDe(f: DadosDaFicha | null): Estado {
  return {
    fase: f?.fase ?? "nao_sei",
    par: f?.parNome ?? "",
    datas: {
      aniversario: dataPorExtenso(f?.aniversario),
      aniversario_par: dataPorExtenso(f?.aniversarioPar),
      data_namoro: dataPorExtenso(f?.dataNamoro),
      data_casamento: dataPorExtenso(f?.dataCasamento),
    },
    responsavel: f?.responsavelId ?? "",
    notas: f?.anotacoes ?? "",
  };
}

/** "1206" vira "12/06" e "12062024" vira "12/06/2024", para o teclado de números do celular bastar. */
function mascararData(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** "&#10084;" que a loja manda no texto da gravação vira o caractere. */
const semEntidades = (s: string) => s.replace(/&#(\d{2,7});/g, (_, n) => String.fromCodePoint(Number(n)));

export function EditarFicha({
  refDoCliente, inicial, equipe, eu, sugestoes, anoDeHoje, salvar,
}: {
  refDoCliente: string;
  inicial: DadosDaFicha | null;
  equipe: { id: string; nome: string }[];
  eu: string;
  sugestoes: Sugestao[];
  anoDeHoje: number;
  salvar: Salvar;
}) {
  const router = useRouter();
  const [base, setBase] = useState<Estado>(() => estadoDe(inicial));
  const [e, setE] = useState<Estado>(() => estadoDe(inicial));
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [resolvidas, setResolvidas] = useState<string[]>([]);
  const [ocupado, comecar] = useTransition();

  const mudar = (parte: Partial<Estado>) => {
    setE((atual) => ({ ...atual, ...parte }));
    setSalvo(false);
    setErro(null);
  };

  /** O que mudou em relação ao que está gravado, e as datas que não deu para entender. */
  function mudancas(): { campos: CamposDaFicha; datasTortas: CampoDeData[] } {
    const campos: CamposDaFicha = {};
    const datasTortas: CampoDeData[] = [];
    if (e.fase !== base.fase) campos.fase = e.fase;
    if (e.par.trim() !== base.par.trim()) campos.par_nome = e.par.trim() || null;
    if (e.notas.trim() !== base.notas.trim()) campos.anotacoes = e.notas.trim() || null;
    if (e.responsavel !== base.responsavel) campos.responsavel_id = e.responsavel || null;
    for (const { campo } of DATAS) {
      if (e.datas[campo].trim() === base.datas[campo].trim()) continue;
      const data = interpretarDataDigitada(e.datas[campo], anoDeHoje);
      if (data === undefined) datasTortas.push(campo);
      else campos[campo] = data;
    }
    return { campos, datasTortas };
  }

  const { campos, datasTortas } = mudancas();
  const mudou = Object.keys(campos).length > 0 || datasTortas.length > 0;

  const gravar = () =>
    comecar(async () => {
      if (datasTortas.length > 0) {
        setErro("Tem data que não deu para entender. Escreva como 12/06 ou 12/06/2024.");
        return;
      }
      const r = await salvar(refDoCliente, campos);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      // O que ficou gravado passa a ser a base: a data digitada "120624" vira "12/06/2024" na caixa.
      const novo: Estado = { ...e, par: e.par.trim(), notas: e.notas.trim(), datas: { ...e.datas } };
      for (const { campo } of DATAS) if (campo in campos) novo.datas[campo] = dataPorExtenso(campos[campo] ?? null);
      setBase(novo);
      setE(novo);
      setSalvo(true);
      router.refresh();
    });

  /** Confirma (ou recusa) uma data lida da gravação. Grava na hora, sem esperar o botão de salvar. */
  const decidirSugestao = (s: Sugestao, campo: "data_namoro" | "data_casamento" | null) =>
    comecar(async () => {
      setErro(null);
      const r = await salvar(refDoCliente, campo ? { [campo]: s.data } : { recusar_data: s.data });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setResolvidas((lista) => [...lista, s.data]);
      if (campo) {
        const porExtenso = dataPorExtenso(s.data);
        setBase((b) => ({ ...b, datas: { ...b.datas, [campo]: porExtenso } }));
        setE((atual) => ({ ...atual, datas: { ...atual.datas, [campo]: porExtenso } }));
      }
      router.refresh();
    });

  const abertas = sugestoes.filter((s) => !resolvidas.includes(s.data));
  const rotulo = "text-xs font-semibold text-ink";
  const caixa = "mt-1.5 h-11 w-full rounded-[10px] border border-ink/15 bg-white px-3 text-base text-ink outline-none focus:border-[var(--setor)] sm:text-sm";
  const pequeno = "painel-toque inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold disabled:opacity-60";

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className={rotulo}>Fase</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {FASES.map((f) => {
            const ativa = e.fase === f.chave;
            return (
              <label
                key={f.chave}
                className={`painel-toque inline-flex h-10 cursor-pointer items-center rounded-full px-4 text-sm font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--setor)] ${ativa ? "painel-aba-ativa" : "border border-ink/12 bg-white text-ink"}`}
              >
                <input type="radio" name="fase" value={f.chave} checked={ativa} onChange={() => mudar({ fase: f.chave })} className="sr-only" />
                {f.nome}
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="block">
        <span className={rotulo}>Nome do par</span>
        <input value={e.par} onChange={(ev) => mudar({ par: ev.target.value })} maxLength={120} autoComplete="off" placeholder="Quem usa a outra aliança" className={caixa} />
      </label>

      {abertas.length > 0 ? (
        <div className="space-y-2.5" aria-label="Datas sugeridas pela gravação">
          {abertas.map((s) => (
            <div key={s.data} className="rounded-[12px] p-3.5" style={{ background: "#fcefd9" }}>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#6d3505]">
                <SeloDeTom tom="atencao">Sugerida pela gravação</SeloDeTom>
                <span className="numeros text-base font-bold">{dataPorExtenso(s.data)}</span>
              </p>
              <p className="mt-1.5 break-words text-xs leading-relaxed text-[#6d3505]">
                Gravado{s.pedido ? ` no pedido ${s.pedido}` : ""} ({nomeLimpo(s.peca)}): “{semEntidades(s.trecho)}”. Ainda não foi guardada. O que é esta data?
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {(["data_namoro", "data_casamento"] as const).map((campo) => (
                  <button
                    key={campo}
                    type="button"
                    disabled={ocupado}
                    onClick={() => decidirSugestao(s, campo)}
                    className={`${pequeno} ${campo === s.campo ? "bg-ink text-white" : "border border-ink/15 bg-white text-ink"}`}
                  >
                    {campo === "data_namoro" ? "Começo do namoro" : "Casamento"}
                  </button>
                ))}
                <button type="button" disabled={ocupado} onClick={() => decidirSugestao(s, null)} className={`${pequeno} border border-ink/15 bg-white text-ink`}>
                  Não é do casal
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-x-3 gap-y-4">
        {DATAS.map(({ campo, rotulo: nome }) => {
          const torta = datasTortas.includes(campo);
          return (
            <label key={campo} className="block min-w-0">
              <span className={rotulo}>{nome}</span>
              <input
                value={e.datas[campo]}
                onChange={(ev) => mudar({ datas: { ...e.datas, [campo]: mascararData(ev.target.value) } })}
                inputMode="numeric"
                autoComplete="off"
                placeholder="dia/mês"
                aria-invalid={torta || undefined}
                className={`${caixa} numeros ${torta ? "border-[#b01919]" : ""}`}
              />
            </label>
          );
        })}
      </div>
      <p className="-mt-2 text-[0.7rem] leading-relaxed text-muted">
        Dia e mês bastam (12/06). Com o ano (12/06/2024), o painel também conta quantos anos faz.
      </p>

      <div>
        <label className="block">
          <span className={rotulo}>Quem cuida deste cliente</span>
          <select value={e.responsavel} onChange={(ev) => mudar({ responsavel: ev.target.value })} className={caixa}>
            <option value="">Ninguém ainda</option>
            {equipe.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
                {p.id === eu ? " (você)" : ""}
              </option>
            ))}
          </select>
        </label>
        {eu && e.responsavel !== eu && equipe.some((p) => p.id === eu) ? (
          <button type="button" onClick={() => mudar({ responsavel: eu })} className={`${pequeno} mt-2 border border-ink/12 bg-white text-ink`}>
            Eu cuido
          </button>
        ) : null}
      </div>

      <label className="block">
        <span className={rotulo}>Anotações</span>
        <textarea
          value={e.notas}
          onChange={(ev) => mudar({ notas: ev.target.value })}
          maxLength={2000}
          rows={4}
          placeholder="O que vale lembrar na próxima conversa: gosto, tamanho do aro, o que ficou combinado"
          className="mt-1.5 w-full rounded-[10px] border border-ink/15 bg-white px-3 py-2.5 text-base leading-relaxed text-ink outline-none focus:border-[var(--setor)] sm:text-sm"
        />
      </label>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          disabled={ocupado || !mudou}
          onClick={gravar}
          className="painel-toque painel-aba-ativa inline-flex h-11 basis-full items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold disabled:opacity-50 sm:basis-auto"
        >
          {ocupado ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null} Salvar a ficha
        </button>
        <p className="text-xs" role="status" aria-live="polite">
          {erro ? (
            <span className="inline-flex items-center gap-1 font-semibold text-[#b01919]">
              <CircleAlert size={13} aria-hidden="true" /> {erro}
            </span>
          ) : salvo ? (
            <span className="inline-flex items-center gap-1 font-semibold text-[#046c4e]">
              <Check size={13} aria-hidden="true" /> Salvo
            </span>
          ) : mudou ? (
            <span className="text-muted">Tem alteração sem salvar.</span>
          ) : null}
        </p>
      </div>
    </div>
  );
}
