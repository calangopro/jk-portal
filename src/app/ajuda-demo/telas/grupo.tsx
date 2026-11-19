import { TelaDoGrupo } from "@/app/admin/(painel)/grupo/Tela";
import type { Lead } from "@/lib/leads/tipos";
import type { Demo } from "../tipos";

// Contatos inventados: nome de exemplo, telefone e e-mail fictícios.
const base: Lead = {
  id: "x", criado_em: "2026-11-18T14:00:00Z", origem: "bio", campanha: "exemplo", posicao: null, nome: "Contato Exemplo", whatsapp: "5511900000000",
  email: null, momento: null, pagina: null, referencia: null, rede: "instagram", utm_source: null, utm_medium: null, utm_campaign: null,
  utm_content: null, utm_term: null, gclid: null, fbclid: null, fbc: null, fbp: null, ip: null, user_agent: null, aceite_texto: "", aceite_em: "2026-11-18T14:00:00Z",
  event_id: "e", clicou_grupo_em: null, entrou_grupo_em: null, envios: {}, envio_pendente: false, tentativas: 0,
};

const lista: Lead[] = [
  { ...base, id: "1", nome: "Contato Exemplo Um", email: "exemplo1@exemplo.com.br", clicou_grupo_em: "2026-11-18T14:02:00Z", entrou_grupo_em: "2026-11-18T14:03:00Z", envios: { kommo: { status: "ok" }, rd: { status: "ok" } } as Lead["envios"] },
  { ...base, id: "2", criado_em: "2026-11-18T10:30:00Z", origem: "grupo", nome: "Contato Exemplo Dois", whatsapp: "5511900000001", rede: null, utm_source: "instagram", utm_medium: "paid_social", utm_campaign: "campanha-exemplo", clicou_grupo_em: "2026-11-18T10:32:00Z", envios: { kommo: { status: "ok" }, rd: { status: "erro", erro: "Erro de exemplo" } } as Lead["envios"] },
  { ...base, id: "3", criado_em: "2026-11-17T18:00:00Z", origem: "loja", posicao: "popup-tempo", nome: "Contato Exemplo Três", whatsapp: "5511900000002", rede: null, envios: { kommo: { status: "sem_chave" }, rd: { status: "sem_chave" } } as Lead["envios"] },
];

const demo: Demo = {
  caminho: "/admin/grupo",
  desenho: () => (
    <TelaDoGrupo
      ehAdminDaPessoa
      grupo={{ versao: 1, destino: "https://chat.whatsapp.com/exemplo", tema: "campanha" }}
      temaDeHoje="Claro (off white)"
      filtro="todos"
      lista={lista}
      total={20}
      clicaram={12}
      entraram={8}
      configurados={{ kommo: true, rd: true, webhook: false, meta: false }}
      entrada="https://exemplo.com.br/guias/api/grupo/entrou?segredo=••••••••"
    />
  ),
};
export default demo;
