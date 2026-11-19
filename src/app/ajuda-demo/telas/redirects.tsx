import { TelaDeRedirects } from "@/app/admin/(painel)/redirects/Tela";
import type { Demo } from "../tipos";

// Endereços e destinos inventados.
const demo: Demo = {
  caminho: "/admin/redirects",
  desenho: () => (
    <TelaDeRedirects
      quebrados={[
        { path: "/guias/pagina-antiga-exemplo", hits: 12, referrer: "https://exemplo.com.br", primeiraVez: "2026-11-10T12:00:00Z", ultimaVez: "2026-11-18T12:00:00Z", sugestao: "/guias/pagina-nova-exemplo", sugestaoTitulo: "Página nova de exemplo" },
        { path: "/guias/outro-endereco-exemplo", hits: 3, referrer: null, primeiraVez: "2026-11-15T12:00:00Z", ultimaVez: "2026-11-17T12:00:00Z", sugestao: null, sugestaoTitulo: null },
      ]}
      redirects={[
        { id: "1", origem: "/guias/endereco-velho", destino: "/guias/endereco-novo", motivo: "Motivo de exemplo: a página mudou de nome.", status: "301" },
        { id: "2", origem: "/guias/promocao-encerrada", destino: "/guias/dicas", motivo: "Desvio temporário de exemplo.", status: "302" },
        { id: "3", origem: "/guias/pagina-removida", destino: "", motivo: null, status: "410" },
      ]}
    />
  ),
};
export default demo;
