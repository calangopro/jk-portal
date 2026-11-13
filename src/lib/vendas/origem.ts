/**
 * De onde veio o pedido, pelo que a Tray grava na coluna "UTM Source".
 *
 * A Tray só guarda a etiqueta quando o link de entrada traz `utm_source`.
 * Busca do Google, acesso direto e link sem etiqueta chegam vazios, e é por
 * isso que o maior grupo costuma ser "Sem etiqueta": não é erro de leitura.
 *
 * Os valores reais são bagunçados ("1-Google Ads", "ig_Instagram_Stories",
 * "Link+da+Bio+do+RD+Station", "{{site_source_name}}_{{placement}}" quando o
 * anúncio saiu sem trocar a variável), então a tela agrupa por canal. Arquivo
 * puro, para o teste rodar sem banco.
 */

export type Canal =
  | "google_ads"
  | "meta"
  | "bio"
  | "whatsapp"
  | "ia"
  | "pinterest"
  | "tiktok"
  | "email"
  | "sem_etiqueta"
  | "outro";

export const NOME_DO_CANAL: Record<Canal, string> = {
  google_ads: "Google Ads",
  meta: "Instagram e Facebook",
  bio: "Link da bio",
  whatsapp: "WhatsApp",
  ia: "Respostas de IA",
  pinterest: "Pinterest",
  tiktok: "TikTok",
  email: "E-mail",
  sem_etiqueta: "Sem etiqueta",
  outro: "Outros",
};

const IAS = ["chatgpt", "openai", "perplexity", "gemini", "copilot", "claude"];

export function canalDaOrigem(utm: string | null | undefined): Canal {
  let cru = (utm ?? "").replace(/\+/g, " ");
  try {
    cru = decodeURIComponent(cru);
  } catch {
    // Etiqueta com "%" solto não é URL válida: segue com o texto como veio.
  }
  const v = cru.trim().toLowerCase();
  if (!v || v === "undefined" || v === "null") return "sem_etiqueta";
  // A bio vem antes de tudo: "Link da Bio do RD Station" também contém "rd".
  if (/\bbio\b/.test(v)) return "bio";
  if (IAS.some((ia) => v.includes(ia))) return "ia";
  if (v.includes("google")) return "google_ads";
  if (v.includes("whats")) return "whatsapp";
  if (v.includes("pinterest")) return "pinterest";
  if (v.includes("tiktok")) return "tiktok";
  if (
    /^(ig|fb|an|msg|th)(_|$)/.test(v) ||
    v.includes("meta") ||
    v.includes("facebook") ||
    v.includes("instagram") ||
    v.includes("site_source_name")
  ) {
    return "meta";
  }
  if (v.includes("rd station") || v.includes("rdstation") || v.includes("email") || v.includes("e-mail")) return "email";
  return "outro";
}

export type LinhaDeOrigem = { origem: string; pagos: number; valor: number; criados: number };
export type LinhaDeCanal = { canal: Canal; nome: string; pagos: number; valor: number; criados: number };

/** Junta as etiquetas cruas por canal, do que mais faturou para o que menos. */
export function agruparPorCanal(linhas: LinhaDeOrigem[]): LinhaDeCanal[] {
  const porCanal = new Map<Canal, LinhaDeCanal>();
  for (const l of linhas) {
    const canal = canalDaOrigem(l.origem);
    const atual = porCanal.get(canal) ?? { canal, nome: NOME_DO_CANAL[canal], pagos: 0, valor: 0, criados: 0 };
    atual.pagos += Number(l.pagos);
    atual.valor += Number(l.valor);
    atual.criados += Number(l.criados);
    porCanal.set(canal, atual);
  }
  return [...porCanal.values()]
    .map((c) => ({ ...c, valor: Math.round(c.valor * 100) / 100 }))
    .sort((a, b) => b.valor - a.valor || b.criados - a.criados);
}

/** "Par X (Ref. JK9001A) (Disponibilidade: ...)" vira "Par X". */
export function nomeLimpo(nome: string): string {
  return nome.replace(/\s*\((?:Ref\.|Disponibilidade:).*$/i, "").trim() || nome;
}
