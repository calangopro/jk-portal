"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronDown, Eye, Loader2, Store, TriangleAlert } from "lucide-react";
import type { Previa, Resultado } from "@/lib/loja/alterar";
import type { Edicao, EstadoNaLoja } from "@/lib/loja/produto";

/**
 * Editar o produto na loja, de dentro da gaveta.
 *
 * SÃO TRÊS PASSOS, e o do meio não se pula:
 *   1. abrir: o painel lê o produto na Tray na hora (o que a lista mostra pode
 *      estar atrasado), e é sobre esse estado que a pessoa edita;
 *   2. conferir: o servidor devolve o "antes e depois" de cada campo, com os
 *      avisos (preço que muda demais, produto que sai da vitrine, título que o
 *      Google corta);
 *   3. gravar: só então a alteração vai para a loja. Editar e gravar no mesmo
 *      clique é como erro de digitação vira preço errado no ar.
 *
 * Os campos ficam em grupos que abrem e fecham, porque são mais de trinta. Só
 * o primeiro (nome, preço e estoque) vem aberto, e o grupo com mudança ainda
 * não gravada ganha a marca "alterado", para nada ficar escondido na conferência.
 *
 * Com `abrirSozinho` (a aba Dados da gaveta), o primeiro passo acontece sem
 * clique: a pessoa abriu o produto para ver os dados, então o painel já lê.
 * Espera um instante antes, para quem está passando de produto em produto com
 * J e K não disparar uma leitura na Tray a cada tecla.
 *
 * As três ações vêm de fora, como propriedade, para a tela poder ser vista e
 * testada sem sessão.
 */

type Categoria = { id: string; nome: string; ativa: boolean };
type Acoes = {
  ler: (trayId: string) => Promise<{ estado: "nao_autorizada" | "nao_achado" } | { estado: "ok"; atual: EstadoNaLoja; categorias?: Categoria[] }>;
  prever: (trayId: string, edicao: Edicao) => Promise<Previa>;
  gravar: (trayId: string, edicao: Edicao) => Promise<Resultado>;
};

const campo = "w-full rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-ink outline-none transition-colors hover:border-brand/40 focus:border-brand disabled:bg-surface/60 disabled:text-muted";
const rotulo = "block text-[0.68rem] font-semibold uppercase tracking-wider text-muted";
const emTexto = (n: number | null) => (n === null ? "" : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }));
const inteiro = (n: number | null) => (n === null ? "" : String(n));
const emNumero = (t: string) => {
  const n = Number(t.trim().replace(/\./g, "").replace(",", "."));
  return t.trim() === "" || !Number.isFinite(n) ? null : n;
};

type Form = {
  nome: string; preco: string; promocional: string; de: string; ate: string; estoque: string; disponivel: boolean;
  titulo: string; palavrasChave: string;
  resumo: string; descricao: string; itensInclusos: string; mensagemAdicional: string;
  categoria: string; outrasCategorias: string[]; marca: string; modelo: string; referencia: string;
  peso: string; comprimento: string; largura: string; altura: string; prazo: string; prazoDias: string; estoqueMinimo: string;
  garantia: string; video: string; ean: string; ncm: string; destaque: boolean; lancamento: boolean;
};
const paraForm = (e: EstadoNaLoja): Form => ({
  nome: e.nome, preco: emTexto(e.preco), promocional: emTexto(e.promocional), de: e.promocaoDe ?? "", ate: e.promocaoAte ?? "", estoque: String(e.estoque), disponivel: e.disponivel,
  titulo: e.titulo, palavrasChave: e.palavrasChave,
  resumo: e.resumo, descricao: e.descricao, itensInclusos: e.itensInclusos, mensagemAdicional: e.mensagemAdicional,
  categoria: e.categoria ?? "", outrasCategorias: e.outrasCategorias, marca: e.marca, modelo: e.modelo, referencia: e.referencia,
  peso: inteiro(e.peso), comprimento: inteiro(e.comprimento), largura: inteiro(e.largura), altura: inteiro(e.altura),
  prazo: e.prazo, prazoDias: inteiro(e.prazoDias), estoqueMinimo: String(e.estoqueMinimo),
  garantia: e.garantia, video: e.video, ean: e.ean, ncm: e.ncm, destaque: e.destaque, lancamento: e.lancamento,
});

