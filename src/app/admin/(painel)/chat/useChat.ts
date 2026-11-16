"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { aoAvisar, avisarAqui, useLigacao, type Ligacao } from "@/lib/time/ao-vivo";
import {
  CHAVE_DO_RASCUNHO, SALAS, comMarcas, daSala, desdeQuandoSincronizar, esperaDoPedido, juntarMensagens, lerSala, minhasSalas,
  montarLinhas, naoLidasPorSala, pedidosEsperando, pessoasComPresenca, primeiraNaoLida,
  type Abertura, type Lidas, type Mensagem, type Sala,
} from "@/lib/time/chat";
import { useAgora } from "../biblioteca/pecas";
import type { ApiDoChat, ImagemEnviada } from "./api";
import type { AcaoDaFala, Pendente } from "./Conversa";
import { useImagens } from "./Imagens";

/**
 * A conversa do chat do time, sem o desenho: o que há na tela, a sincronia
 * com o banco, o que a pessoa leu e o que ela faz (mandar, responder,
 * resolver, apagar, guardar na biblioteca).
 *
 * São DOIS desenhos para a MESMA conversa: a tela cheia (`Tela.tsx`) e a
 * janela flutuante que fica por cima de qualquer tela do painel
 * (`Janela.tsx`). Os dois usam este gancho, as mesmas funções do banco e a
 * mesma ligação ao vivo; não existe um segundo chat.
 *
 * COMO A CONVERSA CHEGA. Ela abre com uma leitura inteira. Daí em diante pede
 * ao banco "o que mudou desde a última vez" em três ocasiões: quando o canal
 * ao vivo avisa que há novidade, quando a aba volta a ficar à vista, e de
 * tempos em tempos (a cada minuto com o canal ligado, a cada 12 segundos sem
 * ele). O canal é acelerador: sem ele o chat continua, só mais devagar.
 *
 * COMO A MENSAGEM VAI. Ela aparece na conversa na hora, mais clara, e só
 * depois vai ao banco. Se falhar, fica na tela com "tentar de novo": texto
 * digitado não some por causa de rede ruim.
 *
 * O QUE CONTA COMO LIDO mora no desenho da sala (`Sala.tsx`), porque depende
 * da rolagem: a sala aberta, com a aba à vista e a conversa no fim. Aqui fica
 * só a gravação (`lerAte`).
 */

export type OpcoesDoChat = {
  abertura: Abertura;
  meuId: string;
  /** A sala que abre primeiro. Sem ela, abre a que tem mensagem nova. */
  salaInicial: Sala | null;
  /** O começo da mensagem, quando a pessoa chega da consulta com uma peça citada. */
  rascunho: string;
  pedirDeInicio: boolean;
  /** A mensagem para onde ir ao abrir (o link que a biblioteca guarda da conversa). */
  destaqueInicial: number | null;
  /** A pessoa pode ver a meta do mês (área de vendas): só ela consegue marcar a meta com "/meta". Quem confere de verdade é o banco. */
  podeMeta: boolean;
  api: ApiDoChat;
  /** Só a prévia de desenvolvimento: uma ligação de mentira, com gente online. */
  ligacaoDaPrevia?: Ligacao;
  /**
   * Falso enquanto a conversa está guardada (a janela flutuante fechada): ela
   * não pergunta nada ao banco de tempos em tempos e não reage ao canal. Ao
   * voltar a verdadeiro, sincroniza na hora. A tela cheia está sempre ativa.
   */
  ativo?: boolean;
  /** Lê o que o tutor deixou escrito para perguntar ao time. Só a tela cheia: é para lá que o tutor manda. */
  lerRascunhoDoTutor?: boolean;
};

const maiores = (a: Lidas, b: Lidas): Lidas => {
  let saida = a;
  for (const [sala, n] of Object.entries(b) as [Sala, number][]) {
    if (n > (saida[sala] ?? 0)) saida = { ...saida, [sala]: n };
  }
  return saida;
};

