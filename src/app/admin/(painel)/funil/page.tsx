import { requireArea } from "@/lib/auth/session";
import { ehAdmin } from "@/lib/auth/acessos";
import { PRAZOS_DA_KOMMO, type AlertasDaKommo } from "@/lib/kommo/funil";
import { createClient } from "@/lib/supabase/server";
import { TelaDoFunil, type Filtros, type FunilUnico } from "./Tela";

export const metadata = { title: "Funil da Kommo" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALERTAS = new Set(["esperando", "sem_resposta", "sem_fase"]);

/**
 * O funil único da Kommo (cartão 46): os negócios abertos somados pela fase
 * padrão de cada etapa (`fases_da_kommo`, 0162), com filtro de loja, vendedor,
 * funil e origem, a conversão do período, os motivos de perda e os alertas de
 * quem espera vendedor ou resposta. Lido por `kommo_funil_unico` e
 * `kommo_alertas`, que conferem a área por dentro. O desenho mora em `Tela.tsx`.
 */
export default async function FunilPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const profile = await requireArea("vendas");
  const q = await searchParams;
  const dias = [7, 30, 90].includes(Number(q.dias)) ? Number(q.dias) : 30;
  const filtros: Filtros = {
    dias,
    loja: UUID.test(q.loja ?? "") ? q.loja! : "",
    pessoa: UUID.test(q.pessoa ?? "") ? q.pessoa! : "",
    funil: /^\d{1,15}$/.test(q.funil ?? "") ? q.funil! : "",
    origem: (q.origem ?? "").slice(0, 120),
    alerta: ALERTAS.has(q.alerta ?? "") ? q.alerta! : "",
  };

  const db = await createClient();
  const [funil, alertas] = await Promise.all([
    db.rpc("kommo_funil_unico", {
      p_dias: dias,
      p_loja: filtros.loja || null,
      p_pessoa: filtros.pessoa || null,
      p_funil: filtros.funil ? Number(filtros.funil) : null,
      p_origem: filtros.origem || null,
      p_alerta: filtros.alerta || null,
      p_atencao_min: PRAZOS_DA_KOMMO.atencao,
    }),
    db.rpc("kommo_alertas", { p_atencao_min: PRAZOS_DA_KOMMO.atencao, p_ruim_min: PRAZOS_DA_KOMMO.ruim }),
  ]);

  return (
    <div data-painel-largo>
      <TelaDoFunil
        dados={(funil.data ?? null) as FunilUnico | null}
        alertas={(alertas.data ?? null) as AlertasDaKommo | null}
        filtros={filtros}
        agora={Date.now()}
        diretoria={ehAdmin(profile.role)}
      />
    </div>
  );
}
