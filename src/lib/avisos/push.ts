/**
 * Avisos por push (cartão 59): a conta pura. Sem banco, sem navegador, sem
 * rede: serve ao servidor, à tela e ao teste (`npm run verificar:avisos`).
 *
 * O QUE VIRA AVISO não é decidido aqui: é a régua do banco (`chat_para_avisar`,
 * `suporte_para_avisar` e a da Kommo em `push_pendentes`, 0190). Aqui mora o
 * resto: a chave de cada evento (uma notificação por evento por pessoa), o
 * texto da Kommo, o teto por minuto, o que cada aparelho escolheu receber, o
 * formato que vai ao service worker e o que a tela de ligar oferece.
 *
 * NUNCA DADO DE CLIENTE NO AVISO. A tela bloqueada do celular é lida por quem
 * estiver perto: nada de telefone, valor ou nome de cliente. O chat já vem
 * assim do banco (quem escreveu e o começo do texto do time); o suporte já
 * vinha sem cliente (0102); a Kommo sai só com funil e etapa.
 */

export type Categoria = "chat" | "suporte" | "kommo";
export const CATEGORIAS: readonly Categoria[] = ["chat", "suporte", "kommo"];

export const NOME_DA_CATEGORIA: Record<Categoria, string> = {
  chat: "Chat do time",
  suporte: "Suporte pós-venda",
  kommo: "Cliente esperando na Kommo",
};

/** O aviso pronto, antes de ir ao aparelho. `url` é o caminho do painel SEM o prefixo `/guias`, ou um endereço completo (a Kommo). */
export type Aviso = {
  categoria: Categoria;
  /** A notificação com a mesma marca troca a anterior em vez de empilhar. */
  marca: string;
  titulo: string;
  corpo: string;
  url: string;
};

/** Quantos avisos por pessoa por minuto, no máximo. Passou disso, o resto vira um aviso só. */
export const TETO_POR_MINUTO = 4;

// ------------------------------------------------------------------ chaves

/** Um evento, uma chave. É ela que o banco guarda (`push_enviados`) para nunca avisar duas vezes. */
export const chaveDoChat = (mensagem: number) => `chat:${mensagem}`;
export const chaveDoSuporte = (caso: number, tipo: string) => `suporte:${caso}:${tipo}`;
/** O negócio que volta a esperar outro dia é outro evento: a data em que começou a esperar entra na chave. */
export const chaveDaKommo = (k: NegocioParaAvisar) => `kommo:${k.id}:${k.motivo}:${Date.parse(k.desde) || 0}`;

// ------------------------------------------------------------------ Kommo

export type NegocioParaAvisar = {
  id: number;
  motivo: "sem_resposta" | "esperando_vendedor";
  desde: string;
  funil: string | null;
  etapa: string | null;
};

const objeto = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const textoOuNulo = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

export function lerNegocios(v: unknown): NegocioParaAvisar[] {
  return (Array.isArray(v) ? v : [])
    .map(objeto)
    .map((n): NegocioParaAvisar | null => {
      if (!n) return null;
      const id = Number(n.id);
      const motivo = n.motivo === "sem_resposta" || n.motivo === "esperando_vendedor" ? n.motivo : null;
      const desde = textoOuNulo(n.desde);
      if (!Number.isSafeInteger(id) || id <= 0 || !motivo || !desde) return null;
      return { id, motivo, desde, funil: textoOuNulo(n.funil), etapa: textoOuNulo(n.etapa) };
    })
    .filter((n): n is NegocioParaAvisar => n !== null);
}

export const ENDERECO_DA_KOMMO = "https://kathleengfz.kommo.com/leads/detail/";

