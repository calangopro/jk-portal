import { ArrowRight, History } from "lucide-react";
import { ROTULO_DO_CAMPO, emPalavra, type Campo, type EstadoNaLoja } from "@/lib/loja/produto";
import type { Tom } from "@/lib/painel/tons";
import { SeloDeTom } from "../Pecas";

/**
 * O histórico do que o painel mandou para a loja na Tray, só o desenho. A
 * leitura fica em `page.tsx`, para a tela poder ser vista sem sessão durante o
 * desenvolvimento.
 */

/** Quantas alterações a tela traz. */
export const LIMITE = 150;

export type Linha = {
  id: number;
  feita_em: string;
  feita_por: string | null;
  loja: "jk" | "teste";
  recurso: "produto" | "variacao" | "imagem" | "pedido";
  recurso_id: string;
  rotulo: string | null;
  antes: Record<string, unknown>;
  depois: Record<string, unknown>;
  resultado: "ok" | "recusada" | "erro";
  erro: string | null;
};

const RESULTADO: Record<Linha["resultado"], { nome: string; tom: Tom }> = {
  ok: { nome: "Gravado e conferido", tom: "bom" },
  recusada: { nome: "A Tray recusou", tom: "ruim" },
  erro: { nome: "Precisa conferir", tom: "atencao" },
};
const RECURSO: Record<Linha["recurso"], string> = { produto: "Produto", variacao: "Variação", imagem: "Fotos", pedido: "Pedido" };

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** O valor de um campo do produto por extenso. Campo que o painel não conhece sai como veio. */
function valorDoCampo(campo: string, v: unknown): string {
  if (campo in ROTULO_DO_CAMPO) return emPalavra(campo as Campo, v as EstadoNaLoja[Campo]);
  return v === null || v === undefined ? "vazio" : String(v);
}

function Foto({ url }: { url: unknown }) {
  if (typeof url !== "string" || !url) {
    return <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[8px] border border-dashed border-border text-[0.6rem] text-muted">sem foto</span>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" width={56} height={56} loading="lazy" className="h-14 w-14 shrink-0 rounded-[8px] border border-border bg-white object-contain" />;
}

function Mudancas({ l }: { l: Linha }) {
  const chaves = Array.from(new Set([...Object.keys(l.antes ?? {}), ...Object.keys(l.depois ?? {})]));
  if (chaves.length === 0) return null;
  if (l.recurso === "imagem") {
    return (
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-3">
        {chaves.sort().map((posicao) => (
          <li key={posicao} className="flex items-center gap-2 text-xs text-muted">
            <span className="font-semibold text-ink">Posição {posicao}</span>
            <Foto url={l.antes?.[posicao]} />
            <ArrowRight size={13} aria-hidden="true" />
            <Foto url={l.depois?.[posicao]} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
      {chaves.map((campo) => (
        <div key={campo} className="min-w-0">
          <dt className="text-[0.68rem] font-semibold uppercase tracking-wider text-muted">{ROTULO_DO_CAMPO[campo as Campo] ?? campo}</dt>
          <dd className="numeros flex flex-wrap items-center gap-x-1.5 break-words text-ink">
            <span className="text-muted line-through">{valorDoCampo(campo, l.antes?.[campo])}</span>
            <ArrowRight size={12} className="shrink-0 text-muted" aria-hidden="true" />
            <span className="font-semibold">{valorDoCampo(campo, l.depois?.[campo])}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function TelaDeAlteracoes({ linhas, nomes, erro }: { linhas: Linha[]; nomes: Record<string, string>; erro: boolean }) {
  return (
    <>
      <header>
        <p className="eyebrow">Loja</p>
        <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Alterações na loja</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted sm:text-base">
          Tudo o que o painel mandou para a loja na Tray: quem fez, o que era e o que ficou. Entra aqui também o que a Tray
          recusou e o que ela disse que gravou mas não mudou.
        </p>
      </header>

      {erro ? (
        <p className="glass mt-8 rounded-[18px] p-5 text-sm text-muted">Não deu para ler o histórico agora. Recarregue a página em alguns segundos.</p>
      ) : linhas.length === 0 ? (
        <p className="glass mt-8 flex items-start gap-3 rounded-[18px] p-5 text-sm text-muted">
          <History size={18} className="mt-0.5 shrink-0 text-brand-nav" aria-hidden="true" />
          <span>
            <span className="font-semibold text-ink">Nenhuma alteração ainda.</span> Quando alguém editar um produto ou mandar fotos
            pela gaveta, em Produtos, a alteração aparece aqui.
          </span>
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {linhas.map((l) => {
            const r = RESULTADO[l.resultado];
            return (
              <li key={l.id} className="glass rounded-[16px] p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-muted">
                      {RECURSO[l.recurso]} · código {l.recurso_id}
                      {l.loja === "teste" ? " · loja de testes" : ""}
                    </p>
                    <p className="mt-0.5 break-words text-sm font-semibold leading-snug text-ink">{l.rotulo || "Sem nome"}</p>
                  </div>
                  <SeloDeTom tom={r.tom}>{r.nome}</SeloDeTom>
                </div>
                <Mudancas l={l} />
                {l.erro ? <p className="mt-3 rounded-[10px] bg-ink/[0.04] p-3 text-xs leading-relaxed text-ink">{l.erro}</p> : null}
                <p className="numeros mt-3 text-xs text-muted">
                  {quando(l.feita_em)}, por {l.feita_por ? (nomes[l.feita_por] ?? "alguém da equipe") : "teste do sistema"}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      {linhas.length === LIMITE ? <p className="mt-4 text-xs text-muted">Aparecem as {LIMITE} alterações mais recentes.</p> : null}
    </>
  );
}
