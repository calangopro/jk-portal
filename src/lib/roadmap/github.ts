/**
 * O Roadmap ligado ao GitHub (0143): monta o evento que vai ao banco e o
 * comentário que volta para o pedido de revisão.
 *
 * O que é IDENTIDADE (repositório, ramo, quem enviou, número do pedido) vem do
 * token que o GitHub assina (`oidc.ts`). O que o workflow CALCULA (os arquivos
 * que o ramo mexe, os commits atrás do main, o título e o estado do pedido)
 * vem do corpo. Arquivo puro, com teste em `scripts/teste-roadmap.mts`.
 */
import type { ClaimsDoGitHub } from "./oidc";
import type { Coluna } from "./roadmap";

/**
 * O nome de cada coluna no comentário. É o mesmo de `NOME_DA_COLUNA`
 * (`roadmap.ts`), repetido porque módulo puro só importa TIPO de outro arquivo;
 * o teste confere que os dois andam juntos.
 */
export const NOME_DA_COLUNA_NO_COMENTARIO: Record<Coluna, string> = {
  ideias: "Ideias",
  a_fazer: "A fazer",
  fazendo: "Fazendo",
  em_revisao: "Em revisão",
  no_ar: "No ar",
  descartado: "Descartados",
};

/** A marca do comentário fixo que o workflow atualiza no pedido de revisão. */
export const MARCA_DO_COMENTARIO = "<!-- roadmap-jk -->";
export const MAXIMO_DE_ARQUIVOS = 500;

export type EventoDoGitHub = {
  evento: "pull_request" | "push";
  repositorio: string;
  ramo: string;
  login: string | null;
  sha: string | null;
  pr_numero: number | null;
  acao: string | null;
  titulo: string | null;
  corpo: string | null;
  rascunho: boolean;
  juntado: boolean;
  arquivos?: string[];
  atras_do_main: number | null;
};

const texto = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/**
 * O evento para `roadmap_github`, ou por que ele não é acompanhado (tag, ramo
 * sem nome, pedido sem número). O ramo e o número do pedido saem do token; se
 * o token não trouxer (o GitHub não põe `head_ref` ou o `ref` do pedido em
 * todo evento), valem os do corpo, que o MESMO workflow do repositório mandou
 * junto com o token. Quem conseguiria mexer no corpo conseguiria mexer no
 * workflow, então isso não abre porta nova.
 */
export function lerEventoDoGitHub(claims: ClaimsDoGitHub, corpoCru: unknown): { ok: true; evento: EventoDoGitHub } | { ok: false; motivo: string } {
  const corpo = (corpoCru && typeof corpoCru === "object" ? corpoCru : {}) as Record<string, unknown>;
  const evento = claims.event_name;
  if (evento !== "pull_request" && evento !== "push") return { ok: false, motivo: "evento" };
  const ref = claims.ref ?? "";
  let ramo: string | null = null;
  let pr: number | null = null;
  if (evento === "pull_request") {
    ramo = texto(claims.head_ref, 200) ?? texto(corpo.ramo, 200);
    const m = /^refs\/pull\/([1-9][0-9]{0,8})\/(merge|head)$/.exec(ref);
    const doCorpo = Number(corpo.pr_numero);
    pr = m ? Number(m[1]) : Number.isInteger(doCorpo) && doCorpo > 0 && doCorpo < 1e9 ? doCorpo : null;
    if (!pr) return { ok: false, motivo: "pedido_sem_numero" };
  } else {
    if (!ref.startsWith("refs/heads/")) return { ok: false, motivo: "nao_e_ramo" };
    ramo = ref.slice("refs/heads/".length);
  }
  if (!ramo || !/^[A-Za-z0-9._/-]{1,200}$/.test(ramo)) return { ok: false, motivo: "ramo" };
  if (!claims.repository) return { ok: false, motivo: "repositorio" };

  const sha = typeof corpo.sha === "string" && /^[0-9a-f]{7,40}$/.test(corpo.sha) ? corpo.sha : typeof claims.sha === "string" && /^[0-9a-f]{7,40}$/.test(claims.sha) ? claims.sha : null;
  const atras = Number(corpo.atras_do_main);
  const arquivos = Array.isArray(corpo.arquivos)
    ? [...new Set(corpo.arquivos.filter((a): a is string => typeof a === "string" && a.trim() !== "").map((a) => a.trim().slice(0, 300)))].slice(0, MAXIMO_DE_ARQUIVOS)
    : undefined;
  return { ok: true, evento: {
    evento,
    repositorio: claims.repository,
    ramo,
    login: texto(claims.actor, 60),
    sha,
    pr_numero: pr,
    acao: evento === "pull_request" ? texto(corpo.acao, 40) : null,
    titulo: texto(corpo.titulo, 300),
    corpo: texto(corpo.corpo, 4000),
    rascunho: corpo.rascunho === true,
    juntado: corpo.juntado === true,
    ...(arquivos ? { arquivos } : {}),
    atras_do_main: Number.isInteger(atras) && atras >= 0 && atras < 1_000_000 ? atras : null,
  } };
}

/** O mesmo, só o evento: `null` quando não é acompanhado. */
export function eventoDoGitHub(claims: ClaimsDoGitHub, corpoCru: unknown): EventoDoGitHub | null {
  const r = lerEventoDoGitHub(claims, corpoCru);
  return r.ok ? r.evento : null;
}