/** Os grupos da tela e os campos de cada um, para a marca de "alterado". */
const GRUPOS: Record<string, (keyof Form)[]> = {
  basico: ["nome", "preco", "promocional", "de", "ate", "estoque", "disponivel"],
  google: ["titulo", "resumo", "palavrasChave"],
  textos: ["descricao", "itensInclusos", "mensagemAdicional"],
  catalogo: ["categoria", "outrasCategorias", "marca", "modelo", "referencia"],
  envio: ["peso", "comprimento", "largura", "altura", "prazo", "prazoDias", "estoqueMinimo"],
  outros: ["garantia", "video", "ean", "ncm", "destaque", "lancamento"],
};
const mesmo = (a: Form[keyof Form], b: Form[keyof Form]) => (Array.isArray(a) && Array.isArray(b) ? a.join() === b.join() : a === b);

export function EditarNaLoja({ trayId, podePreco, acoes, abrirSozinho = false }: { trayId: string; podePreco: boolean; acoes: Acoes; abrirSozinho?: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState<Form | null>(null);
  const [base, setBase] = useState<Form | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [previa, setPrevia] = useState<Extract<Previa, { estado: "previa" }> | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [verDescricao, setVerDescricao] = useState(false);
  // A loja ainda não foi autorizada: não é erro de quem está usando, então
  // ganha uma explicação própria em vez de uma linha vermelha.
  const [desligada, setDesligada] = useState(false);
  const [ocupado, comecar] = useTransition();

  const carregar = (e: EstadoNaLoja) => {
    const f = paraForm(e);
    setForm(f);
    setBase(f);
  };

  const abrir = () =>
    comecar(async () => {
      setAviso(null);
      const r = await acoes.ler(trayId);
      if (r.estado === "ok") {
        setDesligada(false);
        carregar(r.atual);
        setCategorias(r.categorias ?? []);
      } else if (r.estado === "nao_autorizada") setDesligada(true);
      else setAviso({ ok: false, texto: "A Tray não achou este produto. Ele pode ter sido apagado na loja." });
    });

  const jaAbriu = useRef(false);
  useEffect(() => {
    if (!abrirSozinho || jaAbriu.current) return;
    const espera = setTimeout(() => {
      jaAbriu.current = true;
      abrir();
    }, 400);
    return () => clearTimeout(espera);
    // Só na chegada: `abrir` muda a cada desenho e não deve disparar de novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirSozinho, trayId]);

  /** Manda tudo: o servidor compara com a loja e só leva o que mudou. Sem acesso a preço, os campos de preço nem vão. */
  const edicao = (f: Form): Edicao => ({
    nome: f.nome,
    estoque: emNumero(f.estoque) ?? Number.NaN,
    disponivel: f.disponivel,
    ...(podePreco
      ? { preco: emNumero(f.preco) ?? Number.NaN, promocional: emNumero(f.promocional), promocaoDe: f.de || null, promocaoAte: f.ate || null }
      : {}),
    titulo: f.titulo, palavrasChave: f.palavrasChave,
    resumo: f.resumo, descricao: f.descricao, itensInclusos: f.itensInclusos, mensagemAdicional: f.mensagemAdicional,
    categoria: f.categoria || null, outrasCategorias: f.outrasCategorias, marca: f.marca, modelo: f.modelo, referencia: f.referencia,
    // Vazio vira nulo e o servidor decide; texto que não é número vira NaN e é recusado com o motivo.
    peso: f.peso.trim() ? (emNumero(f.peso) ?? Number.NaN) : null,
    comprimento: f.comprimento.trim() ? (emNumero(f.comprimento) ?? Number.NaN) : null,
    largura: f.largura.trim() ? (emNumero(f.largura) ?? Number.NaN) : null,
    altura: f.altura.trim() ? (emNumero(f.altura) ?? Number.NaN) : null,
    prazo: f.prazo,
    prazoDias: f.prazoDias.trim() ? (emNumero(f.prazoDias) ?? Number.NaN) : null,
    estoqueMinimo: emNumero(f.estoqueMinimo) ?? Number.NaN,
    garantia: f.garantia, video: f.video, ean: f.ean, ncm: f.ncm, destaque: f.destaque, lancamento: f.lancamento,
  });

  const conferir = () =>
    form &&
    comecar(async () => {
      setAviso(null);
      const r = await acoes.prever(trayId, edicao(form));
      if (r.estado === "previa") {
        if (r.mudancas.length === 0) setAviso({ ok: true, texto: "Nada mudou em relação ao que está na loja." });
        else setPrevia(r);
      } else if (r.estado === "invalida") setAviso({ ok: false, texto: r.erro });
      else setAviso({ ok: false, texto: r.estado === "nao_autorizada" ? "A loja não está ligada ao painel para alterações." : "A Tray não achou este produto." });
    });

  const gravar = () =>
    form &&
    comecar(async () => {
      const r = await acoes.gravar(trayId, edicao(form));
      setPrevia(null);
      if (r.estado === "ok") {
        carregar(r.depois);
        setAviso({ ok: true, texto: `Gravado na loja: ${r.mudancas.map((m) => m.rotulo.charAt(0).toLowerCase() + m.rotulo.slice(1)).join(", ")}.` });
        router.refresh();
      } else if (r.estado === "sem_mudanca") setAviso({ ok: true, texto: "Nada mudou em relação ao que está na loja." });
      else if (r.estado === "invalida" || r.estado === "recusada" || r.estado === "erro") setAviso({ ok: false, texto: r.erro });
      else setAviso({ ok: false, texto: "A loja não está ligada ao painel para alterações." });
    });

  const mexer = (parte: Partial<Form>) => {
    setForm((f) => (f ? { ...f, ...parte } : f));
    setPrevia(null);
    setAviso(null);
  };
  const alterado = (grupo: string) => !!form && !!base && GRUPOS[grupo].some((c) => !mesmo(form[c], base[c]));

  /** Campo de texto de uma linha, ligado ao formulário. */
  const texto = (c: keyof Form, nome: string, extra: { max?: number; dica?: string; numeros?: boolean; placeholder?: string; limite?: number } = {}) => (
    <label className="block min-w-0">
      <span className={rotulo}>{nome}</span>
      <input
        className={`${campo} mt-1 ${extra.numeros ? "numeros" : ""}`}
        inputMode={extra.numeros ? "numeric" : undefined}
        value={form![c] as string}
        maxLength={extra.max}
        placeholder={extra.placeholder}
        onChange={(e) => mexer({ [c]: e.target.value } as Partial<Form>)}
      />
      {extra.limite ? <Contador valor={form![c] as string} limite={extra.limite} /> : null}
      {extra.dica ? <span className="mt-1 block text-[0.7rem] leading-snug text-muted">{extra.dica}</span> : null}
    </label>
  );
  const caixa = (c: keyof Form, nome: string, linhas: number, extra: { max?: number; dica?: string; limite?: number; mono?: boolean } = {}) => (
    <label className="block min-w-0">
      <span className={rotulo}>{nome}</span>
      <textarea
        className={`${campo} mt-1 resize-y ${extra.mono ? "font-mono text-xs leading-relaxed" : ""}`}
        rows={linhas}
        value={form![c] as string}
        maxLength={extra.max}
        onChange={(e) => mexer({ [c]: e.target.value } as Partial<Form>)}
      />
      {extra.limite ? <Contador valor={form![c] as string} limite={extra.limite} /> : null}
      {extra.dica ? <span className="mt-1 block text-[0.7rem] leading-snug text-muted">{extra.dica}</span> : null}
    </label>
  );
  const marcar = (c: "disponivel" | "destaque" | "lancamento", nome: string) => (
    <label className="flex items-center gap-2 text-sm text-ink">
      <input type="checkbox" className="h-4 w-4 accent-[var(--color-brand)]" checked={form![c]} onChange={(e) => mexer({ [c]: e.target.checked } as Partial<Form>)} />
      {nome}
    </label>
  );

  // A categoria que o produto tem e o espelho não conhece continua na lista, pelo número.
  const listaDeCategorias = (() => {
    const conhecidas = new Map(categorias.map((c) => [c.id, c]));
    for (const id of [form?.categoria, ...(form?.outrasCategorias ?? []), base?.categoria, ...(base?.outrasCategorias ?? [])]) {
      if (id && !conhecidas.has(id)) conhecidas.set(id, { id, nome: `Categoria ${id}`, ativa: true });
    }
    return [...conhecidas.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  })();

  return (
    <section className="mt-5" aria-label="Editar na loja">
      <p className="eyebrow flex items-center gap-1.5"><Store size={14} aria-hidden /> Editar na loja</p>

      {desligada ? (
        <div className="mt-3 rounded-[12px] bg-[#fcefd9] p-3.5 text-[#6d3505]">
          <p className="flex items-start gap-2 text-sm font-semibold">
            <TriangleAlert size={15} className="mt-0.5 shrink-0" aria-hidden /> Ainda não dá para editar por aqui
          </p>
          <p className="mt-1.5 text-xs leading-relaxed">
            Falta a Tray liberar o aplicativo do painel e a loja ser autorizada em Integrações, no cartão da Tray. Até lá,
            o produto continua sendo mudado no painel da própria Tray. Quando a loja for ligada, este espaço vira o
            formulário de edição, sem mais nada a fazer.
          </p>
          <button type="button" onClick={abrir} disabled={ocupado} className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#9a4a07]/30 bg-white px-3.5 py-1.5 text-xs font-semibold text-[#6d3505] disabled:opacity-60">
            {ocupado ? <Loader2 size={13} className="animate-spin" aria-hidden /> : null}
            {ocupado ? "Conferindo…" : "Conferir de novo"}
          </button>
        </div>
      ) : form === null ? (
        <>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Muda o produto direto na Tray. O painel lê o produto na loja antes, mostra o antes e depois, e só grava quando
            você confirmar.
          </p>
          {abrirSozinho && !aviso ? (
            <p className="mt-3 inline-flex items-center gap-2 text-xs text-muted">
              <Loader2 size={13} className="animate-spin" aria-hidden /> Lendo o produto na loja…
            </p>
          ) : (
            <button type="button" onClick={abrir} disabled={ocupado} className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-brand/50 disabled:opacity-60">
              {ocupado ? <Loader2 size={13} className="animate-spin" aria-hidden /> : null}
              {ocupado ? "Lendo na loja…" : "Abrir para editar"}
            </button>
          )}
        </>
      ) : (
        <div className="mt-3 space-y-2.5">
          <Grupo titulo="Nome, preço e estoque" alterado={alterado("basico")} aberto>
            {texto("nome", "Nome", { max: 200 })}
            <div className="grid grid-cols-2 gap-3">
              <label className="block min-w-0">
                <span className={rotulo}>Preço</span>
                <input className={`${campo} numeros mt-1`} inputMode="decimal" value={form.preco} disabled={!podePreco} onChange={(e) => mexer({ preco: e.target.value })} />
              </label>
              {texto("estoque", "Estoque", { numeros: true })}
            </div>
            <label className="block">
              <span className={rotulo}>Preço promocional</span>
              <input className={`${campo} numeros mt-1`} inputMode="decimal" placeholder="vazio = sem promoção" value={form.promocional} disabled={!podePreco} onChange={(e) => mexer({ promocional: e.target.value })} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block min-w-0">
                <span className={rotulo}>Promoção de</span>
                <input type="date" className={`${campo} mt-1`} value={form.de} disabled={!podePreco} onChange={(e) => mexer({ de: e.target.value })} />
              </label>
              <label className="block min-w-0">
                <span className={rotulo}>Até</span>
                <input type="date" className={`${campo} mt-1`} value={form.ate} disabled={!podePreco} onChange={(e) => mexer({ ate: e.target.value })} />
              </label>
            </div>
            {!podePreco ? <p className="text-[0.7rem] text-muted">Preço e promoção só mudam com administrador, dono ou GM.</p> : null}
            {marcar("disponivel", "Disponível para venda")}
          </Grupo>

          <Grupo titulo="Google e SEO" alterado={alterado("google")}>
            <NoGoogle titulo={form.titulo || form.nome} descricao={form.resumo} />
            {texto("titulo", "Título no Google", { max: 255, limite: 65, dica: "Vazio: a loja usa o nome do produto." })}
            {caixa("resumo", "Descrição curta e no Google", 3, {
              max: 1000,
              limite: 160,
              dica: "Na Tray é um campo só: o mesmo texto aparece perto do preço, na página do produto, e é a descrição que vai para o Google.",
            })}
            {caixa("palavrasChave", "Palavras-chave", 2, { max: 1000, dica: "Separadas por vírgula. O Google não lê esta metatag; Bing e outros buscadores ainda leem." })}
          </Grupo>

          <Grupo titulo="Textos da página" alterado={alterado("textos")}>
            <div>
              {caixa("descricao", "Descrição da página (HTML)", 10, { max: 200_000, mono: true })}
              <button type="button" onClick={() => setVerDescricao((v) => !v)} className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-ink underline-offset-2 hover:underline">
                <Eye size={13} aria-hidden /> {verDescricao ? "Esconder como fica" : "Ver como fica"}
              </button>
              {verDescricao ? (
                // Sem permissão nenhuma: o HTML só é desenhado, nenhum script roda aqui dentro.
                <iframe title="Como a descrição fica" sandbox="" srcDoc={`<!doctype html><meta charset="utf-8"><body style="font:14px/1.55 system-ui,sans-serif;margin:12px;color:#222">${form.descricao}`} className="mt-2 h-72 w-full rounded-[10px] border border-border bg-white" />
              ) : null}
            </div>
            {caixa("itensInclusos", "Itens inclusos", 3, { max: 5000, dica: "Uma linha por item. Na loja, as linhas costumam ser separadas por <br />." })}
            {caixa("mensagemAdicional", "Mensagem adicional", 2, { max: 2000 })}
          </Grupo>

          <Grupo titulo="Categorias e marca" alterado={alterado("catalogo")}>
            <label className="block min-w-0">
              <span className={rotulo}>Categoria principal</span>
              <select className={`${campo} mt-1`} value={form.categoria} onChange={(e) => mexer({ categoria: e.target.value })}>
                {form.categoria ? null : <option value="">Escolha</option>}
                {listaDeCategorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}{c.ativa ? "" : " (inativa)"}</option>
                ))}
              </select>
            </label>
            <fieldset className="min-w-0">
              <legend className={rotulo}>Também aparece em</legend>
              <div className="mt-1 max-h-48 overflow-y-auto rounded-[10px] border border-border bg-white px-3 py-2">
                {listaDeCategorias.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 py-0.5 text-sm text-ink">
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 accent-[var(--color-brand)]"
                      checked={form.outrasCategorias.includes(c.id)}
                      onChange={(e) =>
                        mexer({ outrasCategorias: e.target.checked ? [...form.outrasCategorias, c.id].sort((a, b) => Number(a) - Number(b)) : form.outrasCategorias.filter((x) => x !== c.id) })
                      }
                    />
                    <span className="min-w-0 break-words">{c.nome}</span>
                  </label>
                ))}
              </div>
              <span className="mt-1 block text-[0.7rem] leading-snug text-muted">A lista vem da última sincronização do catálogo. Na loja, a principal costuma estar marcada aqui também.</span>
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              {texto("marca", "Marca", { max: 120 })}
              {texto("modelo", "Modelo", { max: 120 })}
            </div>
            {texto("referencia", "Referência", { max: 60 })}
          </Grupo>

          <Grupo titulo="Envio e prazo" alterado={alterado("envio")}>
            {texto("peso", "Peso (gramas)", { numeros: true, dica: "Gramas inteiras. A Tray recusa zero e casa decimal." })}
            <div className="grid grid-cols-3 gap-2">
              {texto("comprimento", "Compr. (cm)", { numeros: true })}
              {texto("largura", "Largura (cm)", { numeros: true })}
              {texto("altura", "Altura (cm)", { numeros: true })}
            </div>
            {texto("prazo", "Texto do prazo", { max: 200, placeholder: "Disponível em 2 dias úteis", dica: "É desse texto que a Consulta do vendedor tira o prazo de produção." })}
            <div className="grid grid-cols-2 gap-3">
              {texto("prazoDias", "Prazo em dias", { numeros: true })}
              {texto("estoqueMinimo", "Estoque mínimo", { numeros: true })}
            </div>
          </Grupo>

          <Grupo titulo="Outros" alterado={alterado("outros")}>
            {texto("garantia", "Garantia", { max: 200 })}
            {texto("video", "Vídeo", { max: 500, placeholder: "https://www.youtube.com/embed/…" })}
            <div className="grid grid-cols-2 gap-3">
              {texto("ean", "EAN", { numeros: true })}
              {texto("ncm", "NCM", { numeros: true })}
            </div>
            {marcar("destaque", "Destaque")}
            {marcar("lancamento", "Lançamento")}
          </Grupo>

          {previa ? (
            <div className="rounded-[12px] border border-border bg-white/70 p-3" role="group" aria-label="Conferir antes de gravar">
              <p className="text-xs font-semibold text-ink">Confira antes de gravar na loja</p>
              <ul className="mt-2 space-y-1.5">
                {previa.mudancas.map((m) => (
                  <li key={m.campo} className="text-xs leading-relaxed text-ink [overflow-wrap:anywhere]">
                    <span className="font-semibold">{m.rotulo}:</span>{" "}
                    <span className="text-muted line-through">{m.antes}</span>{" "}
                    <ArrowRight size={11} className="inline" aria-label="passa a ser" />{" "}
                    <span className="font-semibold">{m.depois}</span>
                  </li>
                ))}
              </ul>
              {previa.avisos.map((a) => (
                <p key={a} className="mt-2 flex items-start gap-1.5 text-xs font-semibold leading-relaxed" style={{ color: "#b45309" }}>
                  <TriangleAlert size={13} className="mt-0.5 shrink-0" aria-hidden /> <span>Atenção: {a}</span>
                </p>
              ))}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={gravar} disabled={ocupado} className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60">
                  {ocupado ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Check size={13} aria-hidden />}
                  {ocupado ? "Gravando na loja…" : "Gravar na loja"}
                </button>
                <button type="button" onClick={() => setPrevia(null)} disabled={ocupado} className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-ink hover:border-brand/50 disabled:opacity-60">
                  Voltar a editar
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={conferir} disabled={ocupado} className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-ink transition-colors hover:bg-brand-light disabled:opacity-60">
              {ocupado ? <Loader2 size={13} className="animate-spin" aria-hidden /> : null}
              {ocupado ? "Conferindo com a loja…" : "Conferir mudanças"}
            </button>
          )}
        </div>
      )}

      {aviso ? (
        <p className={`mt-3 text-xs leading-relaxed ${aviso.ok ? "text-emerald-800" : "text-wine"}`} role="status">
          {aviso.texto}
        </p>
      ) : null}
    </section>
  );
}

