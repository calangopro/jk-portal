"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Search, Trash2, X } from "lucide-react";
import {
  ICONES_DE_LINK,
  linkNovo,
  type BlocoDaBio,
  type BlocoDe,
  type FonteDaVitrine,
  type ItemDeLink,
} from "@/lib/bio/tipos";
import type { CategoriaDaLoja } from "@/lib/tray/publico";
import { Caixa, Data, Endereco, Grupo, Selecao, Texto, classeDoCampo } from "./campos";
import { procurarProdutos, produtosEscolhidos, type ProdutoParaEscolher } from "./actions";

/**
 * Os campos de cada tipo de bloco.
 *
 * Cada tipo mostra só o que muda na tela, agrupado pelo lugar onde aparece
 * ("Botão na bio", "Formulário", "Depois de enviar"). A pessoa que edita pensa
 * no que VÊ, não no nome do campo no JSON.
 */

type Props<T extends BlocoDaBio["tipo"]> = {
  bloco: BlocoDe<T>;
  aoMudar: (novo: BlocoDe<T>) => void;
};

function idNovo(prefixo: string) {
  return `${prefixo}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

function CamposDaCampanha({ bloco, aoMudar }: Props<"campanha">) {
  const m = (parcial: Partial<BlocoDe<"campanha">>) => aoMudar({ ...bloco, ...parcial });
  return (
    <>
      <Grupo titulo="Texto">
        <Texto rotulo="Linha de cima" valor={bloco.eyebrow} maximo={32} aoMudar={(eyebrow) => m({ eyebrow })} />
        <Texto rotulo="Título" valor={bloco.titulo} maximo={48} aoMudar={(titulo) => m({ titulo })} />
        <Texto
          rotulo="Texto de apoio"
          longo
          valor={bloco.texto}
          maximo={140}
          aoMudar={(texto) => m({ texto })}
        />
      </Grupo>
      <Grupo titulo="Contador">
        <Data
          rotulo="Conta até o fim do dia"
          ajuda="Vazio, o contador não aparece."
          valor={bloco.contadorAte}
          aoMudar={(contadorAte) => m({ contadorAte })}
        />
        <Texto
          rotulo="Frase em cima do contador"
          valor={bloco.rotuloContador}
          maximo={40}
          aoMudar={(rotuloContador) => m({ rotuloContador })}
        />
      </Grupo>
      <Grupo titulo="Botão">
        <div className="sm:col-span-2">
          <Caixa
            rotulo="Mostrar botão"
            marcado={Boolean(bloco.botao)}
            aoMudar={(v) => m({ botao: v ? { rotulo: "Ver as peças", href: "https://www.jkaliancas.com.br/" } : null })}
          />
        </div>
        {bloco.botao ? (
          <>
            <Texto
              rotulo="Texto do botão"
              valor={bloco.botao.rotulo}
              maximo={30}
              aoMudar={(rotulo) => m({ botao: { ...bloco.botao!, rotulo } })}
            />
            <Endereco
              rotulo="Leva para"
              valor={bloco.botao.href}
              aoMudar={(href) => m({ botao: { ...bloco.botao!, href } })}
            />
          </>
        ) : null}
      </Grupo>
    </>
  );
}

function CamposDaCaptura({ bloco, aoMudar }: Props<"captura">) {
  const m = (parcial: Partial<BlocoDe<"captura">>) => aoMudar({ ...bloco, ...parcial });
  return (
    <>
      <Grupo titulo="Botão na bio">
        <Texto rotulo="Texto do botão" valor={bloco.rotulo} maximo={36} aoMudar={(rotulo) => m({ rotulo })} />
        <Texto rotulo="Linha de baixo" valor={bloco.detalhe} maximo={56} aoMudar={(detalhe) => m({ detalhe })} />
      </Grupo>
      <Grupo titulo="Formulário">
        <Texto rotulo="Linha de cima" valor={bloco.eyebrow} maximo={32} aoMudar={(eyebrow) => m({ eyebrow })} />
        <Texto rotulo="Título" valor={bloco.titulo} maximo={60} aoMudar={(titulo) => m({ titulo })} />
        <Texto rotulo="Explicação" longo valor={bloco.descricao} maximo={160} aoMudar={(descricao) => m({ descricao })} />
        <Selecao
          rotulo="E-mail"
          valor={bloco.email}
          opcoes={[
            ["opcional", "Pedir, sem obrigar"],
            ["obrigatorio", "Obrigatório"],
            ["nao", "Não pedir"],
          ]}
          aoMudar={(email) => m({ email })}
        />
        <div className="self-end">
          <Caixa
            rotulo="Perguntar o momento do casal"
            ajuda="Namoro, noivado, casamento ou presente. Opcional para quem preenche."
            marcado={bloco.momento}
            aoMudar={(momento) => m({ momento })}
          />
        </div>
        <Texto
          rotulo="Texto do aceite"
          ajuda="É o que a pessoa aceita pela LGPD. Vai gravado junto do contato."
          longo
          valor={bloco.aceite}
          aoMudar={(aceite) => m({ aceite })}
        />
        <Texto rotulo="Botão de enviar" valor={bloco.botaoEnviar} maximo={32} aoMudar={(botaoEnviar) => m({ botaoEnviar })} />
        <Texto rotulo="Nota embaixo" valor={bloco.nota} maximo={90} aoMudar={(nota) => m({ nota })} />
      </Grupo>
      <Grupo titulo="Depois de enviar">
        <Texto rotulo="Título" valor={bloco.sucessoTitulo} maximo={40} aoMudar={(sucessoTitulo) => m({ sucessoTitulo })} />
        <Texto rotulo="Texto" valor={bloco.sucessoTexto} maximo={90} aoMudar={(sucessoTexto) => m({ sucessoTexto })} />
        <Endereco
          rotulo="Convite do grupo no WhatsApp"
          ajuda="O link chat.whatsapp.com do grupo. Vazio, o botão de entrar no grupo não aparece."
          valor={bloco.grupoLink}
          aoMudar={(grupoLink) => m({ grupoLink })}
        />
        <Texto rotulo="Texto do botão do grupo" valor={bloco.grupoRotulo} maximo={32} aoMudar={(grupoRotulo) => m({ grupoRotulo })} />
      </Grupo>
    </>
  );
}

// Números pares: a vitrine mostra dois por vez, e número ímpar deixaria o
// último par com um buraco.
const QUANTIDADES = [2, 4, 6, 8, 10, 12, 14, 16].map((n) => [String(n), String(n)] as const);

const FONTES: readonly (readonly [FonteDaVitrine["tipo"], string])[] = [
  ["mais-vendidos", "Mais vendidos da loja"],
  ["categoria", "Uma categoria da loja"],
  ["manual", "Escolhidos um a um"],
  ["destaques", "Marcados como destaque na Tray"],
  ["lancamentos", "Lançamentos"],
];

function CamposDaVitrine({
  bloco,
  aoMudar,
  categorias,
}: Props<"vitrine"> & { categorias: CategoriaDaLoja[] }) {
  const m = (parcial: Partial<BlocoDe<"vitrine">>) => aoMudar({ ...bloco, ...parcial });

  function trocarFonte(tipo: FonteDaVitrine["tipo"]) {
    if (tipo === bloco.fonte.tipo) return;
    if (tipo === "categoria") m({ fonte: { tipo, slug: categorias[0]?.slug ?? "" } });
    else if (tipo === "manual") m({ fonte: { tipo, ids: [] } });
    else m({ fonte: { tipo } });
  }

  return (
    <>
      <Grupo titulo="Vitrine">
        <Texto rotulo="Título" valor={bloco.titulo} maximo={32} aoMudar={(titulo) => m({ titulo })} />
        <Selecao
          rotulo="Quantos produtos"
          ajuda="Aparecem dois por vez, com a seta para o lado."
          valor={String(bloco.limite)}
          opcoes={QUANTIDADES}
          aoMudar={(v) => m({ limite: Number(v) })}
        />
        <Selecao rotulo="De onde vêm os produtos" valor={bloco.fonte.tipo} opcoes={FONTES} aoMudar={trocarFonte} />
        <Texto rotulo="Botão no cartão" valor={bloco.rotuloComprar} maximo={16} aoMudar={(rotuloComprar) => m({ rotuloComprar })} />
      </Grupo>

      {bloco.fonte.tipo === "categoria" ? (
        <Grupo titulo="Categoria">
          <EscolhaDeCategoria
            slug={bloco.fonte.slug}
            categorias={categorias}
            aoMudar={(slug) => m({ fonte: { tipo: "categoria", slug } })}
          />
        </Grupo>
      ) : null}

      {bloco.fonte.tipo === "manual" ? (
        <Grupo titulo="Produtos">
          <div className="sm:col-span-2">
            <EscolhaDeProdutos ids={bloco.fonte.ids} aoMudar={(ids) => m({ fonte: { tipo: "manual", ids } })} />
          </div>
        </Grupo>
      ) : null}

      <Grupo titulo="Link de ver todos">
        <div className="sm:col-span-2">
          <Caixa
            rotulo="Mostrar ao lado do título"
            marcado={Boolean(bloco.verTudo)}
            aoMudar={(v) => m({ verTudo: v ? { rotulo: "Ver todas", href: "https://www.jkaliancas.com.br/" } : null })}
          />
        </div>
        {bloco.verTudo ? (
          <>
            <Texto
              rotulo="Texto"
              valor={bloco.verTudo.rotulo}
              maximo={16}
              aoMudar={(rotulo) => m({ verTudo: { ...bloco.verTudo!, rotulo } })}
            />
            <Endereco
              rotulo="Leva para"
              valor={bloco.verTudo.href}
              aoMudar={(href) => m({ verTudo: { ...bloco.verTudo!, href } })}
            />
          </>
        ) : null}
      </Grupo>
    </>
  );
}

/**
 * Categoria da loja pelo nome. Campanha costuma ter a categoria criada em cima
 * da hora, então também dá para digitar o endereço de uma que ainda não existe:
 * a vitrine fica escondida até ela aparecer na loja.
 */
function EscolhaDeCategoria({
  slug,
  categorias,
  aoMudar,
}: {
  slug: string;
  categorias: CategoriaDaLoja[];
  aoMudar: (slug: string) => void;
}) {
  const conhecida = categorias.some((c) => c.slug === slug);
  const [digitando, setDigitando] = useState(!conhecida);

  return (
    <>
      <Selecao
        rotulo="Categoria"
        valor={digitando ? "__outra" : slug}
        opcoes={[
          ...categorias.map((c) => [c.slug, `${c.nome} (/${c.slug})`] as const),
          ["__outra", "Outra, digitar o endereço"] as const,
        ]}
        aoMudar={(v) => {
          if (v === "__outra") setDigitando(true);
          else {
            setDigitando(false);
            aoMudar(v);
          }
        }}
      />
      {digitando ? (
        <div>
          <Texto
            rotulo="Endereço da categoria na loja"
            ajuda="O que vem depois de jkaliancas.com.br/, por exemplo black."
            valor={slug}
            aoMudar={(v) => aoMudar(v.trim().replace(/^https?:\/\/[^/]+\//, "").replace(/^\/+|\/+$/g, ""))}
          />
          {slug && !conhecida ? (
            <p className="mt-1.5 text-[0.7rem] leading-snug text-brand-strong">
              Essa categoria ainda não existe na loja. A vitrine fica escondida até ela ser criada, e aparece sozinha
              depois.
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function EscolhaDeProdutos({ ids, aoMudar }: { ids: string[]; aoMudar: (ids: string[]) => void }) {
  const [escolhidos, setEscolhidos] = useState<ProdutoParaEscolher[]>([]);
  const [termo, setTermo] = useState("");
  const [achados, setAchados] = useState<ProdutoParaEscolher[]>([]);
  const [buscando, setBuscando] = useState(false);

  // Nome e foto de quem já está na lista. Só a lista de ids mora no JSON.
  const chave = ids.join(",");
  useEffect(() => {
    let vivo = true;
    produtosEscolhidos(chave ? chave.split(",") : []).then((l) => vivo && setEscolhidos(l));
    return () => {
      vivo = false;
    };
  }, [chave]);

  useEffect(() => {
    const t = termo.trim();
    if (t.length < 2) {
      setAchados([]);
      return;
    }
    let vivo = true;
    setBuscando(true);
    const espera = window.setTimeout(async () => {
      const r = await procurarProdutos(t);
      if (vivo) {
        setAchados(r);
        setBuscando(false);
      }
    }, 300);
    return () => {
      vivo = false;
      window.clearTimeout(espera);
    };
  }, [termo]);

  function mover(i: number, d: -1 | 1) {
    const novo = [...ids];
    const j = i + d;
    if (j < 0 || j >= novo.length) return;
    [novo[i], novo[j]] = [novo[j], novo[i]];
    aoMudar(novo);
  }

  return (
    <div>
      {ids.length > 0 ? (
        <ol className="mb-3 divide-y divide-border/70 rounded-[12px] border border-border bg-white/60">
          {ids.map((id, i) => {
            const p = escolhidos.find((e) => e.trayId === id);
            return (
              <li key={id} className="flex items-center gap-3 px-3 py-2">
                <span className="w-5 text-xs font-semibold text-muted">{i + 1}</span>
                {p?.imagem ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imagem} alt="" className="h-9 w-9 shrink-0 rounded-[8px] bg-white object-contain" />
                ) : (
                  <span className="h-9 w-9 shrink-0 rounded-[8px] bg-ink/5" />
                )}
                <span className="min-w-0 flex-1 truncate text-xs text-ink">{p?.nome ?? `Produto ${id}`}</span>
                <button type="button" onClick={() => mover(i, -1)} aria-label="Subir" className="rounded p-1 text-muted hover:text-brand-nav disabled:opacity-30" disabled={i === 0}>
                  <ArrowUp size={14} />
                </button>
                <button type="button" onClick={() => mover(i, 1)} aria-label="Descer" className="rounded p-1 text-muted hover:text-brand-nav disabled:opacity-30" disabled={i === ids.length - 1}>
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => aoMudar(ids.filter((x) => x !== id))}
                  aria-label={`Tirar ${p?.nome ?? id} da vitrine`}
                  className="rounded p-1 text-muted hover:text-wine"
                >
                  <X size={14} />
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mb-3 text-xs text-muted">Nenhum produto ainda. Procure pelo nome e adicione.</p>
      )}

      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Procurar produto pelo nome ou pelo id da Tray"
          aria-label="Procurar produto"
          className={`${classeDoCampo} pl-8`}
        />
      </div>
      {buscando ? <p className="mt-2 text-xs text-muted">Procurando...</p> : null}
      {achados.length > 0 ? (
        <ul className="mt-2 max-h-64 divide-y divide-border/70 overflow-y-auto rounded-[12px] border border-border bg-white">
          {achados.map((p) => {
            const ja = ids.includes(p.trayId);
            return (
              <li key={p.trayId} className="flex items-center gap-3 px-3 py-2">
                {p.imagem ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imagem} alt="" className="h-9 w-9 shrink-0 rounded-[8px] object-contain" />
                ) : (
                  <span className="h-9 w-9 shrink-0 rounded-[8px] bg-ink/5" />
                )}
                <span className="min-w-0 flex-1 text-xs text-ink">{p.nome}</span>
                <button
                  type="button"
                  disabled={ja}
                  onClick={() => aoMudar([...ids, p.trayId])}
                  className="shrink-0 rounded-full border border-ink/15 px-3 py-1 text-[0.7rem] font-semibold text-ink hover:border-brand/50 hover:text-brand-nav disabled:opacity-40"
                >
                  {ja ? "Já está" : "Adicionar"}
                </button>
              </li>
            );
          })}
        </ul>
      ) : termo.trim().length >= 2 && !buscando ? (
        <p className="mt-2 text-xs text-muted">Nenhum produto ativo com esse nome.</p>
      ) : null}
    </div>
  );
}

/** Nome de cada ícone. `Record` obriga a lista a cobrir todos os ícones. */
const NOMES_DOS_ICONES: Record<ItemDeLink["icone"], string> = {
  link: "Link",
  medidor: "Régua (medidor)",
  alianca: "Alianças",
  loja: "Loja",
  dicas: "Livro (dicas)",
  presente: "Presente",
  whatsapp: "WhatsApp",
  oferta: "Oferta",
};
const ICONES = ICONES_DE_LINK.map((i) => [i, NOMES_DOS_ICONES[i]] as const);

function CamposDosLinks({ bloco, aoMudar }: Props<"links">) {
  const m = (parcial: Partial<BlocoDe<"links">>) => aoMudar({ ...bloco, ...parcial });
  const mudarItem = (i: number, parcial: Partial<ItemDeLink>) =>
    m({ itens: bloco.itens.map((it, j) => (j === i ? { ...it, ...parcial } : it)) });
  function mover(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= bloco.itens.length) return;
    const itens = [...bloco.itens];
    [itens[i], itens[j]] = [itens[j], itens[i]];
    m({ itens });
  }

  return (
    <>
      <Grupo titulo="Bloco">
        <Texto
          rotulo="Título em cima dos links"
          ajuda="Opcional. Vazio, os links aparecem sem título."
          valor={bloco.titulo}
          maximo={32}
          aoMudar={(titulo) => m({ titulo })}
        />
      </Grupo>

      <ol className="space-y-3">
        {bloco.itens.map((it, i) => (
          <li key={it.id} className="rounded-[14px] border border-border bg-white/60 p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs font-semibold text-ink">Link {i + 1}</span>
              <span className="flex-1" />
              <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir link" className="rounded p-1 text-muted hover:text-brand-nav disabled:opacity-30">
                <ArrowUp size={14} />
              </button>
              <button type="button" onClick={() => mover(i, 1)} disabled={i === bloco.itens.length - 1} aria-label="Descer link" className="rounded p-1 text-muted hover:text-brand-nav disabled:opacity-30">
                <ArrowDown size={14} />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Tirar o link "${it.rotulo}"?`)) m({ itens: bloco.itens.filter((_, j) => j !== i) });
                }}
                aria-label={`Tirar o link ${it.rotulo}`}
                className="rounded p-1 text-muted hover:text-wine"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Texto rotulo="Texto" valor={it.rotulo} maximo={40} aoMudar={(rotulo) => mudarItem(i, { rotulo })} />
              <Texto rotulo="Linha de baixo" valor={it.detalhe} maximo={56} aoMudar={(detalhe) => mudarItem(i, { detalhe })} />
              <Endereco
                rotulo="Leva para"
                ajuda="Página do site pode ser só o caminho, como /medidor-de-aliancas."
                valor={it.href}
                aoMudar={(href) => mudarItem(i, { href })}
              />
              <Selecao rotulo="Ícone" valor={it.icone} opcoes={ICONES} aoMudar={(icone) => mudarItem(i, { icone })} />
              <Data rotulo="Aparece a partir de" valor={it.inicio} aoMudar={(inicio) => mudarItem(i, { inicio })} />
              <Data rotulo="Some depois de" valor={it.fim} aoMudar={(fim) => mudarItem(i, { fim })} />
              <div className="sm:col-span-2">
                <Caixa
                  rotulo="Destacar este link"
                  ajuda="Pinta o link com a cor do botão principal. Use em um só, senão nenhum se destaca."
                  marcado={it.destaque}
                  aoMudar={(destaque) => mudarItem(i, { destaque })}
                />
              </div>
            </div>
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={() => m({ itens: [...bloco.itens, linkNovo(idNovo("link"))] })}
        className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-4 py-2 text-xs font-semibold text-ink hover:border-brand/50 hover:text-brand-nav"
      >
        <Plus size={13} /> Adicionar link
      </button>
    </>
  );
}

