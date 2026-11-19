import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerBio } from "@/lib/bio/ler";
import { NOMES_DOS_TEMAS } from "@/lib/bio/tipos";
import { paginaDoGrupoNoDia } from "@/lib/grupo/montar";
import { normalizarGrupo } from "@/lib/grupo/tipos";
import { lerChaves } from "@/lib/leads/chaves";
import { type Destino, type Lead } from "@/lib/leads/tipos";
import { hojeEmSaoPaulo } from "@/lib/tray/preco";
import { SITE } from "@/lib/seo/site";
import { comBasePath } from "@/lib/seo/base-path";
import { FILTROS, TelaDoGrupo, type Filtro } from "./Tela";
import { ehAdmin } from "@/lib/auth/acessos";

export const metadata = { title: "Grupo de ofertas" };

/**
 * O grupo de ofertas no WhatsApp: para onde ele leva e quem deixou o contato.
 *
 * A lista responde a pergunta do gestor de tráfego, "quem teve interesse e não
 * entrou". O site enxerga até o clique no botão do grupo; a entrada de verdade
 * só aparece quando a ferramenta do grupo avisa pelo webhook de entrada.
 */

function trintaDiasAtras(): string {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
}

export default async function GrupoPage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  const perfil = await requireArea("site");
  const { filtro: bruto } = await searchParams;
  const filtro: Filtro = bruto && bruto in FILTROS ? (bruto as Filtro) : "todos";

  const supabase = await createClient();
  const desde = trintaDiasAtras();

  let consulta = supabase.from("leads").select("*").order("criado_em", { ascending: false }).limit(200);
  if (filtro === "nao-clicou") consulta = consulta.is("clicou_grupo_em", null);
  if (filtro === "clicou") consulta = consulta.not("clicou_grupo_em", "is", null);
  if (filtro === "entrou") consulta = consulta.not("entrou_grupo_em", "is", null);

  const contar = () => supabase.from("leads").select("id", { count: "exact", head: true }).gte("criado_em", desde);

  const [config, bio, { data: leads }, total, clicaram, entraram, chaves] = await Promise.all([
    supabase.from("site_settings").select("value").eq("key", "pagina:grupo").maybeSingle(),
    lerBio(),
    consulta,
    contar(),
    contar().not("clicou_grupo_em", "is", null),
    contar().not("entrou_grupo_em", "is", null),
    lerChaves(createAdminClient()),
  ]);

  const grupo = normalizarGrupo(config.data?.value);
  const hoje = paginaDoGrupoNoDia(bio, { ...grupo, tema: "campanha" }, hojeEmSaoPaulo());
  const lista = (leads ?? []) as Lead[];
  const n = (r: { count: number | null }) => r.count ?? 0;

  const configurados: Record<Destino, boolean> = {
    kommo: Boolean(chaves.kommo),
    rd: Boolean(chaves.rd_station),
    webhook: Boolean(chaves.grupo_webhook),
    meta: Boolean(chaves.meta_capi),
  };
  const entrada = chaves.grupo_entrada
    ? `${SITE.lojaUrl}${comBasePath("/api/grupo/entrou")}?segredo=${encodeURIComponent(chaves.grupo_entrada.valor)}`
    : null;

  return (
    <TelaDoGrupo
      ehAdminDaPessoa={ehAdmin(perfil.role)}
      grupo={grupo}
      temaDeHoje={NOMES_DOS_TEMAS[hoje.tema]}
      filtro={filtro}
      lista={lista}
      total={n(total)}
      clicaram={n(clicaram)}
      entraram={n(entraram)}
      configurados={configurados}
      entrada={entrada}
    />
  );
}