const esperaEmPalavras = (desde: string, agora: number): string => {
  const min = Math.max(0, Math.round((agora - Date.parse(desde)) / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return h === 1 ? "1 hora" : `${h} horas`;
  const d = Math.floor(h / 24);
  return d === 1 ? "1 dia" : `${d} dias`;
};

/** O aviso de um negócio da Kommo. Só funil, etapa e o tempo de espera: o nome do negócio costuma ser o do cliente e fica de fora. */
export function avisoDaKommo(k: NegocioParaAvisar, agora: number): Aviso {
  const onde = [k.funil, k.etapa].filter(Boolean).join(", ");
  const espera = esperaEmPalavras(k.desde, agora);
  return {
    categoria: "kommo",
    marca: `jk-kommo-${k.id}`,
    titulo: k.motivo === "sem_resposta" ? "Cliente sem resposta na Kommo" : "Cliente esperando na Kommo",
    corpo:
      k.motivo === "sem_resposta"
        ? `A última mensagem do cliente está sem resposta há ${espera}${onde ? `. ${onde}` : ""}.`
        : `Esperando vendedor há ${espera}${onde ? `. ${onde}` : ""}.`,
    url: `${ENDERECO_DA_KOMMO}${k.id}`,
  };
}

// ------------------------------------------------------------------ endereços

export const urlDoChat = (sala: string, mensagem: number) => `/admin/chat?sala=${encodeURIComponent(sala)}&m=${mensagem}`;
export const urlDoSuporte = (caso: number) => `/admin/suporte?caso=${caso}`;

/**
 * O que fazer com o endereço tocado no aviso, já dentro do painel. Devolve a
 * sala e a mensagem quando é do chat (a moldura abre a janela flutuante nela),
 * `suporte` quando é do suporte, e o caminho para o resto.
 */
export function destinoDoToque(url: string):
  | { tipo: "chat"; sala: string; mensagem: number }
  | { tipo: "suporte"; caso: number | null }
  | { tipo: "caminho"; caminho: string }
  | { tipo: "fora"; url: string } {
  if (/^https?:\/\//.test(url)) return { tipo: "fora", url };
  const [caminho, busca = ""] = url.split("?");
  const p = new URLSearchParams(busca);
  if (caminho === "/admin/chat") {
    const sala = p.get("sala");
    const m = Number(p.get("m"));
    if (sala && Number.isSafeInteger(m) && m > 0) return { tipo: "chat", sala, mensagem: m };
  }
  if (caminho === "/admin/suporte") {
    const c = Number(p.get("caso"));
    return { tipo: "suporte", caso: Number.isSafeInteger(c) && c > 0 ? c : null };
  }
  return { tipo: "caminho", caminho: url.startsWith("/admin") ? url : "/admin" };
}

// ------------------------------------------------------------------ teto

/**
 * Corta no teto por minuto. `jaNoMinuto` é quanto a pessoa recebeu nos
 * últimos 60 segundos. Cabem todos: vão todos. Não cabem: vão os primeiros
 * e o último lugar vira "mais N avisos", que leva ao painel. Teto já gasto:
 * nada sai agora (o evento fica marcado como avisado, e o número do menu
 * continua mostrando).
 */
export function aplicarTeto(avisos: readonly Aviso[], jaNoMinuto: number, teto = TETO_POR_MINUTO): Aviso[] {
  const vagas = Math.max(0, teto - Math.max(0, jaNoMinuto));
  if (avisos.length <= vagas) return [...avisos];
  if (vagas === 0) return [];
  const vao = avisos.slice(0, vagas - 1);
  const resto = avisos.length - vao.length;
  const cats = [...new Set(avisos.slice(vagas - 1).map((a) => a.categoria))];
  return [
    ...vao,
    {
      categoria: cats.length === 1 ? cats[0] : "chat",
      marca: "jk-resumo",
      titulo: `Mais ${resto} avisos no painel`,
      corpo: `De ${cats.map((c) => NOME_DA_CATEGORIA[c].toLowerCase()).join(" e ")}. Abra o painel para ver tudo.`,
      url: cats.length === 1 && cats[0] === "suporte" ? "/admin/suporte" : cats.length === 1 && cats[0] === "chat" ? "/admin/chat" : "/admin/hoje",
    },
  ];
}

/** O que este aparelho escolheu receber. O resumo do teto vai se o aparelho recebe alguma das categorias que ele resume. */
export function paraOAparelho(avisos: readonly Aviso[], avisar: readonly string[]): Aviso[] {
  const quer = new Set(avisar);
  return avisos.filter((a) => (a.marca === "jk-resumo" ? quer.size > 0 : quer.has(a.categoria)));
}

export function lerCategorias(v: unknown): Categoria[] {
  return Array.isArray(v) ? CATEGORIAS.filter((c) => v.includes(c)) : [...CATEGORIAS];
}

// ------------------------------------------------------------------ o que vai ao service worker

export type CargaDoPush = { titulo: string; corpo: string; marca: string; url: string; icone: string; emblema: string };

/** O texto que vai cifrado ao aparelho. Cortado para caber folgado no limite de 4 KB do push. */
export function cargaDoPush(a: Aviso, prefixo: string): CargaDoPush {
  return {
    titulo: a.titulo.slice(0, 120),
    corpo: a.corpo.slice(0, 240),
    marca: a.marca,
    url: /^https?:\/\//.test(a.url) ? a.url : `${prefixo}${a.url}`,
    icone: `${prefixo}/painel-icone-192.png`,
    emblema: `${prefixo}/painel-icone-192.png`,
  };
}

/** O serviço de push respondeu que a inscrição não existe mais (desinstalou, limpou o navegador, negou o aviso): a linha sai. */
export const inscricaoMorreu = (status: number) => status === 404 || status === 410;

// ------------------------------------------------------------------ inscrição

export type Inscricao = { endpoint: string; p256dh: string; auth: string };

/** Confere a inscrição que o navegador mandou. Endereço só https, chaves em base64url do tamanho certo. */
export function lerInscricao(v: unknown): Inscricao | null {
  const o = objeto(v);
  const k = o ? objeto(o.keys) : null;
  const endpoint = o && typeof o.endpoint === "string" ? o.endpoint : "";
  const p256dh = k && typeof k.p256dh === "string" ? k.p256dh : "";
  const auth = k && typeof k.auth === "string" ? k.auth : "";
  const b64 = /^[A-Za-z0-9_-]+=*$/;
  if (!/^https:\/\/[^\s]+$/.test(endpoint) || endpoint.length > 1000) return null;
  if (!b64.test(p256dh) || p256dh.length < 20 || p256dh.length > 200) return null;
  if (!b64.test(auth) || auth.length < 8 || auth.length > 100) return null;
  return { endpoint, p256dh, auth };
}

/** Celular ou computador, e o navegador, para a lista de aparelhos. Só rótulo: nenhuma decisão sai daqui. */
export function aparelhoDoNavegador(ua: string): { tipo: "celular" | "computador"; navegador: string } {
  const celular = /iPhone|iPad|iPod|Android|Mobile/i.test(ua);
  const sistema = /iPhone|iPad|iPod/i.test(ua) ? "iPhone" : /Android/i.test(ua) ? "Android" : /Mac OS X/i.test(ua) ? "Mac" : /Windows/i.test(ua) ? "Windows" : null;
  const nav = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung" : /Firefox\//.test(ua) ? "Firefox" : /(Chrome|CriOS)\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  return { tipo: celular ? "celular" : "computador", navegador: sistema ? `${nav} no ${sistema}` : nav };
}

// ------------------------------------------------------------------ a tela de ligar

/**
 * O que a tela oferece neste aparelho, pela CAPACIDADE do navegador, nunca
 * pelo nome do aparelho:
 *   instalar    o navegador não tem push, mas é o Safari do iPhone fora do
 *               app (tem `navigator.standalone`): no iPhone o push só existe
 *               no painel adicionado à tela de início (iOS 16.4 ou mais);
 *   sem_suporte não tem push e não há o que fazer aqui;
 *   bloqueado   o aviso deste site foi negado no navegador;
 *   desligado   dá para ligar;
 *   ligado      este aparelho está inscrito.
 */
export type EstadoDoPush = "instalar" | "sem_suporte" | "bloqueado" | "desligado" | "ligado";

export function estadoDoPush(c: {
  temPush: boolean;
  temServiceWorker: boolean;
  /** `'standalone' in navigator`: só o Safari do iPhone e do iPad tem. */
  safariDoIphone: boolean;
  instalado: boolean;
  permissao: "default" | "granted" | "denied" | null;
  inscrito: boolean;
}): EstadoDoPush {
  if (!c.temPush || !c.temServiceWorker || c.permissao === null) {
    return c.safariDoIphone && !c.instalado ? "instalar" : "sem_suporte";
  }
  if (c.permissao === "denied") return "bloqueado";
  return c.inscrito && c.permissao === "granted" ? "ligado" : "desligado";
}