function CamposDasLojas({ bloco, aoMudar }: Props<"lojas">) {
  const m = (parcial: Partial<BlocoDe<"lojas">>) => aoMudar({ ...bloco, ...parcial });
  return (
    <Grupo titulo="Lista de lojas">
      <Texto rotulo="Título" valor={bloco.titulo} maximo={36} aoMudar={(titulo) => m({ titulo })} />
      <Texto rotulo="Linha de baixo" valor={bloco.detalhe} maximo={56} aoMudar={(detalhe) => m({ detalhe })} />
      <Texto
        rotulo="Mensagem pronta do WhatsApp"
        ajuda="{loja} vira o nome da unidade. Começar dizendo de onde a pessoa veio ajuda o atendimento a marcar a conversa."
        longo
        valor={bloco.mensagem}
        aoMudar={(mensagem) => m({ mensagem })}
      />
    </Grupo>
  );
}

export function CamposDoBloco({
  bloco,
  aoMudar,
  categorias,
}: {
  bloco: BlocoDaBio;
  aoMudar: (novo: BlocoDaBio) => void;
  categorias: CategoriaDaLoja[];
}) {
  switch (bloco.tipo) {
    case "campanha":
      return <CamposDaCampanha bloco={bloco} aoMudar={aoMudar} />;
    case "captura":
      return <CamposDaCaptura bloco={bloco} aoMudar={aoMudar} />;
    case "vitrine":
      return <CamposDaVitrine bloco={bloco} aoMudar={aoMudar} categorias={categorias} />;
    case "links":
      return <CamposDosLinks bloco={bloco} aoMudar={aoMudar} />;
    case "lojas":
      return <CamposDasLojas bloco={bloco} aoMudar={aoMudar} />;
  }
}
