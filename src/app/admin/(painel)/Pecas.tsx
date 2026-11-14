import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, CircleAlert, CircleCheck, Minus, TriangleAlert } from "lucide-react";
import { COR_DO_TOM, type Tom } from "@/lib/painel/tons";

/**
 * As peças visuais comuns às telas do painel: o cartão de número, o selo de
 * variação, o selo de estado e o minigráfico.
 *
 * Antes cada tela tinha as suas, todas no dourado da marca, e nada dizia de
 * relance se um número era bom ou ruim. Agora a cor tem dois papéis, e só dois:
 *   - a cor do SETOR (`--setor`, posta pela moldura) pinta o ícone, o rótulo e
 *     o gráfico de uma série só, e é o que faz Vendas parecer Vendas;
 *   - verde, âmbar e vermelho (`lib/painel/tons.ts`) dizem bom, atenção e
 *     ruim, sempre com ícone e palavra.
 *
 * Sem `use client`: são peças de desenho, servem ao servidor e ao navegador.
 */

export const ICONE_DO_TOM: Record<Tom, LucideIcon | null> = {
  bom: CircleCheck,
  atencao: TriangleAlert,
  ruim: CircleAlert,
  neutro: null,
};

/** Selo de variação contra o período anterior. `bomSeSobe` falso inverte a cor: cancelamento subir é ruim. */
export function Variacao({ d, bomSeSobe = true, sufixo = "%" }: { d: number | null; bomSeSobe?: boolean; sufixo?: string }) {
  if (d === null) return <span className="text-xs text-muted">sem comparação</span>;
  const valor = sufixo === "%" ? Math.round(d * 100) : Math.round(d * 10) / 10;
  if (valor === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted">
        <Minus size={12} aria-hidden /> igual
      </span>
    );
  }
  const subiu = valor > 0;
  const tom: Tom = subiu === bomSeSobe ? "bom" : "ruim";
  const Icone = subiu ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap text-xs font-semibold" style={{ color: COR_DO_TOM[tom].texto }}>
      <Icone size={13} aria-hidden />
      {subiu ? "subiu" : "caiu"} {Math.abs(valor).toLocaleString("pt-BR")}
      {sufixo}
    </span>
  );
}

/** Estado em uma palavra, com o ícone do tom: "Pago", "Cancelado", "Atrasado". */
export function SeloDeTom({ tom, children, titulo }: { tom: Tom; children: React.ReactNode; titulo?: string }) {
  const t = COR_DO_TOM[tom];
  const Icone = ICONE_DO_TOM[tom];
  return (
    <span
      title={titulo}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.68rem] font-bold"
      style={tom === "neutro" ? { color: "var(--color-muted)", background: "rgb(23 21 18 / 0.06)" } : { color: t.texto, background: t.fundo }}
    >
      {Icone ? <Icone size={11} aria-hidden /> : null}
      {children}
    </span>
  );
}

/**
 * Minigráfico de linha, sem eixo: só a forma do período. Vai embaixo do número
 * do cartão e responde "subindo ou descendo?" sem ninguém ler tabela. É
 * decorativo (`aria-hidden`): o número e a variação já dizem o mesmo em texto.
 */
export function Linhazinha({ valores, cor = "var(--setor, #b8841f)" }: { valores: number[]; cor?: string }) {
  const max = Math.max(...valores, 1);
  const x = (i: number) => (i / Math.max(valores.length - 1, 1)) * 100;
  const y = (v: number) => 26 - (v / max) * 23;
  const linha = valores.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="mt-3 h-8 w-full" aria-hidden>
      <polygon points={`0,28 ${linha} 100,28`} fill={cor} opacity="0.1" />
      <polyline points={linha} fill="none" stroke={cor} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Número de dinheiro com os centavos menores, para o valor caber no cartão. */
export function Dinheiro({ valor }: { valor: number }) {
  const [inteiros, centavos] = valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).split(",");
  return (
    <span className="numeros">
      {inteiros}
      <span className="text-[0.55em] opacity-60">,{centavos}</span>
    </span>
  );
}

