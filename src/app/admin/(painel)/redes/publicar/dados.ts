import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { estadoDoArmazenamento } from "@/lib/redes/armazenamento";
import { listarContas } from "@/lib/redes/contas";
import { lerConteudos } from "@/lib/redes/conteudos-dados";
import { melhoresHorarios, type HorariosDaRede } from "@/lib/redes/horarios";
import { modulo } from "@/lib/redes/plataformas";
import type { ContaDoCompositor } from "./Compositor";

/**
 * O que o compositor precisa saber antes de abrir: as contas para onde dá para
 * mandar, o tamanho máximo de arquivo e os melhores horários de cada rede pelo
 * histórico. Nada de credencial.
 */
export async function lerParaCompor(admin: SupabaseClient): Promise<{ contas: ContaDoCompositor[]; limite: number; horarios: HorariosDaRede[] }> {
  const [contas, armazenamento, conteudos] = await Promise.all([listarContas(admin), estadoDoArmazenamento(admin), lerConteudos(admin, 90)]);
  return {
    limite: armazenamento.limite,
    horarios: melhoresHorarios(conteudos?.conteudos ?? []),
    contas: contas
      .filter((c) => Boolean(modulo(c.rede)?.publicar))
      .map((c) => {
        const pede = modulo(c.rede)?.recursos.publicar ?? [];
        return {
          id: c.id,
          rede: c.rede,
          nome: c.usuario || c.nome || "",
          ativa: c.status === "ativa",
          // Conta ligada antes de o painel pedir a permissão fica sem ela: ligar de novo resolve.
          podePublicar: pede.length === 0 || c.escopos.length === 0 || pede.some((e) => c.escopos.includes(e)),
        };
      }),
  };
}
