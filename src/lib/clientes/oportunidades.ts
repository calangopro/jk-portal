/**
 * Oportunidades de venda: o que vence nos próximos dias para cada cliente.
 *
 * É CONTA, não tabela. A cada leitura o banco entrega o que se sabe do cliente
 * (a ficha, as compras pagas, o que foi gravado nas peças) e este arquivo
 * decide o que vale uma conversa: aniversário chegando, aniversário de namoro
 * ou de casamento, casamento marcado sem aliança comprada, namoro que já dura
 * e não virou noivado, e um ano da compra.
 *
 * O texto do que oferecer é REGRA ESCRITA, sem modelo de linguagem, e não
 * promete o que a JK não decidiu: nada de prazo, de desconto nem de serviço
 * grátis. Onde a regra depende de uma decisão da casa (o polimento, por
 * exemplo), o texto manda combinar com a loja.
 *
 * DATA TIRADA DA GRAVAÇÃO é palpite: aparece como "sugerida pela gravação" e
 * só vira dado quando alguém confirma na ficha. Nada aqui grava coisa nenhuma.
 *
 * Arquivo puro e sozinho, para o teste rodar sem banco: as contas de data
 * moram aqui dentro porque módulo puro não importa função de arquivo irmão.
 */
import type { Tom } from "../painel/tons.ts";

// ------------------------------------------------------------------- a ficha

export type Fase = "namoro" | "noivado" | "casamento_marcado" | "casado" | "nao_sei";

export const FASES: { chave: Fase; nome: string }[] = [
  { chave: "namoro", nome: "Namoro" },
  { chave: "noivado", nome: "Noivado" },
  { chave: "casamento_marcado", nome: "Casamento marcado" },
  { chave: "casado", nome: "Casado" },
  { chave: "nao_sei", nome: "Não sei" },
];

export const NOME_DA_FASE = Object.fromEntries(FASES.map((f) => [f.chave, f.nome])) as Record<Fase, string>;

export function lerFase(v: unknown): Fase | null {
  return FASES.some((f) => f.chave === v) ? (v as Fase) : null;
}

// ------------------------------------------------------------------ as datas

/**
 * Data que pode vir sem o ano: `AAAA-MM-DD` ou `MM-DD`. Aniversário quase
 * nunca vem com o ano, e a gravação da aliança muitas vezes é só "12.06".
 */
export type DataParcial = string;

const bissexto = (a: number) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
const dois = (n: number) => String(n).padStart(2, "0");
const iso = (a: number, m: number, d: number) => `${String(a).padStart(4, "0")}-${dois(m)}-${dois(d)}`;

export function diasNoMes(ano: number, mes: number): number {
  return [31, bissexto(ano) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1];
}

/** Abre a data parcial. Dia que não existe (30 de fevereiro) vira null; 29 de fevereiro sem ano vale. */
export function lerDataParcial(v: string | null | undefined): { ano: number | null; mes: number; dia: number } | null {
  const m = /^(?:(\d{4})-)?(\d{2})-(\d{2})$/.exec(v ?? "");
  if (!m) return null;
  const ano = m[1] ? Number(m[1]) : null;
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1) return null;
  if (ano !== null && (ano < 1900 || ano > 2100)) return null;
  if (dia > diasNoMes(ano ?? 2024, mes)) return null;
  return { ano, mes, dia };
}

/** "2024-06-12" vira "12/06/2024"; "06-12" vira "12/06". */
export function dataPorExtenso(v: DataParcial | null | undefined): string {
  const d = lerDataParcial(v);
  if (!d) return "";
  return `${dois(d.dia)}/${dois(d.mes)}${d.ano === null ? "" : `/${d.ano}`}`;
}

function anoCompleto(texto: string, referencia: number): number | null {
  let a = Number(texto);
  // Dois dígitos: "26" é 2026 enquanto couber até cinco anos à frente; passou disso é do século passado.
  if (texto.length === 2) a = 2000 + a <= referencia + 5 ? 2000 + a : 1900 + a;
  return a >= 1940 && a <= referencia + 5 ? a : null;
}