/**
 * O cartão de número do painel.
 *
 * Com `tom`, o cartão inteiro ganha a cor e o `aviso` diz em palavra o que a
 * cor quer dizer (cor sozinha não informa quem não distingue verde de
 * vermelho). `variacao` põe o selo de subiu ou caiu antes do texto de apoio.
 * `serie` desenha a forma do período embaixo.
 *
 * No celular os cartões andam de dois em dois: some o ícone, o rótulo pode
 * quebrar linha (cortado com reticências ele não dizia o que era o número) e
 * o valor encolhe para caber em meia tela.
 */
export function Cartao({
  Icone, rotulo, children, apoio, tom = "neutro", aviso, variacao, serie,
}: {
  Icone: LucideIcon;
  rotulo: string;
  children: React.ReactNode;
  apoio?: React.ReactNode;
  tom?: Tom;
  /** A palavra do tom: "Cancelamento alto", "Paga a conta". Só aparece com tom. */
  aviso?: string;
  variacao?: { d: number | null; bomSeSobe?: boolean };
  serie?: number[];
}) {
  const t = COR_DO_TOM[tom];
  const comTom = tom !== "neutro";
  const IconeDoTom = ICONE_DO_TOM[tom];
  return (
    <div
      className="glass flex min-w-0 flex-col rounded-[16px] p-3.5 sm:rounded-[18px] sm:p-5"
      style={comTom ? { background: t.fundo, borderColor: "transparent" } : undefined}
    >
      <div className="flex items-center gap-2">
        <span className="painel-selo hidden h-7 w-7 shrink-0 place-items-center rounded-[8px] sm:grid" style={comTom ? { background: "#fff" } : undefined}>
          <Icone size={14} aria-hidden />
        </span>
        <p className="eyebrow min-w-0 break-words text-[0.6rem] leading-snug sm:truncate sm:text-[0.62rem]">{rotulo}</p>
      </div>
      <p
        className="font-display mt-2 text-[clamp(1.2rem,5.4vw,1.6rem)] leading-tight text-ink sm:mt-3 sm:text-[clamp(1.6rem,2.6vw,2.25rem)]"
        style={comTom ? { color: t.texto } : undefined}
      >
        {children}
      </p>
      {comTom && aviso ? (
        <p className="mt-1 inline-flex items-center gap-1 text-[0.7rem] font-bold" style={{ color: t.texto }}>
          {IconeDoTom ? <IconeDoTom size={12} aria-hidden /> : null} {aviso}
        </p>
      ) : null}
      {variacao || apoio ? (
        <p className="mt-1 text-[0.7rem] leading-snug text-muted sm:text-xs">
          {variacao ? <Variacao d={variacao.d} bomSeSobe={variacao.bomSeSobe} /> : null}
          {variacao && apoio ? " " : null}
          {apoio}
        </p>
      ) : null}
      {serie && serie.length > 1 ? (
        <div className="mt-auto">
          <Linhazinha valores={serie} cor={comTom ? t.texto : undefined} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Lista de fatias: nome, valor e uma barra proporcional, na cor do setor. É a
 * forma certa para comparar tamanho ("de onde vieram as vendas"): uma cor só,
 * do maior para o menor. O `apoio` de cada linha pode ter tom.
 */
export function ListaComBarra({
  linhas, total,
}: {
  linhas: { chave: string; nome: string; direita: React.ReactNode; valor: number; apoio?: string; tom?: Tom }[];
  total: number;
}) {
  return (
    <ul className="mt-4 space-y-3">
      {linhas.map((l) => {
        const pct = total ? (l.valor / total) * 100 : 0;
        const tom = l.tom ?? "neutro";
        const Icone = ICONE_DO_TOM[tom];
        return (
          <li key={l.chave}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium text-ink">{l.nome}</span>
              <span className="numeros shrink-0 text-xs text-muted">{l.direita}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-ink/[0.07]">
              <div className="painel-ponto h-2 rounded-full" style={{ width: `${Math.max(pct, l.valor > 0 ? 0.5 : 0)}%` }} />
            </div>
            {l.apoio ? (
              <p
                className={`numeros mt-1 inline-flex items-center gap-1 text-[0.7rem] ${tom === "neutro" ? "text-muted" : "font-semibold"}`}
                style={tom === "neutro" ? undefined : { color: COR_DO_TOM[tom].texto }}
              >
                {Icone ? <Icone size={11} aria-hidden /> : null}
                {l.apoio}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