function Grupo({ titulo, alterado, aberto = false, children }: { titulo: string; alterado: boolean; aberto?: boolean; children: ReactNode }) {
  return (
    <details open={aberto} className="group rounded-[12px] border border-border bg-white/60">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
        <ChevronDown size={15} className="shrink-0 -rotate-90 transition-transform group-open:rotate-0" aria-hidden />
        <span className="min-w-0 flex-1">{titulo}</span>
        {alterado ? <span className="shrink-0 rounded-full bg-[#fcefd9] px-2 py-0.5 text-[0.66rem] font-semibold text-[#6d3505]">alterado</span> : null}
      </summary>
      <div className="space-y-3 border-t border-border px-3 pb-3 pt-3">{children}</div>
    </details>
  );
}

/** Quantas letras e se passa do que o Google costuma mostrar. Âmbar com a palavra, nunca só a cor. */
function Contador({ valor, limite }: { valor: string; limite: number }) {
  const n = valor.replace(/\s+/g, " ").trim().length;
  const passou = n > limite;
  return (
    <span className={`mt-1 block text-right text-[0.7rem] numeros ${passou ? "font-semibold text-[#b45309]" : "text-muted"}`}>
      {n} de {limite}{passou ? ", o Google costuma cortar" : ""}
    </span>
  );
}

/** Como o resultado costuma aparecer na busca. É uma aproximação: o Google pode trocar título e descrição. */
function NoGoogle({ titulo, descricao }: { titulo: string; descricao: string }) {
  const cortar = (t: string, n: number) => (t.length > n ? `${t.slice(0, n).trimEnd()}…` : t);
  return (
    <div className="rounded-[10px] border border-border bg-white p-3" aria-label="Prévia no Google">
      <p className="text-[0.7rem] text-muted">www.jkaliancas.com.br</p>
      <p className="mt-0.5 break-words text-[0.95rem] leading-snug text-[#1a0dab]">{cortar(titulo, 65)}</p>
      <p className="mt-1 break-words text-xs leading-relaxed text-[#4d5156]">{descricao ? cortar(descricao, 160) : <em>Sem descrição: o Google escolhe um trecho da página.</em>}</p>
    </div>
  );
}
