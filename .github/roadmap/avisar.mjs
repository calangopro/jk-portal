/**
 * Roda no workflow do Roadmap (.github/workflows/roadmap.yml), a cada envio de
 * ramo e a cada mudança de pedido de revisão. Sem dependência: só Node e git.
 *
 * 1. Calcula o que o ramo mexe (diferença contra o main) e quantos commits ele
 *    está atrás do main.
 * 2. Confere se alguma migration NOVA usa um número que já existe no main com
 *    outro nome (dois números iguais quebram a ordem do banco). Isso falha a
 *    checagem mesmo com o painel fora do ar.
 * 3. Conta ao painel, com o token OIDC do GitHub (a identidade que o painel
 *    confere), e recebe o comentário pronto.
 * 4. Escreve o resumo da execução e o comentário fixo no pedido de revisão.
 *
 * Falha a checagem quando: o pedido está aberto e não há cartão do Roadmap
 * ligado a ele, ou há migration com número repetido. Painel fora do ar NÃO
 * falha: o aviso fica no resumo, e o próximo envio tenta de novo.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";

const MARCA = "<!-- roadmap-jk -->";
const PAINEL = process.env.PAINEL ?? "https://www.jkaliancas.com.br/guias/api/roadmap/github";
const nomeDoEvento = process.env.GITHUB_EVENT_NAME;
const ev = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
const pr = ev.pull_request ?? null;
const fechado = nomeDoEvento === "pull_request" && ev.action === "closed";

const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }).trim();
const linhas = (s) => s.split("\n").map((l) => l.trim()).filter(Boolean);
const resumo = [];
let falhar = false;

// 1 e 2. O que o ramo mexe, e migration com número repetido.
let arquivos;
let atrasDoMain;
const repetidas = [];
if (!fechado) {
  try {
    git("fetch", "--no-tags", "--quiet", "origin", "main");
    const base = git("merge-base", "origin/main", "HEAD");
    arquivos = linhas(git("diff", "--name-only", base, "HEAD")).slice(0, 500);
    atrasDoMain = Number(git("rev-list", "--count", "HEAD..origin/main"));

    const novas = linhas(git("diff", "--name-only", "--diff-filter=A", base, "HEAD", "--", "supabase/migrations")).filter((f) =>
      /^supabase\/migrations\/[0-9]+_[^/]+\.sql$/.test(f),
    );
    const doMain = linhas(git("ls-tree", "--name-only", "origin/main", "supabase/migrations/"));
    const numero = (f) => /migrations\/([0-9]+)_/.exec(f)?.[1];
    for (const f of novas) {
      const n = numero(f);
      const iguais = [...doMain, ...novas].filter((m) => m !== f && numero(m) === n);
      if (iguais.length) repetidas.push(`\`${f}\` usa o número ${n}, que já é de ${iguais.map((m) => `\`${m}\``).join(", ")}`);
    }
  } catch (e) {
    resumo.push(`Não deu para calcular a diferença contra o main: ${String(e.message ?? e).slice(0, 200)}`);
  }
}

// 3. Contar ao painel.
let markdown = null;
let doPainel = null;
const idUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
if (!idUrl) {
  resumo.push("Sem a identidade do GitHub (pedido vindo de fork?): o Roadmap não foi avisado.");
} else {
  try {
    const t = await fetch(`${idUrl}&audience=jk-roadmap`, { headers: { authorization: `bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` } });
    const token = (await t.json()).value;
    const r = await fetch(PAINEL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        acao: ev.action ?? null,
        titulo: pr?.title ?? null,
        corpo: pr?.body ? String(pr.body).slice(0, 4000) : null,
        rascunho: pr?.draft === true,
        juntado: pr?.merged === true,
        sha: pr?.head?.sha ?? process.env.GITHUB_SHA,
        // O painel tira o ramo e o número do pedido do token; estes valem quando o token não traz.
        pr_numero: pr?.number ?? null,
        ramo: pr?.head?.ref ?? process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME ?? null,
        ...(arquivos ? { arquivos } : {}),
        ...(Number.isInteger(atrasDoMain) ? { atras_do_main: atrasDoMain } : {}),
      }),
    });
    if (r.ok) {
      doPainel = await r.json();
      markdown = doPainel.markdown ?? null;
      if (doPainel.resumo) resumo.push(doPainel.resumo);
      if (doPainel.ignorado) resumo.push(`O painel não acompanhou este evento (${doPainel.ignorado}; evento ${doPainel.evento ?? "?"}, ref ${doPainel.ref ?? "?"}).`);
      else if (!doPainel.resumo) resumo.push(`O painel respondeu: ${JSON.stringify(doPainel).slice(0, 300)}`);
      if (doPainel.falhar) falhar = true;
    } else {
      resumo.push(`O painel não aceitou o aviso agora (${r.status}). O próximo envio tenta de novo.`);
    }
  } catch (e) {
    resumo.push(`O painel não respondeu: ${String(e.message ?? e).slice(0, 200)}. O próximo envio tenta de novo.`);
  }
}

if (repetidas.length) {
  falhar = true;
  const texto = ["**Migration com número repetido.** Troque o número antes de juntar (veja `ls supabase/migrations` e o histórico do banco):", ...repetidas.map((r) => `- ${r}`)].join("\n");
  resumo.push(texto);
  markdown = `${markdown ?? `${MARCA}\n### Roadmap`}\n\n${texto}`;
}

// 4. Resumo da execução e comentário fixo no pedido.
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${resumo.join("\n\n") || "Roadmap avisado."}\n`);
console.log(resumo.join("\n\n"));
console.log(`(evento ${nomeDoEvento}${ev.action ? `/${ev.action}` : ""}, ref ${process.env.GITHUB_REF ?? "?"}, ramo ${process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || "?"})`);

if (pr && !fechado && markdown && process.env.GITHUB_TOKEN) {
  const api = (caminho, init = {}) =>
    fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${caminho}`, {
      ...init,
      headers: {
        authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        ...(init.body ? { "content-type": "application/json" } : {}),
      },
    });
  try {
    const lista = await (await api(`/issues/${pr.number}/comments?per_page=100`)).json();
    const meu = Array.isArray(lista) ? lista.find((c) => typeof c.body === "string" && c.body.startsWith(MARCA) && c.user?.type === "Bot") : null;
    if (meu?.body !== markdown) {
      const r = meu
        ? await api(`/issues/comments/${meu.id}`, { method: "PATCH", body: JSON.stringify({ body: markdown }) })
        : await api(`/issues/${pr.number}/comments`, { method: "POST", body: JSON.stringify({ body: markdown }) });
      if (!r.ok) console.log(`Não deu para escrever o comentário (${r.status}).`);
    }
  } catch (e) {
    console.log(`Não deu para escrever o comentário: ${String(e.message ?? e).slice(0, 200)}`);
  }
}

process.exit(falhar ? 1 : 0);