/** A sala que abre primeiro: uma das minhas com mensagem nova, depois qualquer uma com mensagem nova, depois a geral. */
export function salaComNovidade(a: Abertura, meuId: string): Sala | null {
  const novas = naoLidasPorSala(a.mensagens, a.lidas, meuId, Date.parse(a.agora));
  return minhasSalas(a.setores).find((s) => novas[s] > 0) ?? SALAS.map((s) => s.chave).find((s) => novas[s] > 0) ?? null;
}

export function useChat({
  abertura, meuId, salaInicial, rascunho, pedirDeInicio, destaqueInicial, podeMeta, api, ligacaoDaPrevia, ativo = true, lerRascunhoDoTutor = false,
}: OpcoesDoChat) {
  const ligacaoReal = useLigacao();
  const ligacao = ligacaoDaPrevia ?? ligacaoReal;
  const agora = useAgora(abertura.agora);
  const imagens = useImagens();

  // ------------------------------------------------------------ o que há na tela

  const [mensagens, setMensagens] = useState(abertura.mensagens);
  const guardadas = useRef(mensagens);
  /** Junta o que chegou. A referência anda junto do estado, para a sincronia não depender do próximo desenho. */
  const receber = useCallback((novas: Mensagem[]) => {
    const juntas = juntarMensagens(guardadas.current, novas);
    if (juntas !== guardadas.current) {
      guardadas.current = juntas;
      setMensagens(juntas);
    }
  }, []);
  const [lidas, setLidas] = useState<Lidas>(abertura.lidas);
  const [janelas, setJanelas] = useState<Lidas>(abertura.janelas);

  // A sala de entrada e a linha "Novas mensagens" dela são decididas uma vez, com o que veio na abertura.
  const entrada = useRef<{ sala: Sala; marca: number | null } | null>(null);
  if (!entrada.current) {
    const doLink = destaqueInicial ? abertura.mensagens.find((m) => m.id === destaqueInicial)?.sala : undefined;
    const sala = doLink ?? salaInicial ?? salaComNovidade(abertura, meuId) ?? "geral";
    entrada.current = {
      sala,
      marca: primeiraNaoLida(daSala(abertura.mensagens, sala, abertura.janelas[sala]), abertura.lidas[sala] ?? 0, meuId, Date.parse(abertura.agora)),
    };
  }
  const [sala, setSala] = useState<Sala>(entrada.current.sala);
  const [marca, setMarca] = useState<number | null>(entrada.current.marca);

  const [pendentes, setPendentes] = useState<Pendente[]>([]);
  const [texto, setTexto] = useState(rascunho);
  const [pedir, setPedir] = useState(pedirDeInicio);
  const [respondendo, setRespondendo] = useState<Mensagem | null>(null);
  const [focar, setFocar] = useState(0);
  const [aberta, setAberta] = useState<number | null>(null);
  const [ocupada, setOcupada] = useState<number | null>(null);
  const [apagando, setApagando] = useState<number | null>(null);
  const [guardando, setGuardando] = useState<Mensagem | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [semRede, setSemRede] = useState(false);
  const [carregando, setCarregando] = useState(false);
  /** A mensagem para onde ir: a sala a mostra assim que ela estiver na conversa (pode ainda estar chegando). */
  const [pular, setPular] = useState<{ id: number; ate: number } | null>(() => (destaqueInicial ? { id: destaqueInicial, ate: Date.now() + 8000 } : null));

  const daAberta = useMemo(() => daSala(mensagens, sala, janelas[sala]), [mensagens, sala, janelas]);
  const linhas = useMemo(() => montarLinhas(daAberta, marca), [daAberta, marca]);
  const novasPorSala = useMemo(() => naoLidasPorSala(mensagens, lidas, meuId, agora), [mensagens, lidas, meuId, agora]);
  const esperando = useMemo(() => pedidosEsperando(mensagens), [mensagens]);
  const esperandoAqui = useMemo(() => esperando.filter((m) => m.sala === sala), [esperando, sala]);
  const esperandoPorSala = useMemo(() => {
    const n = Object.fromEntries(SALAS.map((s) => [s.chave, 0])) as Record<Sala, number>;
    for (const m of esperando) n[m.sala] += 1;
    return n;
  }, [esperando]);
  const pessoas = useMemo(() => pessoasComPresenca(abertura.pessoas, ligacao.presenca), [abertura.pessoas, ligacao.presenca]);
  const pendentesDaSala = useMemo(() => pendentes.filter((p) => p.sala === sala), [pendentes, sala]);
  const ultimoId = daAberta[daAberta.length - 1]?.id ?? 0;
  const piorEspera = esperandoAqui.map((m) => esperaDoPedido(m, agora)).find(Boolean) ?? null;

  // -------------------------------------------------------------- a sincronia

  const sincronizando = useRef(false);
  const deNovo = useRef(false);
  const sincronizar = useCallback(async () => {
    if (sincronizando.current) {
      deNovo.current = true;
      return;
    }
    sincronizando.current = true;
    try {
      do {
        deNovo.current = false;
        const r = await api.sincronizar(desdeQuandoSincronizar(guardadas.current, abertura.agora));
        if (!r) {
          setSemRede(true);
          break;
        }
        setSemRede(false);
        if (r.cheio) {
          // Ficou tempo demais sem ler (o computador dormiu): em vez de buscar aos pedaços, abre de novo.
          const tudo = await api.abrir();
          if (tudo) {
            guardadas.current = tudo.mensagens;
            setMensagens(tudo.mensagens);
            setJanelas(tudo.janelas);
            setLidas((l) => maiores(l, tudo.lidas));
          }
          break;
        }
        receber(r.mensagens);
        // O que a pessoa leu em outra aba, no celular ou na outra forma do chat vale aqui também.
        setLidas((l) => maiores(l, r.lidas));
      } while (deNovo.current);
    } finally {
      sincronizando.current = false;
    }
  }, [api, abertura.agora, receber]);

  // Vários avisos seguidos viram uma busca só.
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const agendar = useCallback(() => {
    if (espera.current) return;
    espera.current = setTimeout(() => {
      espera.current = null;
      void sincronizar();
    }, 120);
  }, [sincronizar]);
  useEffect(() => () => {
    if (espera.current) clearTimeout(espera.current);
  }, []);

  // O clique num aviso do sistema, com esta conversa à vista, pede para ir até a mensagem.
  const abrirDoAviso = useRef<(sala: Sala, mensagem: number) => void>(() => undefined);
  useEffect(() => {
    if (!ativo) return;
    return aoAvisar((a) => {
      if (a.tipo === "lida") return;
      if (a.tipo === "abrir") {
        const s = lerSala(a.sala);
        if (s) abrirDoAviso.current(s, a.mensagem);
      }
      agendar();
    });
  }, [agendar, ativo]);

  const [visivel, setVisivel] = useState(true);
  const aoVivo = ligacao.estado === "ao_vivo";
  useEffect(() => {
    if (!ativo) return;
    const olhar = () => {
      const v = document.visibilityState === "visible";
      setVisivel(v);
      if (v) agendar();
    };
    // Voltar a ficar ativo (a janela abriu de novo) também é motivo de perguntar.
    olhar();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") agendar();
    }, aoVivo ? 60_000 : 12_000);
    document.addEventListener("visibilitychange", olhar);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", olhar);
    };
  }, [agendar, aoVivo, ativo]);

  // -------------------------------------------------------------- as imagens

  const [links, setLinks] = useState<Record<string, string | null>>({});
  const pedidas = useRef(new Set<string>());
  const [renovar, setRenovar] = useState(0);
  useEffect(() => {
    const faltam = [...new Set(mensagens.flatMap((m) => m.anexos))].filter((a) => !pedidas.current.has(a));
    if (faltam.length === 0) return;
    faltam.forEach((a) => pedidas.current.add(a));
    void (async () => {
      for (let i = 0; i < faltam.length; i += 60) {
        const lote = faltam.slice(i, i + 60);
        const r = await api.links(lote);
        // O link novo troca o antigo; se a renovação falhar, o antigo fica enquanto valer.
        setLinks((l) => {
          const n = { ...l };
          for (const a of lote) n[a] = r[a] ?? l[a] ?? null;
          return n;
        });
      }
    })();
  }, [mensagens, api, renovar]);
  // O link assinado vale uma hora. A cada 45 minutos a conversa pede todos de novo, sem tirar a imagem da tela.
  useEffect(() => {
    const id = setInterval(() => {
      pedidas.current = new Set();
      setRenovar((n) => n + 1);
    }, 45 * 60_000);
    return () => clearInterval(id);
  }, []);
  const linkDe = useCallback((anexo: string) => links[anexo], [links]);

  // ------------------------------------------------------------------- o lido

  const aLer = useRef<Lidas>({});
  const relogioDeLeitura = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Guarda no banco até onde a pessoa leu, juntando o que acontecer em meio segundo, e manda o menu refazer o número. */
  const gravarLeitura = useCallback(
    (s: Sala, ate: number) => {
      aLer.current[s] = Math.max(aLer.current[s] ?? 0, ate);
      if (relogioDeLeitura.current) return;
      relogioDeLeitura.current = setTimeout(async () => {
        relogioDeLeitura.current = null;
        const lote = Object.entries(aLer.current) as [Sala, number][];
        aLer.current = {};
        await Promise.all(lote.map(([qual, n]) => api.marcarLida(qual, n)));
        avisarAqui({ tipo: "lida" });
      }, 500);
    },
    [api],
  );
  /** A pessoa leu a sala até esta mensagem. Quem decide QUANDO chamar é o desenho da sala. */
  const lerAte = useCallback(
    (s: Sala, ate: number) => {
      setLidas((l) => (ate > (l[s] ?? 0) ? { ...l, [s]: ate } : l));
      gravarLeitura(s, ate);
    },
    [gravarLeitura],
  );

  // --------------------------------------------------------- o que a pessoa faz

  // O que o tutor deixou escrito para perguntar ao time. Vem pelo navegador, e não pelo endereço.
  useEffect(() => {
    if (!lerRascunhoDoTutor) return;
    try {
      const deixado = sessionStorage.getItem(CHAVE_DO_RASCUNHO);
      if (!deixado) return;
      sessionStorage.removeItem(CHAVE_DO_RASCUNHO);
      setTexto((t) => t || deixado.slice(0, 4000));
      setPedir(true);
      setFocar((n) => n + 1);
    } catch {
      // Navegador sem armazenamento de sessão: a pessoa escreve a pergunta.
    }
  }, [lerRascunhoDoTutor]);

  /**
   * Troca a sala aberta. `deNovo` refaz a linha "Novas mensagens" mesmo sendo
   * a mesma sala: é a janela flutuante voltando da lista de salas para a
   * conversa.
   */
  const trocarDeSala = (s: Sala, deNovo = false) => {
    if (s === sala && !deNovo) return;
    setMarca(primeiraNaoLida(daSala(mensagens, s, janelas[s]), lidas[s] ?? 0, meuId, agora));
    setSala(s);
    setRespondendo(null);
    setAberta(null);
    setApagando(null);
    setAviso(null);
    setGuardando(null);
  };

  /** Abre a sala e vai até a mensagem (o clique num aviso do sistema). */
  const abrirNaMensagem = (s: Sala, mensagem: number) => {
    trocarDeSala(s);
    setPular({ id: mensagem, ate: Date.now() + 8000 });
  };
  abrirDoAviso.current = abrirNaMensagem;

  const despachar = useCallback(
    async (p: Pendente) => {
      const falhar = (erro: string) => setPendentes((l) => l.map((x) => (x.chave === p.chave ? { ...x, erro } : x)));
      setPendentes((l) => l.map((x) => (x.chave === p.chave ? { ...x, erro: null } : x)));
      let enviadas: ImagemEnviada[] = [];
      if (p.imagens.length > 0) {
        const subidas = await api.subirImagens(meuId, p.imagens.map((i) => i.arquivo));
        if (!subidas.ok) return falhar(subidas.erro);
        enviadas = subidas.imagens;
      }
      // O que a pessoa escreveu como "@Nome", "#123" e "/meta" vai ao banco como marcação. Ele confere e devolve o texto pronto.
      const r = await api.enviar({ sala: p.sala, texto: comMarcas(p.texto, abertura.pessoas, podeMeta), respondeA: p.respondeA?.id ?? null, pede: p.pede, imagens: enviadas });
      if (!r.ok) return falhar(r.erro);
      p.imagens.forEach((i) => URL.revokeObjectURL(i.previa));
      setPendentes((l) => l.filter((x) => x.chave !== p.chave));
      receber([r.mensagem]);
      setLidas((l) => ({ ...l, [p.sala]: Math.max(l[p.sala] ?? 0, r.mensagem.id) }));
      api.avisar(p.sala);
      // A mensagem respondida mudou (ganhou uma resposta, e o pedido pode ter sido atendido).
      if (p.respondeA) agendar();
    },
    [api, meuId, receber, agendar, abertura.pessoas, podeMeta],
  );

  const enviar = () => {
    const escrito = texto.trim();
    if (!escrito && imagens.lista.length === 0) return;
    const p: Pendente = { chave: crypto.randomUUID(), sala, texto: escrito, respondeA: respondendo, pede: pedir, imagens: imagens.soltar(), erro: null };
    setPendentes((l) => [...l, p]);
    setTexto("");
    setRespondendo(null);
    setPedir(false);
    setAviso(null);
    // A linha "Novas mensagens" já cumpriu o papel: quem respondeu leu.
    setMarca(null);
    void despachar(p);
  };

  const descartar = (p: Pendente) => {
    p.imagens.forEach((i) => URL.revokeObjectURL(i.previa));
    setPendentes((l) => l.filter((x) => x.chave !== p.chave));
  };

  const responderA = (m: Mensagem) => {
    setRespondendo(m);
    setAberta(null);
    setFocar((n) => n + 1);
  };

  const focarCampo = useCallback(() => setFocar((n) => n + 1), []);

  const aoAgir = async (m: Mensagem, qual: AcaoDaFala) => {
    if (qual === "responder") return responderA(m);
    if (qual === "guardar") {
      setAberta(null);
      return setGuardando(m);
    }
    // Apagar pede dois toques: o primeiro vira a pergunta.
    if (qual === "apagar" && apagando !== m.id) return setApagando(m.id);
    setOcupada(m.id);
    setAviso(null);
    const r = await api[qual](m.id);
    setOcupada(null);
    setApagando(null);
    if (!r.ok) return setAviso(r.erro);
    receber([r.mensagem]);
    setAberta(null);
    api.avisar(m.sala);
    // Quem respondeu à mensagem apagada mostrava um trecho dela.
    if (qual === "apagar") agendar();
  };

  /**
   * Busca as mensagens anteriores da sala aberta. `antesDeReceber` é chamado
   * logo antes de elas entrarem na conversa: é quando o desenho guarda a
   * posição da rolagem, para nada pular debaixo do olho.
   */
  const carregarAnteriores = async (antesDeReceber?: (s: Sala) => void) => {
    const s = sala;
    const janela = janelas[s];
    if (janela === undefined || carregando) return;
    setCarregando(true);
    const r = await api.anteriores(s, janela);
    setCarregando(false);
    if (!r) return setAviso("Não deu para buscar as mensagens anteriores. Tente de novo.");
    antesDeReceber?.(s);
    receber(r.mensagens);
    setJanelas((j) => {
      const n = { ...j };
      const primeira = r.mensagens[0]?.id;
      if (r.temMais && primeira) n[s] = primeira;
      else delete n[s];
      return n;
    });
  };

  return {
    abertura, meuId, podeMeta, api, ligacao, agora, imagens,
    mensagens, lidas, janelas, sala, marca, setMarca,
    pendentes, pendentesDaSala, texto, setTexto, pedir, setPedir, respondendo, setRespondendo, focar, focarCampo,
    aberta, setAberta, ocupada, apagando, setApagando, guardando, setGuardando, aviso, setAviso, semRede, carregando,
    daAberta, linhas, novasPorSala, esperando, esperandoAqui, esperandoPorSala, pessoas, ultimoId, piorEspera,
    visivel, linkDe, agendar, pular, setPular, lerAte,
    trocarDeSala, abrirNaMensagem, despachar, enviar, descartar, responderA, aoAgir, carregarAnteriores,
  };
}

export type Chat = ReturnType<typeof useChat>;