/**
 * O que a pessoa digitou no campo de data da ficha: "12/06", "12/06/24",
 * "12.06.2024" ou "12-06". Vazio é "apagar a data" (`null`). O que não dá para
 * entender devolve `undefined`, e a tela pede para corrigir.
 */
export function interpretarDataDigitada(texto: string | null | undefined, anoDeHoje: number): DataParcial | null | undefined {
  const s = (texto ?? "").trim();
  if (!s) return null;
  const m = /^(\d{1,2})\s*[./-]\s*(\d{1,2})(?:\s*[./-]\s*(\d{4}|\d{2}))?$/.exec(s);
  if (!m) return undefined;
  const ano = m[3] ? anoCompleto(m[3], anoDeHoje) : null;
  if (m[3] && ano === null) return undefined;
  const data = ano === null ? `${dois(Number(m[2]))}-${dois(Number(m[1]))}` : iso(ano, Number(m[2]), Number(m[1]));
  return lerDataParcial(data) ? data : undefined;
}

export function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Soma meses sem estourar o mês: 30 de abril mais dez meses é 28 (ou 29) de fevereiro, como no banco. */
export function somarMeses(dia: string, n: number): string {
  const total = Number(dia.slice(0, 4)) * 12 + Number(dia.slice(5, 7)) - 1 + n;
  const ano = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  return iso(ano, mes, Math.min(Number(dia.slice(8, 10)), diasNoMes(ano, mes)));
}

/** Dias corridos de `de` até `ate`. Negativo quando `ate` já passou. */
export function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);
}

/** O dia em que a data cai naquele ano. 29 de fevereiro vira 28 em ano comum. */
export function ocorrenciaNoAno(data: DataParcial, ano: number): string | null {
  const d = lerDataParcial(data);
  if (!d) return null;
  return iso(ano, d.mes, d.mes === 2 && d.dia === 29 && !bissexto(ano) ? 28 : d.dia);
}

// --------------------------------------------------------------- a gravação

/**
 * Dia e mês com ponto, barra ou hífen, e o ano se vier com o mesmo separador.
 * O que vem colado em dois pontos fica de fora: "1 Cor 13:4-7" é versículo, e
 * sem essa trava o "4-7" virava 4 de julho.
 */
const DATA_NA_GRAVACAO = /(?<![\d:])(\d{1,2})\s*([./-])\s*(\d{1,2})(?:\s*\2\s*(\d{4}|\d{2}))?(?![\d:])/g;

/**
 * As datas escritas num texto de gravação, como "André 12.06" ou "Ana e Leo
 * 18/07/26". O ano de referência é o do pedido: é ele que decide se "26" é
 * 2026. Ano que não faz sentido cai fora e fica só o dia e o mês.
 */
export function datasNaGravacao(texto: string | null | undefined, anoDoPedido: number): DataParcial[] {
  const achadas: DataParcial[] = [];
  for (const m of (texto ?? "").matchAll(DATA_NA_GRAVACAO)) {
    const dia = Number(m[1]);
    const mes = Number(m[3]);
    const ano = m[4] ? anoCompleto(m[4], anoDoPedido) : null;
    const data = ano === null ? `${dois(mes)}-${dois(dia)}` : iso(ano, mes, dia);
    if (lerDataParcial(data) && !achadas.includes(data)) achadas.push(data);
  }
  return achadas;
}

// ------------------------------------------------------------------ as peças

export type TipoDePeca = "namoro" | "noivado" | "casamento" | "alianca" | "anel" | "outra";

/**
 * O que a peça é, pelo nome que a loja deu. Namoro vem primeiro de propósito:
 * quase todo par de namoro da JK se chama "Par de Alianças de Namoro ... +
 * Anel Solitário", e o solitário ali é brinde, não noivado. `alianca` é a
 * aliança que o nome não diz para quê (as banhadas a ouro de moeda antiga).
 */
