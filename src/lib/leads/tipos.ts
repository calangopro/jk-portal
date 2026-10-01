import { z } from "zod";

/**
 * O contato do grupo de ofertas, como chega do formulário e como fica gravado.
 *
 * São três portas com o mesmo corpo: a folha da bio, a página /grupo e o pop-up
 * do tema Esquenta da loja. `origem` diz qual foi; `posicao`, de onde dentro
 * dela a pessoa abriu o formulário (na loja: pop-up por tempo, de saída, botão
 * do palco).
 */

export const ORIGENS_DO_LEAD = ["bio", "grupo", "loja"] as const;
export type OrigemDoLead = (typeof ORIGENS_DO_LEAD)[number];

/** Nome da porta, como o painel e a planilha mostram. */
export const NOMES_DAS_PORTAS: Record<OrigemDoLead, string> = {
  bio: "link da bio",
  grupo: "página /grupo",
  loja: "pop-up da loja",
};

export const MOMENTOS = ["namoro", "noivado", "casamento", "presente"] as const;

const curto = (max: number) =>
  z
    .string()
    .optional()
    .default("")
    .transform((v) => v.trim().slice(0, max));

/** Corpo do POST. Campo desconhecido é ignorado, campo torto derruba o envio. */
export const esquemaDoEnvio = z.object({
  origem: z.enum(ORIGENS_DO_LEAD).default("bio"),
  nome: z
    .string()
    .transform((v) => v.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(2).max(60)),
  whatsapp: z.string(),
  email: curto(120),
  momento: z.enum(MOMENTOS).or(z.literal("")).optional().default(""),
  campanha: curto(40),
  posicao: curto(40),
  pagina: curto(200),
  referencia: curto(500),
  rede: curto(30),
  utm_source: curto(120),
  utm_medium: curto(120),
  utm_campaign: curto(120),
  utm_content: curto(120),
  utm_term: curto(120),
  gclid: curto(200),
  fbclid: curto(500),
  fbc: curto(600),
  fbp: curto(200),
  aceite: z.literal("sim"),
  aceite_texto: z.string().min(1).max(500),
  aceite_em: z
    .string()
    .max(40)
    .refine((v) => !Number.isNaN(Date.parse(v))),
  event_id: z.string().regex(/^[A-Za-z0-9-]{8,64}$/),
  // Campo isca: gente não vê, robô preenche.
  empresa: z.string().optional().default(""),
});

export type EnvioDoFormulario = z.infer<typeof esquemaDoEnvio>;

/** Um destino do repasse e o que aconteceu com ele. */
export const DESTINOS = ["kommo", "rd", "webhook", "meta"] as const;
export type Destino = (typeof DESTINOS)[number];

export const NOMES_DOS_DESTINOS: Record<Destino, string> = {
  kommo: "Kommo",
  rd: "RD Station",
  webhook: "Webhook do grupo",
  meta: "Meta (API de Conversões)",
};

/**
 * - `ok`: chegou.
 * - `erro`: tentou e falhou; o relógio tenta de novo.
 * - `sem_chave`: o destino não está configurado. Fica guardado e sai quando
 *   alguém salvar a chave e mandar enviar os guardados.
 * - `ignorado`: não se aplica a este contato (o RD sem e-mail, o Meta depois
 *   de sete dias).
 */
export type SituacaoDoEnvio = {
  status: "ok" | "erro" | "sem_chave" | "ignorado";
  em: string;
  ref?: string;
  erro?: string;
  tentativas?: number;
};

export type Envios = Partial<Record<Destino, SituacaoDoEnvio>>;

/** A linha de `leads`. */
export type Lead = {
  id: string;
  criado_em: string;
  origem: OrigemDoLead;
  campanha: string;
  posicao: string | null;
  nome: string;
  whatsapp: string;
  email: string | null;
  momento: string | null;
  pagina: string | null;
  referencia: string | null;
  rede: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  gclid: string | null;
  fbclid: string | null;
  fbc: string | null;
  fbp: string | null;
  ip: string | null;
  user_agent: string | null;
  aceite_texto: string;
  aceite_em: string;
  event_id: string;
  clicou_grupo_em: string | null;
  entrou_grupo_em: string | null;
  envios: Envios;
  envio_pendente: boolean;
  tentativas: number;
};

/** Teto de tentativas por destino. Passou disso, só um clique no painel reenvia. */
export const MAX_TENTATIVAS = 6;
