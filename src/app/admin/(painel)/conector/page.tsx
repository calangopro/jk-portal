import { headers } from "next/headers";
import { requireConector } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { origemDosCabecalhos } from "@/lib/conector/base";
import { AREAS, OPERACOES } from "@/lib/conector/operacoes";
import { BASE_PATH } from "@/lib/seo/base-path";
import { QuemEstaMexendo, nomesDoConector } from "./QuemEstaMexendo";
import { TelaDoConector, type Acesso, type Linha } from "./Tela";
import { ehAdmin } from "@/lib/auth/acessos";
import { limiteEmPalavras, operacaoLiberada } from "@/lib/conector/quem-usa";

export const metadata = { title: "Conector do Claude" };
export const dynamic = "force-dynamic";

/**
 * O conector do Claude (MCP): como ligar, quem está ligado e o que o Claude
 * fez. O servidor mora em `lib/conector/` e responde em /guias/api/mcp.
 *
 * Os acessos e o histórico ficam em tabelas sem policy (só a service_role
 * lê), então esta tela usa o cliente admin, depois do `requireConector`. Quem
 * não é administrador vê só os próprios acessos e o próprio histórico.
 */

export default async function ConectorPage() {
  const perfil = await requireConector();
  const limite = limiteEmPalavras(perfil.role);
  const admin = ehAdmin(perfil.role);
  const db = createAdminClient();
  const base = `${origemDosCabecalhos(await headers())}${BASE_PATH}`;
  const mcp = `${base}/api/mcp`;
  const nomes = nomesDoConector(perfil.fullName);

  let consultaAcessos = db
    .from("conector_chaves")
    .select("id, nome, prefixo, escopo, cliente, oauth_codigo, criado_em, ultimo_uso_em, profile_id, profiles:profile_id(full_name, email)")
    .is("revogada_em", null)
    .order("criado_em", { ascending: false });
  if (!admin) consultaAcessos = consultaAcessos.eq("profile_id", perfil.id);

  let consultaRegistro = db
    .from("conector_registro")
    .select("id, criado_em, ferramenta, operacao, risco, ok, erro, alvo, profiles:profile_id(full_name, email)")
    .not("operacao", "is", null)
    .order("criado_em", { ascending: false })
    .limit(80);
  if (!admin) consultaRegistro = consultaRegistro.eq("profile_id", perfil.id);

  const [{ data: acessos }, { data: registro }] = await Promise.all([consultaAcessos, consultaRegistro]);
  const lista = (acessos ?? []) as Acesso[];
  const linhas = (registro ?? []) as Linha[];

  const porArea = AREAS.map((a) => ({ ...a, ops: OPERACOES.filter((o) => o.nome.startsWith(`${a.nome}.`) && operacaoLiberada(perfil.role, o.nome)) })).filter(
    (a) => a.ops.length,
  );

  return (
    <TelaDoConector
      admin={admin}
      limite={limite}
      mcp={mcp}
      nomes={nomes}
      lista={lista}
      linhas={linhas}
      porArea={porArea}
      quemEstaMexendo={<QuemEstaMexendo quem={perfil.fullName ?? perfil.email ?? "?"} nomes={nomes} />}
    />
  );
}
