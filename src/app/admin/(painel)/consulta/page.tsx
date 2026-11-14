import { ehAdmin } from "@/lib/auth/acessos";
import { requireArea } from "@/lib/auth/session";
import { lerLojasDaConsulta, lerProdutosDaConsulta, lerQuadro, lerRegrasDeEntrega } from "@/lib/consulta/dados";
import { createClient } from "@/lib/supabase/server";
import { hojeEmSaoPaulo } from "@/lib/vendas/periodo";
import { informar, salvarRegras } from "./actions";
import { TelaDaConsulta } from "./Tela";

export const metadata = { title: "Consulta" };

/**
 * A consulta do vendedor: produto, pronta entrega por loja e prazo.
 *
 * Quem tem a área `consulta` (vendas, fábrica, gerente, GM, dono e
 * administrador) vê e informa. O desenho mora em `Tela.tsx`.
 */
export default async function ConsultaPage() {
  const perfil = await requireArea("consulta");
  const db = await createClient();
  const hoje = hojeEmSaoPaulo();
  const [produtos, lojas, quadro, regras] = await Promise.all([lerProdutosDaConsulta(db, hoje), lerLojasDaConsulta(db), lerQuadro(db), lerRegrasDeEntrega()]);
  return (
    <TelaDaConsulta
      produtos={produtos}
      lojas={lojas}
      quadro={quadro}
      regras={regras}
      hoje={hoje}
      informar={informar}
      salvarRegras={ehAdmin(perfil.role) ? salvarRegras : undefined}
    />
  );
}
