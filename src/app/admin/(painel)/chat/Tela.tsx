"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, Check, ChevronDown, ChevronUp, CornerUpLeft, Loader2, MessageCircleQuestion, Radio, TriangleAlert, Users, WifiOff, X } from "lucide-react";
import { COR_DO_TOM } from "@/lib/painel/tons";
import { aoAvisar, avisarAqui, useLigacao, type Ligacao } from "@/lib/time/ao-vivo";
import {
  CHAVE_DO_RASCUNHO, NOME_DA_SALA, SALAS, daSala, desdeQuandoSincronizar, esperaDoPedido, juntarMensagens, lerSala, limitesPorExtenso, minhasSalas,
  montarLinhas, naoLidasPorSala, pedidosEsperando, pessoasComPresenca, primeiraNaoLida, rascunhoDaResposta, trechoDe,
  type Abertura, type EstadoDoAviso, type Lidas, type Mensagem, type Sala,
} from "@/lib/time/chat";
import { SeloDeTom } from "../Pecas";
import { FormularioDeResposta } from "../biblioteca/FormularioDeResposta";
import { botaoCheio, botaoClaro, useAgora } from "../biblioteca/pecas";
import { apiDoChat, type ApiDoChat, type ImagemEnviada } from "./api";
import { AvisoDoSistema } from "./AvisoDoSistema";
import { Conversa, type AcaoDaFala, type Pendente } from "./Conversa";
import { Escrever } from "./Escrever";
import { useImagens } from "./Imagens";
import { ListaDePessoas, Ponto, resumoDaPresenca } from "./Pessoas";

/**
 * O chat do time: salas por setor, conversa ao vivo e quem está online.
 *
 * COMO A CONVERSA CHEGA. A tela abre com o que o servidor leu. Daí em diante
 * ela pede ao banco "o que mudou desde a última vez" em três ocasiões: quando
 * o canal ao vivo avisa que há novidade, quando a aba volta a ficar à vista, e
 * de tempos em tempos (a cada minuto com o canal ligado, a cada 12 segundos
 * sem ele). O canal é acelerador: sem ele o chat continua, só mais devagar, e
 * a tela diz que está assim.
 *
 * COMO A MENSAGEM VAI. Ela aparece na conversa na hora, mais clara, e só
 * depois vai ao banco. Se falhar, fica na tela com "tentar de novo": texto
 * digitado não some por causa de rede ruim.
 *
 * O QUE CONTA COMO LIDO. A sala aberta, com a aba à vista e a conversa no fim.
 * Quem subiu para ler mensagem antiga não marca como lido o que chegou embaixo.
 *
 * As chamadas ao banco vêm de fora, como propriedade (`api`), para a tela
 * poder ser vista sem sessão durante o desenvolvimento.
 */

type Props = {
  abertura: Abertura | null;
  meuId: string;
  souAdmin: boolean;
  /** `?sala=`: a sala que abre primeiro. Sem ela, abre a que tem mensagem nova. */
  salaInicial: Sala | null;
  /** O começo da mensagem, quando a pessoa chega da consulta com uma peça citada. */
  rascunho: string;
  pedirDeInicio: boolean;
  /** `?m=`: a mensagem para onde ir (o link que a biblioteca guarda da conversa). */
  destaqueInicial: number | null;
  api?: ApiDoChat;
  /** Só a prévia de desenvolvimento: uma ligação de mentira, com gente online. */
  ligacaoDaPrevia?: Ligacao;
  /** Só a prévia de desenvolvimento: o estado do aviso do sistema, sem pedir permissão de verdade. */
  avisoDaPrevia?: EstadoDoAviso;
};

const maiores = (a: Lidas, b: Lidas): Lidas => {
  let saida = a;
  for (const [sala, n] of Object.entries(b) as [Sala, number][]) {
    if (n > (saida[sala] ?? 0)) saida = { ...saida, [sala]: n };
  }
  return saida;
};

/** A sala que abre primeiro: uma das minhas com mensagem nova, depois qualquer uma com mensagem nova, depois a geral. */
function salaParaAbrir(a: Abertura, meuId: string): Sala {
  const novas = naoLidasPorSala(a.mensagens, a.lidas, meuId, Date.parse(a.agora));
  return minhasSalas(a.setores).find((s) => novas[s] > 0) ?? SALAS.map((s) => s.chave).find((s) => novas[s] > 0) ?? "geral";
}