export function tipoDaPeca(nome: string | null | undefined): TipoDePeca {
  const n = (nome ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  // "Caixinha para Alianças e Anel" tem aliança no nome e não é aliança.
  if (/^(caixinha|caixa|estojo|porta|embalagem|sacola|flanela)\b/.test(n)) return "outra";
  if (/namoro|compromisso/.test(n)) return "namoro";
  if (/casamento/.test(n)) return "casamento";
  if (/noivado/.test(n)) return "noivado";
  if (/alianca/.test(n)) return "alianca";
  if (/\b(anel|aneis)\b/.test(n)) return "anel";
  return "outra";
}

// ------------------------------------------------------------ as oportunidades

export type TipoDeOportunidade =
  | "aniversario_cliente"
  | "aniversario_par"
  | "aniversario_namoro"
  | "aniversario_casamento"
  | "casamento_chegando"
  | "namoro_sem_noivado"
  | "um_ano_da_compra";

export const TIPOS: { chave: TipoDeOportunidade; nome: string }[] = [
  { chave: "aniversario_cliente", nome: "Aniversário do cliente" },
  { chave: "aniversario_par", nome: "Aniversário do par" },
  { chave: "aniversario_namoro", nome: "Aniversário de namoro" },
  { chave: "aniversario_casamento", nome: "Aniversário de casamento" },
  { chave: "casamento_chegando", nome: "Casamento chegando" },
  { chave: "namoro_sem_noivado", nome: "Namoro sem noivado" },
  { chave: "um_ano_da_compra", nome: "Um ano da compra" },
];

export const NOME_DO_TIPO = Object.fromEntries(TIPOS.map((t) => [t.chave, t.nome])) as Record<TipoDeOportunidade, string>;

export function lerTipo(v: unknown): TipoDeOportunidade | null {
  return TIPOS.some((t) => t.chave === v) ? (v as TipoDeOportunidade) : null;
}

/** As janelas que a tela oferece. A do meio é a de fábrica. */
export const JANELAS = [7, 30, 90];
export const JANELA_PADRAO = 30;

/**
 * PREMISSAS, não regra da JK: por quantos dias a oportunidade continua na lista
 * DEPOIS da data. Parabéns atrasado ainda cabe por uma semana; casamento que já
 * aconteceu não é mais venda de aliança; os marcos de compra (dez meses, um
 * ano) não têm dia certo e esperam um mês e meio. Depois disso a ocorrência
 * some sozinha, para a lista não virar depósito, e a do ano seguinte volta.
 */
export const DIAS_DEPOIS: Record<TipoDeOportunidade, number> = {
  aniversario_cliente: 7,
  aniversario_par: 7,
  aniversario_namoro: 7,
  aniversario_casamento: 7,
  casamento_chegando: 0,
  namoro_sem_noivado: 45,
  um_ano_da_compra: 45,
};

export const MAIOR_ESPERA = Math.max(...Object.values(DIAS_DEPOIS));

/** Meses depois da compra em que nasce uma oportunidade. Cada marco se repete de ano em ano. */
export const MESES_DO_NAMORO = 10;
export const MESES_DO_POLIMENTO = 12;
export const MARCOS_EM_MESES = [MESES_DO_NAMORO, MESES_DO_POLIMENTO];

/**
 * Data tirada da gravação só conta a partir de dois meses depois da compra.
 * Quem grava "15/11" numa aliança comprada em 5 de novembro vai usar a peça
 * naquele dia: chamar no dia 15 seria oferecer presente a quem acabou de
 * comprar. PREMISSA.
 */
export const CARENCIA_DA_GRAVACAO = 60;

export type FichaParaConta = {
  fase: Fase;
  parNome: string | null;
  aniversario: DataParcial | null;
  aniversarioPar: DataParcial | null;
  dataNamoro: DataParcial | null;
  dataCasamento: DataParcial | null;
  /** Datas da gravação que alguém já disse que não são do casal. */
  datasRecusadas: DataParcial[];
};

export type CompraParaConta = {
  /** Número do pedido na loja. `null` em venda fechada por fora. */
  pedido: number | null;
  dia: string;
  /** O nome do frete, que diz se foi retirada em loja. */
  frete: string | null;
  cidade: string | null;
  uf: string | null;
  /** `null`: os itens deste pedido não foram importados (pedidos de antes de 14/10/2026). */
  pecas: { nome: string; gravacoes: string[] }[] | null;
};

export type Decisao = "falei" | "nao_vale" | "reaberta";

export type MarcaParaConta = { tipo: TipoDeOportunidade; ocorrencia: string; decisao: Decisao };

export type ClienteParaConta = {
  /** Primeiro nome, já arrumado, para os textos. */
  nome: string | null;
  ficha: FichaParaConta | null;
  /** Só compras PAGAS: pedido cancelado não é aliança no dedo de ninguém. */
  compras: CompraParaConta[];
  marcadas: MarcaParaConta[];
};

export type LojaFisica = { nome: string; cidade: string };

export type Oportunidade = {
  tipo: TipoDeOportunidade;
  /** O dia desta ocorrência. Com o tipo, é o que identifica "já falei" e "não vale". */
  ocorrencia: string;
  /** Dias até a data. Negativo: já passou. */
  emDias: number;
  /** De onde saiu a data: da ficha, de uma compra, ou da gravação (palpite, a confirmar). */
  origem: "ficha" | "compra" | "gravacao";
  motivo: string;
  oferecer: string;
};

export type Sugestao = {
  data: DataParcial;
  /** O palpite: aliança de casamento sugere data de casamento; o resto, de namoro. */
  campo: "data_namoro" | "data_casamento";
  pedido: number | null;
  peca: string;
  /** O texto gravado, como o cliente escreveu. */
  trecho: string;
};

/**
 * As datas escritas nas gravações que ninguém confirmou nem recusou. Some a
 * sugestão cujo campo já está preenchido na ficha: ali a pergunta foi
 * respondida.
 */
export function sugestoesDaGravacao(c: ClienteParaConta): Sugestao[] {
  const recusadas = new Set(c.ficha?.datasRecusadas ?? []);
  const vistas = new Set<string>();
  const lista: Sugestao[] = [];
  for (const compra of c.compras) {
    for (const peca of compra.pecas ?? []) {
      const campo = tipoDaPeca(peca.nome) === "casamento" ? "data_casamento" : "data_namoro";
      if (campo === "data_namoro" ? c.ficha?.dataNamoro : c.ficha?.dataCasamento) continue;
      for (const trecho of peca.gravacoes) {
        for (const data of datasNaGravacao(trecho, Number(compra.dia.slice(0, 4)))) {
          if (recusadas.has(data) || vistas.has(data)) continue;
          vistas.add(data);
          lista.push({ data, campo, pedido: compra.pedido, peca: peca.nome, trecho });
        }
      }
    }
  }
  return lista;
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** As vezes em que a data cai dentro da janela, com quantos anos faz (quando o ano é conhecido). */
function ocorrencias(data: DataParcial, de: string, ate: string): { dia: string; anos: number | null }[] {
  const d = lerDataParcial(data);
  if (!d) return [];
  const lista: { dia: string; anos: number | null }[] = [];
  for (let ano = Number(de.slice(0, 4)); ano <= Number(ate.slice(0, 4)); ano++) {
    const dia = ocorrenciaNoAno(data, ano) as string;
    if (dia >= de && dia <= ate) lista.push({ dia, anos: d.ano === null ? null : ano - d.ano });
  }
  return lista;
}

/**
 * A loja para convidar: a de retirada do pedido, se houve; senão, as lojas da
 * cidade do cliente. Sem nenhuma das duas, o cliente é de longe.
 */
export function lojaParaConvidar(compra: CompraParaConta, lojas: LojaFisica[]): { retirada: string | null; daCidade: string[] } {
  const retirada = /^retir[ae]\s+na\s+loja\s+(?:d[oae]s?\s+)?(.+)$/i.exec((compra.frete ?? "").trim());
  if (retirada) return { retirada: retirada[1].replace(/\s+-\s+/g, ", ").trim(), daCidade: [] };
  const cidade = semAcento(compra.cidade ?? "");
  return { retirada: null, daCidade: cidade ? lojas.filter((l) => semAcento(l.cidade) === cidade).map((l) => l.nome) : [] };
}

function convitePara(compra: CompraParaConta, lojas: LojaFisica[]): string {
  const combinar = "Combine antes com a loja como o serviço funciona.";
  const { retirada, daCidade } = lojaParaConvidar(compra, lojas);
  if (retirada) return `Convidar para polir e limpar a aliança na loja do ${retirada}, onde retirou o pedido. ${combinar}`;
  if (daCidade.length === 1) return `Convidar para polir e limpar a aliança na loja ${daCidade[0]}. ${combinar}`;
  if (daCidade.length > 1) {
    return `Convidar para polir e limpar a aliança em uma das lojas de ${compra.cidade}: ${daCidade.join(", ")}. ${combinar}`;
  }
  if (compra.cidade) {
    return `Cliente de ${compra.cidade}${compra.uf ? ` (${compra.uf})` : ""}, sem loja da JK na cidade. Perguntar como está a aliança e explicar o cuidado em casa.`;
  }
  return "Perguntar como está a aliança. Sem cidade no pedido, não dá para indicar loja.";
}

function presenteDeNamoro(fase: Fase, anos: number | null): string {
  if (fase === "noivado" || fase === "casamento_marcado") return "Presente para a data. Se o casamento está perto, falar das alianças de casamento.";
  if (fase === "casado") return "Presente para a data: anel ou semijoia.";
  if (anos !== null && anos >= 2) return "Presente para a data: anel solitário ou semijoia. Com esse tempo juntos, vale perguntar se já pensam em noivado.";
  return "Presente para a data: anel solitário ou semijoia.";
}

/**
 * Tudo o que vence para UM cliente entre hoje e daqui a `dias`, mais o que
 * passou há pouco (ver `DIAS_DEPOIS`). O que alguém já marcou como "já falei"
 * ou "não vale" não volta; a ocorrência do ano seguinte é outra, e volta.
 */
export function oportunidadesDoCliente(c: ClienteParaConta, hoje: string, dias: number, lojas: LojaFisica[] = []): Oportunidade[] {
  const ate = somarDias(hoje, dias);
  const desde = (tipo: TipoDeOportunidade) => somarDias(hoje, -DIAS_DEPOIS[tipo]);
  const f = c.ficha;
  const fase = f?.fase ?? "nao_sei";
  const nome = c.nome ?? "o cliente";
  const lista: Oportunidade[] = [];
  const por = (tipo: TipoDeOportunidade, ocorrencia: string, origem: Oportunidade["origem"], motivo: string, oferecer: string) => {
    if (!lista.some((o) => o.tipo === tipo && o.ocorrencia === ocorrencia)) {
      lista.push({ tipo, ocorrencia, emDias: diasEntre(hoje, ocorrencia), origem, motivo, oferecer });
    }
  };

  const tipos = new Set(c.compras.flatMap((co) => (co.pecas ?? []).map((p) => tipoDaPeca(p.nome))));
  /** Comprou aliança que já é, ou pode ser, de noivado ou de casamento. */
  const comprouAdiante = tipos.has("noivado") || tipos.has("casamento") || tipos.has("alianca");

  if (f?.aniversario) {
    for (const o of ocorrencias(f.aniversario, desde("aniversario_cliente"), ate)) {
      por("aniversario_cliente", o.dia, "ficha", `Aniversário de ${nome}.`, "Dar os parabéns e perguntar da aliança. Se a conversa abrir, mostrar anel ou semijoia.");
    }
  }

  if (f?.aniversarioPar) {
    for (const o of ocorrencias(f.aniversarioPar, desde("aniversario_par"), ate)) {
      por(
        "aniversario_par",
        o.dia,
        "ficha",
        f.parNome ? `Aniversário de ${f.parNome}, par de ${nome}.` : `Aniversário do par de ${nome}.`,
        `Presente para ${f.parNome ?? "o par"}: anel solitário, colar ou brinco. Chame com folga, para dar tempo de entregar.`,
      );
    }
  }

  // Datas do casal: vale a da ficha; sem ela, o palpite da gravação.
  const sugestoes = sugestoesDaGravacao(c);
  const daGravacao = (campo: Sugestao["campo"], tipo: TipoDeOportunidade, texto: (data: string, anos: number | null) => string, oferecer: (anos: number | null) => string) => {
    for (const s of sugestoes.filter((x) => x.campo === campo)) {
      const compra = c.compras.find((co) => co.pedido === s.pedido && (co.pecas ?? []).some((p) => p.gravacoes.includes(s.trecho)));
      const liberada = somarDias(compra?.dia ?? hoje, CARENCIA_DA_GRAVACAO);
      for (const o of ocorrencias(s.data, desde(tipo), ate)) {
        if (o.dia < liberada || (o.anos !== null && o.anos < 1)) continue;
        por(tipo, o.dia, "gravacao", texto(dataPorExtenso(s.data), o.anos), oferecer(o.anos));
      }
    }
  };

  if (f?.dataNamoro) {
    for (const o of ocorrencias(f.dataNamoro, desde("aniversario_namoro"), ate)) {
      if (o.anos !== null && o.anos < 1) continue;
      por("aniversario_namoro", o.dia, "ficha", o.anos === null ? "Aniversário de namoro." : `${plural(o.anos, "ano", "anos")} de namoro.`, presenteDeNamoro(fase, o.anos));
    }
  } else {
    daGravacao(
      "data_namoro",
      "aniversario_namoro",
      (data, anos) => `A aliança foi gravada com ${data}. Pode ser o aniversário de namoro${anos === null ? "" : `, de ${plural(anos, "ano", "anos")}`}.`,
      (anos) => presenteDeNamoro(fase, anos),
    );
  }

  const presenteDeCasamento = "Presente de aniversário de casamento: anel, semijoia ou um par novo de alianças.";
  const casamento = lerDataParcial(f?.dataCasamento);
  if (f?.dataCasamento && casamento) {
    // Com ano, o calendário decide se já aconteceu. Sem ano, decide a fase: só "casado" é aniversário.
    const vaiCasar = casamento.ano !== null ? f.dataCasamento >= hoje : fase !== "casado";
    if (vaiCasar) {
      if (!tipos.has("casamento") && !tipos.has("alianca")) {
        for (const o of ocorrencias(f.dataCasamento, hoje, ate)) {
          if (o.anos !== null && o.anos !== 0) continue;
          por(
            "casamento_chegando",
            o.dia,
            "ficha",
            `Casamento marcado para ${dataPorExtenso(o.dia)} e nenhuma aliança de casamento comprada na JK.`,
            "Par de alianças de casamento. Confirme o prazo de produção antes de combinar a entrega.",
          );
        }
      }
    } else {
      for (const o of ocorrencias(f.dataCasamento, desde("aniversario_casamento"), ate)) {
        if (o.anos !== null && o.anos < 1) continue;
        por("aniversario_casamento", o.dia, "ficha", o.anos === null ? "Aniversário de casamento." : `${plural(o.anos, "ano", "anos")} de casamento.`, presenteDeCasamento);
      }
    }
  } else {
    daGravacao(
      "data_casamento",
      "aniversario_casamento",
      (data, anos) => `A aliança de casamento foi gravada com ${data}. Pode ser o aniversário de casamento${anos === null ? "" : `, de ${plural(anos, "ano", "anos")}`}.`,
      () => presenteDeCasamento,
    );
  }

  // Namoro que já dura: conta da compra de namoro MAIS RECENTE, e se repete a cada ano.
  const namoros = c.compras.filter((co) => (co.pecas ?? []).some((p) => tipoDaPeca(p.nome) === "namoro")).map((co) => co.dia).sort();
  const ultimoNamoro = namoros[namoros.length - 1];
  if (ultimoNamoro && !comprouAdiante && fase !== "casado") {
    for (let k = 0; k < 60; k++) {
      const meses = MESES_DO_NAMORO + 12 * k;
      const marco = somarMeses(ultimoNamoro, meses);
      if (marco > ate) break;
      if (marco < desde("namoro_sem_noivado")) continue;
      por(
        "namoro_sem_noivado",
        marco,
        "compra",
        `Comprou aliança de namoro há ${meses} meses e não comprou de noivado nem de casamento.`,
        fase === "casamento_marcado"
          ? "Alianças de casamento: a ficha diz que o casamento está marcado."
          : fase === "noivado"
            ? "Alianças de casamento, e o anel de noivado se ainda não tem."
            : "Perguntar como está o casal e mostrar as alianças de noivado e de casamento.",
      );
    }
  }

  // Um ano da compra, e os seguintes: só de peça que se usa no dedo. Pedido sem
  // os itens no painel entra também, com o aviso: quase tudo o que a loja vende é aliança.
  for (const compra of c.compras) {
    const semItens = compra.pecas === null;
    if (compra.pecas !== null && !compra.pecas.some((p) => tipoDaPeca(p.nome) !== "outra")) continue;
    for (let anos = 1; anos < 60; anos++) {
      const marco = somarMeses(compra.dia, MESES_DO_POLIMENTO * anos);
      if (marco > ate) break;
      if (marco < desde("um_ano_da_compra")) continue;
      por(
        "um_ano_da_compra",
        marco,
        "compra",
        `${anos === 1 ? "Um ano" : `${anos} anos`} da compra${compra.pedido ? ` (pedido ${compra.pedido})` : ""}.`,
        convitePara(compra, lojas) + (semItens ? " Os itens deste pedido não estão no painel: veja na loja o que foi comprado." : ""),
      );
    }
  }

  const resolvidas = new Set(c.marcadas.filter((m) => m.decisao !== "reaberta").map((m) => `${m.tipo}|${m.ocorrencia}`));
  return lista
    .filter((o) => !resolvidas.has(`${o.tipo}|${o.ocorrencia}`))
    .sort((a, b) => a.ocorrencia.localeCompare(b.ocorrencia) || a.tipo.localeCompare(b.tipo));
}

// --------------------------------------------------------- a lista na tela

/**
 * A lista que vale na tela: a que veio do servidor, SEM o que foi marcado
 * nesta visita e COM o que foi reaberto nela.
 *
 * Existe porque a tela não pode esperar o redesenho da página para se acertar:
 * o painel reaproveita por 30 segundos a página que já buscou, e dentro desse
 * intervalo o servidor "ainda devolve" a oportunidade que acabou de ser
 * marcada, ou "ainda não devolve" a que acabou de ser reaberta. O que a pessoa
 * fez agora vale mais do que o que o servidor disse há pouco.
 */
export function listaQueVale<T extends { ocorrencia: string }>(doServidor: T[], marcadasAgora: T[], reabertasAgora: T[], id: (o: T) => string): T[] {
  const marcadas = new Set(marcadasAgora.map(id));
  const jaVieram = new Set(doServidor.map(id));
  return [...doServidor, ...reabertasAgora.filter((o) => !jaVieram.has(id(o)))]
    .filter((o) => !marcadas.has(id(o)))
    .sort((a, b) => a.ocorrencia.localeCompare(b.ocorrencia));
}

// ------------------------------------------------------------------- o prazo

/** "hoje", "amanhã", "em 12 dias", "ontem", "há 3 dias". */
export function prazoEmPalavra(emDias: number): string {
  if (emDias === 0) return "hoje";
  if (emDias === 1) return "amanhã";
  if (emDias === -1) return "ontem";
  return emDias > 0 ? `em ${emDias} dias` : `há ${-emDias} dias`;
}

/** Passou da data: vermelho. É hoje ou amanhã: âmbar. O resto não tem cor. */
export function tomDoPrazo(emDias: number): Tom {
  if (emDias < 0) return "ruim";
  if (emDias <= 1) return "atencao";
  return "neutro";
}
