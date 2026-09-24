"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { SITE } from "@/lib/seo/site";

/**
 * O endereço da bio já etiquetado para cada canal.
 *
 * A etiqueta (UTM) é o que separa orgânico de anúncio no GA4. O `fbclid` que o
 * Instagram põe em todo clique NÃO serve para isso, porque aparece também no
 * clique orgânico. E como a bio e a loja são o mesmo domínio e a mesma
 * propriedade do GA4, a etiqueta de ENTRADA vale até a compra: a venda fica com
 * "instagram / social" ou "instagram / paid_social".
 *
 * `utm_medium` segue os nomes que o GA4 reconhece nos canais padrão: `social`
 * cai em "Social orgânico" e `paid_social` em "Social pago".
 *
 * O endereço é o da loja, e não `SITE.origin`, porque em desenvolvimento a
 * origem é localhost e o link copiado iria quebrado para o Instagram.
 */
const BIO = `${SITE.lojaUrl}/bio`;

const CANAIS = [
  {
    nome: "Bio do Instagram",
    onde: "Editar perfil, campo Links.",
    valor: `${BIO}?utm_source=instagram&utm_medium=social&utm_campaign=link_na_bio`,
  },
  {
    nome: "Stories do Instagram",
    onde: "Figurinha de link do story.",
    valor: `${BIO}?utm_source=instagram&utm_medium=social&utm_campaign=stories`,
  },
  {
    nome: "Bio do TikTok",
    onde: "Editar perfil, campo Site.",
    valor: `${BIO}?utm_source=tiktok&utm_medium=social&utm_campaign=link_na_bio`,
  },
  {
    nome: "WhatsApp",
    onde: "Status, listas de transmissão e grupo.",
    valor: `${BIO}?utm_source=whatsapp&utm_medium=social&utm_campaign=whatsapp`,
  },
  {
    nome: "Anúncio no Meta",
    onde:
      "No anúncio, cole o endereço da bio sem nada em Site e isto em Parâmetros de URL. O Meta troca o que está entre chaves pelo nome da campanha e do anúncio. Anúncio só no Facebook: troque instagram por facebook.",
    valor: "utm_source=instagram&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}",
  },
];

export function LinksParaDivulgar() {
  const [copiado, setCopiado] = useState<string | null>(null);

  async function copiar(nome: string, valor: string) {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(nome);
      window.setTimeout(() => setCopiado((c) => (c === nome ? null : c)), 2000);
    } catch {
      // Sem permissão de área de transferência: o texto está na tela para copiar à mão.
    }
  }

  return (
    <section className="glass rounded-[18px] p-5">
      <h2 className="font-medium text-ink">Links para divulgar</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Use o link de cada canal. É ele que diz ao GA4 se a pessoa veio do perfil ou de anúncio, e a venda na loja fica
        com essa origem até o fim.
      </p>
      <ul className="mt-4 space-y-3">
        {CANAIS.map((c) => (
          <li key={c.nome} className="rounded-[12px] border border-border bg-white/60 p-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-ink">{c.nome}</p>
                <p className="mt-0.5 text-[0.68rem] leading-snug text-muted">{c.onde}</p>
              </div>
              <button
                type="button"
                onClick={() => copiar(c.nome, c.valor)}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-ink/15 px-2.5 py-1 text-[0.68rem] font-semibold text-ink hover:border-brand/50 hover:text-brand-nav"
              >
                {copiado === c.nome ? <Check size={12} /> : <Copy size={12} />}
                {copiado === c.nome ? "Copiado" : "Copiar"}
              </button>
            </div>
            <code className="mt-2 block break-all rounded-[8px] bg-ink/5 px-2 py-1.5 text-[0.66rem] leading-relaxed text-ink">
              {c.valor}
            </code>
          </li>
        ))}
      </ul>
    </section>
  );
}
