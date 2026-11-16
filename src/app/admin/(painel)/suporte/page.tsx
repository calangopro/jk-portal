import { requireArea } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { lerListaDoSuporte } from "@/lib/suporte/dados";
import { PainelDoSuporte } from "./Painel";

export const metadata = { title: "Suporte pós-venda" };

/**
 * Suporte pós-venda: o vendedor passa o caso do cliente (pedra, ajuste, troca,
 * garantia, atraso) para o gerente e volta a vender. Pedido do Thiago, que
 * perdia tempo perguntando ao gerente para depois responder o cliente.
 *
 * Abre para quem tem a área `lancar_venda` (quem passa caso). Quem também tem
 * a área `suporte` (gerente e diretoria) vê a fila e atende. O desenho mora em
 * `Painel.tsx`, que é a mesma peça da janela flutuante do chat.
 *
 * `?cliente=p<número>` abre o formulário com o pedido escolhido (é por onde
 * chega quem clicou em "Passar para o suporte" na ficha do cliente).
 */
export default async function SuportePage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const perfil = await requireArea("lancar_venda");
  const sp = await searchParams;
  const lista = await lerListaDoSuporte(await createClient());
  const pedido = sp.cliente && /^p[1-9][0-9]{0,14}$/.test(sp.cliente) ? sp.cliente : null;

  return (
    <div>
      <header>
        <p className="eyebrow">Vendas</p>
        <h1 className="font-display mt-2 text-3xl text-ink sm:text-4xl">Suporte pós-venda</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          {perfil.areas.includes("suporte")
            ? "O que os vendedores passaram: assuma, fale com o cliente pelo WhatsApp e feche com uma nota, que é o que o vendedor lê."
            : "Assunto de pós-venda passa para o suporte: o gerente fala com o cliente e você volta a vender. Você é avisado quando o caso fechar."}
        </p>
      </header>
      <div className="mt-6">
        <PainelDoSuporte inicial={lista} meuId={perfil.id} clienteInicial={pedido ? { ref: pedido, titulo: `Pedido ${pedido.slice(1)}` } : null} />
      </div>
    </div>
  );
}