type CruzamentoCru = { meu?: string; dele?: string; comum?: boolean };
type ConflitoCru = { id?: number; titulo?: string; coluna?: string; responsavel?: string | null; ramo?: string | null; pr_url?: string | null; so_comum?: boolean; cruzam?: CruzamentoCru[] };
export type RespostaDoGitHub = {
  ok?: boolean;
  motivo?: string;
  ignorado?: string;
  fora_do_quadro?: boolean;
  cartao?: { id: number; titulo: string; coluna: string; responsavel: string | null; atras_do_main: number | null; aviso_main: string | null } | null;
  moveu?: boolean;
  de?: string;
  sem_dono?: boolean;
  pr_estado?: string | null;
  conflitos?: ConflitoCru[];
  avisados?: number;
};

const coluna = (c: unknown) => (typeof c === "string" && c in NOME_DA_COLUNA_NO_COMENTARIO ? NOME_DA_COLUNA_NO_COMENTARIO[c as Coluna] : String(c ?? ""));
const cruzamentos = (lista: CruzamentoCru[] | undefined, max = 6) => {
  const linhas = (lista ?? []).filter((x) => x.meu && x.dele).map((x) => (x.meu === x.dele ? `\`${x.meu}\`` : `\`${x.meu}\` com \`${x.dele}\``));
  return linhas.length > max ? `${linhas.slice(0, max).join(", ")} e mais ${linhas.length - max}` : linhas.join(", ");
};

/**
 * O comentário para o pedido de revisão, o resumo para a página da execução e
 * se a checagem deve falhar. Falha só quando o pedido está aberto e não há
 * cartão: é a regra "trabalho sem cartão não começa". Cruzamento é aviso.
 */
export function comentarioDoPr(r: RespostaDoGitHub, e: EventoDoGitHub, enderecoDoQuadro: string): { markdown: string | null; resumo: string; falhar: boolean } {
  const aberto = e.evento === "pull_request" && e.acao !== "closed";
  if (!r.ok) return { markdown: null, resumo: `O painel recusou o aviso (${r.motivo ?? "sem motivo"}).`, falhar: false };
  if (r.ignorado) return { markdown: null, resumo: "Ramo main: nada a fazer no Roadmap.", falhar: false };

  const linhas: string[] = [MARCA_DO_COMENTARIO, "### Roadmap"];
  let falhar = false;

  if (r.fora_do_quadro || !r.cartao) {
    linhas.push(
      "",
      "**Este trabalho não está ligado a nenhum cartão do Roadmap.**",
      "",
      `Pegue o cartão antes de seguir: no Claude, \`roadmap.pegar\` com o ramo \`${e.ramo}\` (ou \`roadmap.ligar_pr\` com este pedido); na tela, em [Roadmap](${enderecoDoQuadro}). Também vale escrever "Cartão N" na descrição deste pedido.`,
    );
    falhar = aberto;
  } else {
    const c = r.cartao;
    linhas.push("", `**Cartão ${c.id}: ${c.titulo}** (${coluna(c.coluna)}${c.responsavel ? `, com ${c.responsavel}` : ""}). [Abrir no Roadmap](${enderecoDoQuadro}?cartao=${c.id})`);
    if (r.moveu && r.de) linhas.push(`O cartão foi de ${coluna(r.de)} para ${coluna(c.coluna)}.`);
    if (r.sem_dono) linhas.push(`O cartão não tem dono, e o login \`${e.login ?? "?"}\` não é de ninguém do painel: ele não andou. Pegue o cartão no Roadmap.`);
  }

  const atras = r.cartao?.atras_do_main ?? e.atras_do_main;
  if (aberto && atras && atras > 0) linhas.push("", `Este ramo está **${atras} ${atras === 1 ? "commit" : "commits"} atrás do main**. Traga o main para o ramo antes de juntar.`);
  if (r.cartao?.aviso_main) linhas.push("", `**Atenção:** ${r.cartao.aviso_main}`);

  const conflitos = r.conflitos ?? [];
  const deVerdade = conflitos.filter((c) => !c.so_comum);
  const deTodos = conflitos.filter((c) => c.so_comum);
  if (deVerdade.length) {
    linhas.push("", "**Outro trabalho em andamento mexe no mesmo lugar.** Combinem quem junta primeiro; quem juntar depois traz o main antes.");
    for (const c of deVerdade) {
      linhas.push(`- Cartão ${c.id}, ${c.titulo} (${coluna(c.coluna)}, com ${c.responsavel ?? "ninguém"}${c.pr_url ? `, ${c.pr_url}` : ""}): ${cruzamentos((c.cruzam ?? []).filter((x) => !x.comum))}`);
    }
  }
  if (deTodos.length) {
    linhas.push("", `Só arquivo de todos em comum com ${deTodos.map((c) => `o cartão ${c.id}`).join(", ")} (${cruzamentos(deTodos[0].cruzam, 3)}): o git costuma juntar sozinho, mas quem juntar depois traz o main antes.`);
  }
  if (!falhar && deVerdade.length === 0 && !r.cartao?.aviso_main && !(aberto && atras && atras > 0)) linhas.push("", "Nenhum outro trabalho em andamento mexe nos mesmos arquivos.");

  const markdown = linhas.join("\n");
  return {
    markdown: aberto ? markdown : null,
    resumo: markdown.replace(MARCA_DO_COMENTARIO, "").trim(),
    falhar,
  };
}
