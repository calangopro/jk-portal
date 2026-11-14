/**
 * Saúde das ligações: cada rotina agendada e cada destino dos contatos, com o
 * estado de agora e o que fazer quando não está bom.
 *
 * De onde veio: em novembro de 2026 o RD Station passou três dias recusando a
 * chave do portal sem ninguém ver. O dado estava no banco o tempo todo; faltava
 * uma conta que olhasse para ele e dissesse "isto parou".
 *
 * TRÊS REGRAS:
 *
 * 1. Rotina é julgada pela última rodada BOA, e não pela última rodada. Rota
 *    que responde erro de cinco em cinco minutos está rodando e está quebrada.
 * 2. Cada rotina tem a própria tolerância, perto de três vezes o intervalo
 *    dela. A de pedidos tolera a noite inteira, porque só roda das 8h às 23h.
 * 3. Destino sem chave não é erro, é ligação que nunca foi feita: aparece como
 *    "desligada", com quantos contatos estão esperando.
 *
 * Arquivo puro, para o teste rodar sem banco.
 */
import type { Sinal } from "./sinais.ts";

export type EstadoDaLigacao = "ok" | "atencao" | "ruim" | "desligada" | "sem_registro";

export type Ligacao = {
  chave: string;
  grupo: "rotina" | "destino";
  nome: string;
  /** O que ela faz, em uma linha, para quem não sabe o que é. */
  paraQue: string;
  estado: EstadoDaLigacao;
  /** O estado em palavras, com o número que o sustenta. */
  frase: string;
  /** O que fazer para resolver. Nulo quando está tudo certo. */
  oQueFazer: string | null;
};

export type SaudeCrua = {
  agora: string;
  rotinas: { rotina: string; ultima_em: string; ok: boolean; detalhe: string | null; ultima_boa_em: string | null }[];
  leituras: { fonte: string; ultima_em: string; ultima_boa_em: string | null; ultimo_status: string; ultimo_erro: string | null }[];
  destinos: {
    destino: string;
    ok: number;
    erro: number;
    sem_chave: number;
    ignorado: number;
    ultimo_ok_em: string | null;
    erro_desde: string | null;
    ultimo_erro: string | null;
    fora_da_fila: number;
  }[];
  contatos: number;
};

type Rotina = {
  chave: string;
  /** `pulso`: a rota grava em `rotinas_pulso`. `leitura`: a rotina já registrava em `sync_logs`. */
  origem: "pulso" | "leitura";
  id: string;
  nome: string;
  paraQue: string;
  /** Minutos sem rodada boa a partir dos quais a rotina é dada como parada. */
  tolerancia: number;
  seParar: string;
};

const HORA = 60;
const DIA = 24 * HORA;
const AVISAR = "Avise quem cuida do painel.";

export const ROTINAS: Rotina[] = [
  { chave: "catalogo", origem: "leitura", id: "tray", nome: "Catálogo da loja", paraQue: "Traz preço e disponibilidade dos produtos da Tray, de 15 em 15 minutos.", tolerancia: 90, seParar: AVISAR },
  {
    chave: "pedidos", origem: "leitura", id: "tray_pedidos", nome: "Pedidos da loja",
    paraQue: "Traz os pedidos da Tray de hora em hora, das 8h às 23h. Roda no Mac do Filipe.",
    tolerancia: 14 * HORA, seParar: "Confira se o Mac está ligado, o Chrome aberto e a Tray logada.",
  },
  { chave: "gasto-meta", origem: "leitura", id: "anuncios_meta", nome: "Gasto do Meta", paraQue: "Lê quanto foi gasto em anúncio no Meta, de hora em hora.", tolerancia: 4 * HORA, seParar: "Confira o token do Meta em Integrações." },
  { chave: "gasto-google", origem: "leitura", id: "anuncios_google", nome: "Gasto do Google Ads", paraQue: "Lê quanto foi gasto em anúncio no Google, de hora em hora.", tolerancia: 4 * HORA, seParar: AVISAR },
  { chave: "leads", origem: "pulso", id: "leads", nome: "Reenvio de contatos", paraQue: "Tenta de novo, a cada 10 minutos, o contato que não chegou ao destino.", tolerancia: HORA, seParar: AVISAR },
  { chave: "publicar", origem: "pulso", id: "publicar", nome: "Publicação agendada", paraQue: "Publica o conteúdo agendado, olhando a cada 5 minutos.", tolerancia: 45, seParar: AVISAR },
  { chave: "avaliacoes", origem: "pulso", id: "avaliacoes", nome: "Avaliações do Google", paraQue: "Relê as avaliações das lojas uma vez por dia.", tolerancia: 36 * HORA, seParar: "Confira a ligação com o Google em Integrações." },
  { chave: "search-console", origem: "pulso", id: "search-console", nome: "Search Console", paraQue: "Importa as buscas do Google toda segunda de manhã.", tolerancia: 8 * DIA + 12 * HORA, seParar: AVISAR },
];