export function TelaDoChat(p: Props) {
  const router = useRouter();
  if (!p.abertura) {
    return (
      <div className="glass rounded-[18px] p-5">
        <p className="flex items-center gap-2 text-sm font-bold" style={{ color: COR_DO_TOM.ruim.texto }}>
          <TriangleAlert size={16} aria-hidden="true" /> Não deu para abrir o chat agora
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink">A conversa não foi lida. Costuma ser a conexão: tente de novo em alguns segundos.</p>
        <button type="button" onClick={() => router.refresh()} className={`${botaoCheio} mt-3`}>
          Tentar de novo
        </button>
      </div>
    );
  }
  return <Chat {...p} abertura={p.abertura} />;
}

function Chat({
  abertura, meuId, souAdmin, salaInicial, rascunho, pedirDeInicio, destaqueInicial, api = apiDoChat, ligacaoDaPrevia, avisoDaPrevia,
}: Props & { abertura: Abertura }) {
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

  // A sala de entrada e a linha "Novas mensagens" dela são decididas uma vez, com o que o servidor mandou.
  const entrada = useRef<{ sala: Sala; marca: number | null } | null>(null);
  if (!entrada.current) {
    const doLink = destaqueInicial ? abertura.mensagens.find((m) => m.id === destaqueInicial)?.sala : undefined;
    const sala = doLink ?? salaInicial ?? salaParaAbrir(abertura, meuId);
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
  const [destaque, setDestaque] = useState<number | null>(null);
  const [guardando, setGuardando] = useState<Mensagem | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [semRede, setSemRede] = useState(false);
  const [verPessoas, setVerPessoas] = useState(false);
  // A lista dos pedidos que esperam começa fechada; no computador, onde sobra altura, abre sozinha.
  const [verPedidos, setVerPedidos] = useState(false);
  const telaLarga = useRef(false);
  useEffect(() => {
    telaLarga.current = window.matchMedia("(min-width: 64rem)").matches;
    setVerPedidos(telaLarga.current);
  }, []);
  const [carregando, setCarregando] = useState(false);

  const daAberta = useMemo(() => daSala(mensagens, sala, janelas[sala]), [mensagens, sala, janelas]);
  const linhas = useMemo(() => montarLinhas(daAberta, marca), [daAberta, marca]);
  const novasPorSala = useMemo(() => naoLidasPorSala(mensagens, lidas, meuId, agora), [mensagens, lidas, meuId, agora]);
  const esperando = useMemo(() => pedidosEsperando(mensagens), [mensagens]);
  const esperandoAqui = useMemo(() => esperando.filter((m) => m.sala === sala), [esperando, sala]);
  const pessoas = useMemo(() => pessoasComPresenca(abertura.pessoas, ligacao.presenca), [abertura.pessoas, ligacao.presenca]);
  const pendentesDaSala = useMemo(() => pendentes.filter((p) => p.sala === sala), [pendentes, sala]);
  const ultimoId = daAberta[daAberta.length - 1]?.id ?? 0;

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
        // O que a pessoa leu em outra aba ou no celular vale aqui também.
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

  // O clique num aviso do sistema, com esta tela aberta, pede para ir até a mensagem.
  const abrirDoAviso = useRef<(sala: Sala, mensagem: number) => void>(() => undefined);
  useEffect(
    () =>
      aoAvisar((a) => {
        if (a.tipo === "lida") return;
        if (a.tipo === "abrir") {
          const s = lerSala(a.sala);
          if (s) abrirDoAviso.current(s, a.mensagem);
        }
        agendar();
      }),
    [agendar],
  );

  const [visivel, setVisivel] = useState(true);
  const aoVivo = ligacao.estado === "ao_vivo";
  useEffect(() => {
    const olhar = () => {
      const v = document.visibilityState === "visible";
      setVisivel(v);
      if (v) agendar();
    };
    olhar();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") agendar();
    }, aoVivo ? 60_000 : 12_000);
    document.addEventListener("visibilitychange", olhar);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", olhar);
    };
  }, [agendar, aoVivo]);

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
  // O link assinado vale uma hora. A cada 45 minutos a tela pede todos de novo, sem tirar a imagem da tela.
  useEffect(() => {
    const id = setInterval(() => {
      pedidas.current = new Set();
      setRenovar((n) => n + 1);
    }, 45 * 60_000);
    return () => clearInterval(id);
  }, []);
  const linkDe = useCallback((anexo: string) => links[anexo], [links]);

  // --------------------------------------------------------------- a rolagem

  const lista = useRef<HTMLDivElement>(null);
  const noFimAgora = useRef(true);
  const [noFim, setNoFim] = useState(true);
  const aoRolar = useCallback(() => {
    const el = lista.current;
    if (!el) return;
    const fim = el.scrollHeight - el.scrollTop - el.clientHeight < 72;
    noFimAgora.current = fim;
    setNoFim(fim);
  }, []);
  const irParaOFim = useCallback(() => {
    const el = lista.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    noFimAgora.current = true;
    setNoFim(true);
  }, []);

  // Ao entrar numa sala: para na linha "Novas mensagens", ou no fim quando está tudo lido.
  useLayoutEffect(() => {
    const el = lista.current;
    if (!el) return;
    const novas = el.querySelector<HTMLElement>("[data-novas]");
    if (novas) el.scrollTop = Math.max(0, novas.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 28);
    else el.scrollTop = el.scrollHeight;
    aoRolar();
    // Só a troca de sala dispara: mensagem que chega é tratada logo abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sala, guardando]);

  // Mensagem nova: acompanha quem está no fim, e sempre que a mensagem é da própria pessoa.
  const antes = useRef({ sala, ultimoId, indo: pendentesDaSala.length });
  useLayoutEffect(() => {
    const a = antes.current;
    antes.current = { sala, ultimoId, indo: pendentesDaSala.length };
    if (a.sala !== sala) return;
    if (ultimoId === a.ultimoId && pendentesDaSala.length === a.indo) return;
    const minha = daAberta[daAberta.length - 1]?.autor === meuId && ultimoId > a.ultimoId;
    if (noFimAgora.current || minha || pendentesDaSala.length > a.indo) irParaOFim();
  }, [sala, ultimoId, pendentesDaSala.length, daAberta, meuId, irParaOFim]);

  // No celular as salas rolam de lado: a sala aberta precisa estar à vista, e não escondida atrás da borda.
  const filaDeSalas = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const fila = filaDeSalas.current;
    const ficha = fila?.querySelector<HTMLElement>(`[data-sala="${sala}"]`);
    if (!fila || !ficha) return;
    // Conta feita à mão, e não `scrollIntoView`: aquele rola a página inteira junto.
    const sobra = fila.clientWidth - ficha.offsetWidth;
    fila.scrollLeft = Math.max(0, ficha.offsetLeft - fila.offsetLeft - sobra / 2);
  }, [sala]);

  // "Carregar anteriores" põe mensagem em cima: a conversa não pode pular debaixo do olho.
  const ancora = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = lista.current;
    if (el && ancora.current !== null) el.scrollTop = el.scrollHeight - ancora.current;
    ancora.current = null;
  }, [janelas]);

  const irPara = useCallback((id: number) => {
    const el = lista.current?.querySelector<HTMLElement>(`[data-fala="${id}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "center" });
    setDestaque(id);
    setTimeout(() => setDestaque((d) => (d === id ? null : d)), 1800);
  }, []);
  useEffect(() => {
    if (destaqueInicial) irPara(destaqueInicial);
    // Só na chegada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A mensagem para onde ir depois de trocar de sala. Ela pode ainda estar chegando: a tela tenta de novo a cada mudança da conversa, por alguns segundos.
  const [pular, setPular] = useState<{ id: number; ate: number } | null>(null);
  useEffect(() => {
    if (!pular) return;
    if (lista.current?.querySelector(`[data-fala="${pular.id}"]`)) {
      irPara(pular.id);
      setPular(null);
    } else if (Date.now() > pular.ate) {
      setPular(null);
    }
  }, [pular, daAberta, irPara]);

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
  useEffect(() => {
    if (!visivel || !noFim || guardando || ultimoId <= (lidas[sala] ?? 0)) return;
    setLidas((l) => ({ ...l, [sala]: Math.max(l[sala] ?? 0, ultimoId) }));
    gravarLeitura(sala, ultimoId);
  }, [visivel, noFim, guardando, ultimoId, sala, lidas, gravarLeitura]);

  // --------------------------------------------------------- o que a pessoa faz

  // O que o tutor deixou escrito para perguntar ao time. Vem pelo navegador, e não pelo endereço.
  useEffect(() => {
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
  }, []);

  const trocarDeSala = (s: Sala) => {
    if (s === sala) return;
    setMarca(primeiraNaoLida(daSala(mensagens, s, janelas[s]), lidas[s] ?? 0, meuId, agora));
    setSala(s);
    setRespondendo(null);
    setAberta(null);
    setApagando(null);
    setAviso(null);
    setVerPedidos(telaLarga.current);
    setGuardando(null);
  };

  abrirDoAviso.current = (s, mensagem) => {
    trocarDeSala(s);
    setVerPessoas(false);
    setPular({ id: mensagem, ate: Date.now() + 8000 });
  };

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
      const r = await api.enviar({ sala: p.sala, texto: p.texto, respondeA: p.respondeA?.id ?? null, pede: p.pede, imagens: enviadas });
      if (!r.ok) return falhar(r.erro);
      p.imagens.forEach((i) => URL.revokeObjectURL(i.previa));
      setPendentes((l) => l.filter((x) => x.chave !== p.chave));
      receber([r.mensagem]);
      setLidas((l) => ({ ...l, [p.sala]: Math.max(l[p.sala] ?? 0, r.mensagem.id) }));
      api.avisar(p.sala);
      // A mensagem respondida mudou (ganhou uma resposta, e o pedido pode ter sido atendido).
      if (p.respondeA) agendar();
    },
    [api, meuId, receber, agendar],
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

  const carregarAnteriores = async () => {
    const s = sala;
    const janela = janelas[s];
    if (janela === undefined || carregando) return;
    setCarregando(true);
    const r = await api.anteriores(s, janela);
    setCarregando(false);
    if (!r) return setAviso("Não deu para buscar as mensagens anteriores. Tente de novo.");
    const el = lista.current;
    ancora.current = el && s === sala ? el.scrollHeight - el.scrollTop : null;
    receber(r.mensagens);
    setJanelas((j) => {
      const n = { ...j };
      const primeira = r.mensagens[0]?.id;
      if (r.temMais && primeira) n[s] = primeira;
      else delete n[s];
      return n;
    });
  };

  // ------------------------------------------------------------------ o desenho

  const nomeDaSala = NOME_DA_SALA[sala];
  const apoioDaSala = SALAS.find((s) => s.chave === sala)?.resolve ?? "";
  const esperandoPorSala = useMemo(() => {
    const n = Object.fromEntries(SALAS.map((s) => [s.chave, 0])) as Record<Sala, number>;
    for (const m of esperando) n[m.sala] += 1;
    return n;
  }, [esperando]);
  const piorEspera = esperandoAqui.map((m) => esperaDoPedido(m, agora)).find(Boolean) ?? null;

  const estadoDaLigacao =
    ligacao.estado === "ao_vivo" ? (
      <span className="inline-flex items-center gap-1 text-[0.7rem] font-semibold" style={{ color: COR_DO_TOM.bom.texto }}>
        <Radio size={12} aria-hidden="true" /> Ao vivo
      </span>
    ) : ligacao.estado === "fora" ? (
      <span
        className="inline-flex items-center gap-1 text-[0.7rem] font-semibold"
        style={{ color: COR_DO_TOM.atencao.texto }}
        title="A ligação ao vivo não entrou. As mensagens chegam de tempos em tempos."
      >
        <WifiOff size={12} aria-hidden="true" /> Sem ligação ao vivo
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-[0.7rem] text-muted">
        <Loader2 size={12} className="animate-spin" aria-hidden="true" /> Ligando
      </span>
    );

  const emblemaDaSala = (s: Sala) => (
    <>
      {esperandoPorSala[s] > 0 ? (
        <span
          className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[0.62rem] font-bold leading-none"
          style={{ background: COR_DO_TOM.atencao.fundo, color: COR_DO_TOM.atencao.texto }}
          title={esperandoPorSala[s] === 1 ? "1 pedido esperando resposta" : `${esperandoPorSala[s]} pedidos esperando resposta`}
        >
          <MessageCircleQuestion size={10} aria-hidden="true" />
          {esperandoPorSala[s]}
          <span className="sr-only"> esperando resposta</span>
        </span>
      ) : null}
      {novasPorSala[s] > 0 && s !== sala ? (
        <span className="shrink-0 rounded-full bg-wine px-1.5 py-0.5 text-[0.62rem] font-bold leading-none text-white">
          {novasPorSala[s] > 99 ? "99+" : novasPorSala[s]}
          <span className="sr-only"> não lidas</span>
        </span>
      ) : null}
    </>
  );

  return (
    <div className="painel-chat flex gap-4">
      <h1 className="sr-only">Chat do time</h1>

      {/* Computador: as salas e quem está online, sempre à vista. */}
      <aside className="hidden w-60 shrink-0 flex-col gap-3 overflow-y-auto lg:flex" aria-label="Salas e pessoas">
        <nav className="glass rounded-[18px] p-2" aria-label="Salas">
          <ul>
            {SALAS.map((s) => (
              <li key={s.chave}>
                <button
                  type="button"
                  aria-current={s.chave === sala ? "true" : undefined}
                  onClick={() => trocarDeSala(s.chave)}
                  className={`painel-toque flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-left ${s.chave === sala ? "painel-item-ativo" : "hover:bg-ink/[0.04]"}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm leading-tight ${s.chave === sala ? "font-bold" : "font-semibold text-ink"}`}>{s.nome}</span>
                    <span className={`block truncate text-[0.68rem] leading-tight ${s.chave === sala ? "opacity-80" : "text-muted"}`}>{s.resolve}</span>
                  </span>
                  {emblemaDaSala(s.chave)}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <section className="glass min-h-0 flex-1 overflow-y-auto rounded-[18px] p-3.5" aria-label="Quem está online">
          <ListaDePessoas pessoas={pessoas} meuId={meuId} estado={ligacao.estado} />
          <div className="mt-4">
            <AvisoDoSistema estadoDaPrevia={avisoDaPrevia} />
          </div>
        </section>
      </aside>

      <section className="glass relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-[18px]" aria-label={`Sala ${nomeDaSala}`}>
        <header className="border-b border-ink/[0.07]">
          {/* Celular: uma linha só, com as salas numa fila que rola de lado e, presa à direita, quem está online. */}
          <div className="flex items-center gap-1.5 pr-2.5 lg:hidden">
            {/* `relative` de propósito: o texto só para leitor de tela é `absolute`, e sem um pai posicionado ele escapava do corte da fila e deixava o cartão inteiro rolar de lado. */}
            <div ref={filaDeSalas} role="group" aria-label="Salas" className="painel-fila relative flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-2.5 pl-2.5 pr-1">
              {SALAS.map((s) => (
                <button
                  key={s.chave}
                  type="button"
                  data-sala={s.chave}
                  aria-pressed={s.chave === sala}
                  onClick={() => trocarDeSala(s.chave)}
                  className={`painel-toque inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[0.82rem] font-semibold ${
                    s.chave === sala ? "painel-aba-ativa" : "border border-ink/10 bg-white text-ink/75"
                  }`}
                >
                  {s.nome}
                  {emblemaDaSala(s.chave)}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setVerPessoas((v) => !v)}
              aria-expanded={verPessoas}
              aria-controls="chat-pessoas"
              className="painel-toque inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-ink/10 bg-white px-3 text-xs font-semibold text-ink"
            >
              {ligacao.estado === "ao_vivo" ? <Ponto presenca="online" /> : ligacao.estado === "fora" ? <WifiOff size={13} aria-hidden="true" /> : <Users size={13} aria-hidden="true" />}
              {resumoDaPresenca(pessoas, ligacao.estado)}
            </button>
          </div>
          {/* Computador: o nome da sala, o que ela resolve e o estado da ligação. */}
          <div className="hidden items-center gap-3 px-5 py-3 lg:flex">
            <div className="min-w-0 flex-1">
              <p className="font-display text-xl leading-tight text-ink">{nomeDaSala}</p>
              <p className="truncate text-xs leading-snug text-muted">{apoioDaSala}. Sala aberta: todo o time lê.</p>
            </div>
            <span className="shrink-0">{estadoDaLigacao}</span>
          </div>
        </header>

        {/* Celular: quem está online abre por cima da conversa. */}
        {verPessoas ? (
          <div id="chat-pessoas" className="absolute inset-x-0 bottom-0 top-0 z-20 flex flex-col bg-white lg:hidden">
            <div className="flex items-center justify-between gap-3 border-b border-ink/[0.07] px-4 py-3">
              <p className="text-sm font-bold text-ink">Quem está online</p>
              <button type="button" onClick={() => setVerPessoas(false)} className={botaoClaro}>
                <X size={14} aria-hidden="true" /> Fechar
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <ListaDePessoas pessoas={pessoas} meuId={meuId} estado={ligacao.estado} />
              <p className="mt-3 text-[0.7rem] leading-relaxed text-muted">Online é estar com o painel aberto e à vista, em qualquer tela dele.</p>
              <div className="mt-4">
                <AvisoDoSistema estadoDaPrevia={avisoDaPrevia} />
              </div>
            </div>
          </div>
        ) : null}

        {guardando ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            <button type="button" onClick={() => setGuardando(null)} className={botaoClaro}>
              <ArrowLeft size={14} aria-hidden="true" /> Voltar à conversa
            </button>
            <p className="mt-4 text-sm font-semibold text-ink">Guardar na biblioteca</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              A próxima pessoa encontra na busca e ninguém precisa responder outra vez. Entra como &quot;a confirmar&quot;.
            </p>
            <div className="mt-3">
              <FormularioDeResposta
                comOrigem={false}
                inicial={rascunhoDaResposta(guardando, mensagens)}
                rotuloDoBotao="Salvar na biblioteca"
                aviso={
                  <p className="flex items-start gap-1.5 rounded-[10px] p-2.5 text-xs font-semibold leading-relaxed" style={{ background: COR_DO_TOM.atencao.fundo, color: COR_DO_TOM.atencao.texto }}>
                    <TriangleAlert size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <span>
                      Tire nome, telefone e qualquer dado de cliente, e escreva a pergunta do jeito que serve para o próximo caso. A origem (esta conversa) é
                      escrita sozinha.
                    </span>
                  </p>
                }
                onSalvar={async (r) => {
                  const feito = await api.guardarNaBiblioteca(guardando.id, r);
                  if (!feito.ok) return feito;
                  setGuardando(null);
                  agendar();
                  api.avisar(guardando.sala);
                  return { ok: true };
                }}
                onCancelar={() => setGuardando(null)}
              />
            </div>
          </div>
        ) : (
          <>
            {esperandoAqui.length > 0 ? (
              <div className="border-b border-ink/[0.07]" style={{ background: COR_DO_TOM.atencao.fundo }}>
                <button
                  type="button"
                  onClick={() => setVerPedidos((v) => !v)}
                  aria-expanded={verPedidos}
                  aria-controls="chat-pedidos"
                  className="painel-toque flex w-full items-center gap-2 px-3.5 py-2 text-left sm:px-5"
                  style={{ color: COR_DO_TOM.atencao.texto }}
                >
                  <MessageCircleQuestion size={15} className="shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 text-xs font-bold">
                    {esperandoAqui.length === 1 ? "1 pedido esperando resposta nesta sala" : `${esperandoAqui.length} pedidos esperando resposta nesta sala`}
                  </span>
                  {!verPedidos && piorEspera ? <SeloDeTom tom={piorEspera.tom}>{piorEspera.palavra}</SeloDeTom> : null}
                  {verPedidos ? <ChevronUp size={15} className="shrink-0" aria-hidden="true" /> : <ChevronDown size={15} className="shrink-0" aria-hidden="true" />}
                </button>
                {verPedidos ? (
                  <div id="chat-pedidos" className="max-h-44 overflow-y-auto px-2.5 pb-2.5 sm:px-4">
                    <ul className="space-y-1.5">
                      {esperandoAqui.map((m) => {
                        const e = esperaDoPedido(m, agora);
                        return (
                          <li key={m.id} className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-[12px] bg-white px-3 py-2">
                            <p className="min-w-0 flex-1 basis-40 text-xs leading-snug text-ink">
                              <span className="font-bold">{m.autor === meuId ? "Você" : (m.autorNome ?? "Alguém do time")}:</span> {trechoDe(m, 120)}
                            </p>
                            {e ? <SeloDeTom tom={e.tom}>{e.palavra}</SeloDeTom> : null}
                            <span className="flex shrink-0 gap-1.5">
                              <button type="button" onClick={() => responderA(m)} className="painel-toque inline-flex h-8 items-center gap-1 rounded-full border border-ink/12 bg-white px-2.5 text-[0.72rem] font-semibold text-ink">
                                <CornerUpLeft size={12} aria-hidden="true" /> Responder
                              </button>
                              <button
                                type="button"
                                disabled={ocupada === m.id}
                                onClick={() => void aoAgir(m, "resolver")}
                                className="painel-toque inline-flex h-8 items-center gap-1 rounded-full border border-ink/12 bg-white px-2.5 text-[0.72rem] font-semibold text-ink disabled:opacity-60"
                              >
                                {ocupada === m.id ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Check size={12} aria-hidden="true" />} Resolvido
                              </button>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="mt-1.5 px-1 text-[0.66rem] leading-snug" style={{ color: COR_DO_TOM.atencao.texto }}>
                      {limitesPorExtenso()}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="relative min-h-0 flex-1">
              <div ref={lista} onScroll={aoRolar} className="absolute inset-0 overflow-y-auto overscroll-contain px-2.5 pb-3 pt-2 sm:px-5">
                {janelas[sala] !== undefined ? (
                  <p className="flex justify-center pb-1 pt-1">
                    <button type="button" disabled={carregando} onClick={() => void carregarAnteriores()} className={botaoClaro}>
                      {carregando ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <ChevronUp size={14} aria-hidden="true" />}
                      {carregando ? "Buscando" : "Carregar anteriores"}
                    </button>
                  </p>
                ) : null}

                {linhas.length === 0 && pendentesDaSala.length === 0 ? (
                  <div className="grid h-full place-items-center px-4 text-center">
                    <div>
                      <p className="font-display text-xl text-ink">Ninguém escreveu em {nomeDaSala} ainda</p>
                      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
                        {apoioDaSala}. Escreva embaixo: todo o time lê, e quem estiver online recebe na hora. Se precisar de resposta, ligue &quot;Pedir
                        resposta&quot; e a mensagem fica à vista até alguém responder.
                      </p>
                    </div>
                  </div>
                ) : (
                  <Conversa
                    linhas={linhas}
                    pendentes={pendentesDaSala}
                    meuId={meuId}
                    souAdmin={souAdmin}
                    agora={agora}
                    linkDe={linkDe}
                    aberta={aberta}
                    ocupada={ocupada}
                    destaque={destaque}
                    apagando={apagando}
                    onAlternar={(id) => {
                      setApagando(null);
                      setAberta((a) => (a === id ? null : id));
                    }}
                    onAcao={(m, qual) => void aoAgir(m, qual)}
                    onIrPara={irPara}
                    onDeNovo={(p) => void despachar(p)}
                    onDescartar={descartar}
                  />
                )}
              </div>

              {noFim ? null : (
                <button
                  type="button"
                  onClick={irParaOFim}
                  className="painel-toque absolute bottom-3 right-3 z-10 inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-3.5 text-xs font-semibold text-white shadow-lg"
                >
                  <ArrowDown size={14} aria-hidden="true" />
                  {novasPorSala[sala] > 0 ? (novasPorSala[sala] === 1 ? "1 nova" : `${novasPorSala[sala]} novas`) : "Ir para o fim"}
                </button>
              )}
            </div>

            {aviso || semRede ? (
              <p role="alert" className="flex items-start gap-1.5 border-t border-ink/[0.07] px-3.5 py-2 text-xs font-semibold sm:px-5" style={{ background: COR_DO_TOM.ruim.fundo, color: COR_DO_TOM.ruim.texto }}>
                <TriangleAlert size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">{aviso ?? "Sem resposta do servidor. A conversa pode estar atrasada; a tela tenta de novo sozinha."}</span>
                {aviso ? (
                  <button type="button" onClick={() => setAviso(null)} aria-label="Fechar o aviso" className="shrink-0">
                    <X size={13} aria-hidden="true" />
                  </button>
                ) : null}
              </p>
            ) : null}

            <Escrever
              texto={texto}
              onTexto={setTexto}
              onEnviar={enviar}
              respondendo={respondendo}
              onCancelarResposta={() => setRespondendo(null)}
              pedir={pedir}
              onPedir={setPedir}
              imagens={imagens}
              sala={nomeDaSala}
              focar={focar}
            />
          </>
        )}
      </section>
    </div>
  );
}
