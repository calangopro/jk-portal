import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { estadoDoAplicativo, listarContas } from "./contas";
import { INFO_DA_LIGACAO, type InfoDaLigacao } from "./ligacao";
import { modulo } from "./plataformas";
import { REDES, type Recurso, type Rede } from "./redes";
import { montarResumo, type Resumo, type ResumoCru } from "./resumo";
import type { Conta } from "./tipos";

/**
 * O que as telas das redes leem. Tudo do banco: nenhuma função daqui chama a
 * API de uma rede social.
 */

/** O resumo de "Todas as redes". Com a sessão de quem abriu: sem a área, a função do banco devolve listas vazias. */
export async function lerResumoDasRedes(db: SupabaseClient, dias: number): Promise<Resumo | null> {
  const { data, error } = await db.rpc("redes_resumo", { p_dias: dias });
  if (error) {
    console.error("[redes] redes_resumo:", error.message);
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const cru = data as Partial<ResumoCru>;
  return montarResumo({
    dias: Number(cru.dias) || dias,
    hoje: String(cru.hoje ?? ""),
    contas: Array.isArray(cru.contas) ? cru.contas : [],
    publicacoes: Array.isArray(cru.publicacoes) ? cru.publicacoes : [],
  });
}

const NOME_DO_RECURSO: Record<Recurso, string> = {
  metricas: "métricas",
  publicar: "publicar",
  comentarios: "comentários",
  mensagens: "mensagens",
};

export type ContaNaTela = {
  id: string;
  nome: string;
  usuario: string | null;
  fotoUrl: string | null;
  link: string | null;
  status: Conta["status"];
  via: Conta["via"];
  expiraEm: string | null;
  ultimoErro: string | null;
  conectadaEm: string;
  lidaEm: string | null;
  /** O que a conta já faz pelo painel. */
  libera: string[];
  /** O que o painel sabe fazer nesta rede e esta ligação ainda não liberou. Ligar de novo resolve. */
  falta: string[];
};

export type LigacaoDaRede = {
  rede: Rede;
  info: InfoDaLigacao | null;
  /** O módulo existe e sabe ligar. */
  pronta: boolean;
  /** O aplicativo da rede já foi salvo (só para rede que liga pelo login). Nunca traz o segredo. */
  aplicativo: { configurado: boolean; id: string | null } | null;
  contas: ContaNaTela[];
};

function contaNaTela(c: Conta, recursos: Partial<Record<Recurso, string[]>>): ContaNaTela {
  const libera: string[] = [];
  const falta: string[] = [];
  for (const [nome, escopos] of Object.entries(recursos) as [Recurso, string[]][]) {
    // Basta UMA das permissões equivalentes (o Instagram tem o nome novo e o antigo de cada uma).
    const tem = escopos.length === 0 || escopos.some((e) => c.escopos.includes(e));
    (tem ? libera : falta).push(NOME_DO_RECURSO[nome]);
  }
  return {
    id: c.id,
    nome: c.nome || c.usuario || c.contaId,
    usuario: c.usuario,
    fotoUrl: c.fotoUrl,
    link: c.link,
    status: c.status,
    via: c.via,
    expiraEm: c.expiraEm,
    ultimoErro: c.ultimoErro,
    conectadaEm: c.conectadaEm,
    lidaEm: c.lidaEm,
    libera,
    falta,
  };
}

/**
 * O estado de cada rede para a tela de ligações. Recebe o cliente com a chave
 * de serviço (o aplicativo mora em `integration_tokens`, que não tem policy);
 * quem chama já conferiu a área. Não devolve segredo nenhum.
 */
export async function lerLigacoes(admin: SupabaseClient): Promise<LigacaoDaRede[]> {
  const contas = await listarContas(admin);
  return Promise.all(
    REDES.map(async (rede) => {
      const m = modulo(rede.id);
      const aplicativo = m?.provedorDoAplicativo ? await estadoDoAplicativo(admin, m.provedorDoAplicativo) : null;
      return {
        rede,
        info: INFO_DA_LIGACAO[rede.id] ?? null,
        pronta: Boolean(m && (m.urlConectar || m.conectarComToken)),
        aplicativo: aplicativo ? { configurado: aplicativo.configurado, id: aplicativo.id } : null,
        contas: contas.filter((c) => c.rede === rede.id).map((c) => contaNaTela(c, m?.recursos ?? {})),
      };
    }),
  );
}