const DESTINOS: Record<string, { nome: string; paraQue: string }> = {
  rd: { nome: "RD Station", paraQue: "Recebe o cadastro, para a sequência de e-mails." },
  kommo: { nome: "Kommo", paraQue: "Entrega o contato ao vendedor, no CRM." },
  meta: { nome: "Meta, API de Conversões", paraQue: "Avisa o Meta de cada cadastro, para o anúncio aprender." },
  webhook: { nome: "Ferramenta do grupo", paraQue: "Avisa a ferramenta do grupo de WhatsApp." },
};

/** "há 12 minutos", "há 3 horas", "há 2 dias". */
export function haQuantoTempo(minutos: number): string {
  const m = Math.max(0, Math.round(minutos));
  if (m < 2) return "agora há pouco";
  if (m < 90) return `há ${m} minutos`;
  const h = Math.round(m / 60);
  if (h < 36) return `há ${h} horas`;
  return `há ${Math.round(m / DIA)} dias`;
}

/** "11/11 às 12h26", no relógio de São Paulo. */
export function diaEHora(quando: string): string {
  const p = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(quando));
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${v("day")}/${v("month")} às ${v("hour")}h${v("minute")}`;
}

/**
 * O erro como a pessoa consegue ler: sem o corpo técnico da resposta, e com a
 * tradução dos dois casos mais comuns.
 */
export function resumoDoErro(erro: string | null): string | null {
  if (!erro) return null;
  const curto = erro.split(/[{[]/)[0].replace(/[:\s]+$/, "").trim().slice(0, 90);
  if (/\b401\b|\b403\b|unauthorized/i.test(erro)) return `${curto || "Acesso recusado"} (a chave foi recusada)`;
  if (/\b429\b/.test(erro)) return `${curto} (pedidos demais em pouco tempo)`;
  return curto || erro.slice(0, 90);
}

const minutosEntre = (de: string | null, ate: number) => (de ? (ate - Date.parse(de)) / 60_000 : Infinity);

function avaliarRotina(r: Rotina, cru: SaudeCrua, agora: number): Ligacao {
  const base = { chave: r.chave, grupo: "rotina" as const, nome: r.nome, paraQue: r.paraQue };
  let ultima: string | null = null;
  let ultimaBoa: string | null = null;
  let ultimaFalhou = false;
  let erro: string | null = null;

  if (r.origem === "pulso") {
    const p = cru.rotinas.find((x) => x.rotina === r.id);
    if (p) {
      ultima = p.ultima_em;
      ultimaBoa = p.ultima_boa_em;
      ultimaFalhou = !p.ok;
      erro = p.ok ? null : p.detalhe;
    }
  } else {
    const l = cru.leituras.find((x) => x.fonte === r.id);
    if (l) {
      ultima = l.ultima_em;
      ultimaBoa = l.ultima_boa_em;
      ultimaFalhou = l.ultimo_status !== "success";
      erro = ultimaFalhou ? l.ultimo_erro : null;
    }
  }

  if (!ultima) return { ...base, estado: "sem_registro", frase: "Ainda sem registro. Aparece depois da primeira rodada.", oQueFazer: null };

  const semBoa = minutosEntre(ultimaBoa, agora);
  const motivo = resumoDoErro(erro);
  if (semBoa > r.tolerancia) {
    const desde = ultimaBoa ? `Parada ${haQuantoTempo(semBoa)}.` : "Nunca rodou bem.";
    return { ...base, estado: "ruim", frase: `${desde}${motivo ? ` Último erro: ${motivo}.` : ""}`, oQueFazer: r.seParar };
  }
  if (ultimaFalhou) {
    return { ...base, estado: "atencao", frase: `A última rodada falhou${motivo ? ` (${motivo})` : ""}, mas a anterior funcionou ${haQuantoTempo(semBoa)}.`, oQueFazer: "Costuma se recuperar sozinha. Se continuar, a linha fica vermelha." };
  }
  return { ...base, estado: "ok", frase: `Funcionando. Última rodada ${haQuantoTempo(semBoa)}.`, oQueFazer: null };
}

const contatos = (n: number) => (n === 1 ? "1 contato" : `${n} contatos`);

function avaliarDestino(d: SaudeCrua["destinos"][number]): Ligacao {
  const info = DESTINOS[d.destino] ?? { nome: d.destino, paraQue: "Destino de contatos." };
  const base = { chave: `destino-${d.destino}`, grupo: "destino" as const, nome: info.nome, paraQue: info.paraQue };

  if (d.erro > 0) {
    const motivo = resumoDoErro(d.ultimo_erro);
    return {
      ...base,
      estado: "ruim",
      frase: `Recusando desde ${d.erro_desde ? diaEHora(d.erro_desde) : "data desconhecida"}: ${contatos(d.erro)} ${d.erro === 1 ? "não entrou" : "não entraram"}.${motivo ? ` Último erro: ${motivo}.` : ""}`,
      oQueFazer:
        "Cole a chave nova em Integrações e clique em Enviar os guardados." +
        (d.fora_da_fila > 0 ? ` ${d.fora_da_fila === 1 ? "1 contato já saiu" : `${d.fora_da_fila} contatos já saíram`} da fila de reenvio e só ${d.fora_da_fila === 1 ? "volta" : "voltam"} por esse botão.` : ""),
    };
  }
  if (d.ok === 0 && d.sem_chave > 0) {
    return {
      ...base,
      estado: "desligada",
      frase: `Sem chave. ${contatos(d.sem_chave)} ${d.sem_chave === 1 ? "guardado" : "guardados"} no portal, esperando.`,
      oQueFazer: "Cole a chave em Integrações. Os contatos guardados seguem pelo botão Enviar os guardados.",
    };
  }
  const fora = d.ignorado > 0 ? ` ${contatos(d.ignorado)} sem e-mail ${d.ignorado === 1 ? "ficou" : "ficaram"} de fora, porque este destino exige e-mail.` : "";
  return { ...base, estado: "ok", frase: `Funcionando. ${contatos(d.ok)} ${d.ok === 1 ? "entregue" : "entregues"}.${fora}`, oQueFazer: null };
}

const ORDEM: Record<EstadoDaLigacao, number> = { ruim: 0, desligada: 1, atencao: 2, sem_registro: 3, ok: 4 };

/** Todas as ligações, das que pedem ação para as que estão bem. */
export function avaliarSaude(cru: SaudeCrua): Ligacao[] {
  const agora = Date.parse(cru.agora);
  const lista = [...ROTINAS.map((r) => avaliarRotina(r, cru, agora)), ...cru.destinos.map(avaliarDestino)];
  return lista.sort((a, b) => ORDEM[a.estado] - ORDEM[b.estado]);
}

const juntar = (nomes: string[]) => (nomes.length <= 1 ? nomes.join("") : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`);

/**
 * Os avisos da Visão geral. Cada ligação quebrada vira um aviso; as desligadas
 * viram um só, porque três avisos de "falta chave" seguidos são ruído.
 */
export function sinaisDaSaude(ligacoes: Ligacao[]): Sinal[] {
  const link = { href: "/admin/saude", rotulo: "Ver a saúde das ligações" };
  const sinais: Sinal[] = ligacoes
    .filter((l) => l.estado === "ruim")
    .map((l) => ({
      chave: `saude-${l.chave}`,
      gravidade: "problema" as const,
      // Acima de qualquer sinal em reais: ligação quebrada contamina os números de todos os outros.
      peso: 5e11,
      titulo: l.grupo === "destino" ? `${l.nome} está recusando os contatos` : `${l.nome}: a rotina parou`,
      texto: `${l.frase}${l.oQueFazer ? ` ${l.oQueFazer}` : ""}`,
      link,
    }));

  const desligadas = ligacoes.filter((l) => l.estado === "desligada");
  if (desligadas.length > 0) {
    sinais.push({
      chave: "saude-sem-chave",
      gravidade: "atencao",
      peso: 4e11,
      titulo: `${desligadas.length === 1 ? "Um destino de contato está" : `${desligadas.length} destinos de contato estão`} sem chave: ${juntar(desligadas.map((l) => l.nome))}`,
      texto: "O contato captado fica guardado no portal e não chega a esses lugares. Colando a chave em Integrações, os guardados seguem pelo botão Enviar os guardados.",
      link: { href: "/admin/integracoes", rotulo: "Abrir Integrações" },
    });
  }
  return sinais;
}
