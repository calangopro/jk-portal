import { TelaDoMapa, type MapaDaKommo } from "@/app/admin/(painel)/kommo/Tela";
import type { Demo } from "../tipos";

/** O mapa da Kommo com usuários de exemplo: dois ligados, dois sem ligação e um desativado. */
const mapa: MapaDaKommo = {
  usuarios: [
    { id: 1, nome: "LOJA EXEMPLO CENTRO", ativo: true, administrador: false, papel: "loja", profile_id: null, location_id: "l1", negocios_abertos: 40 },
    { id: 2, nome: "Vendedor Exemplo", ativo: true, administrador: false, papel: "vendedor", profile_id: "p1", location_id: null, negocios_abertos: 20 },
    { id: 3, nome: "LOJA EXEMPLO NORTE", ativo: true, administrador: false, papel: null, profile_id: null, location_id: null, negocios_abertos: 30 },
    { id: 4, nome: "Agência Exemplo", ativo: true, administrador: true, papel: null, profile_id: null, location_id: null, negocios_abertos: 0 },
    { id: 5, nome: "Pessoa Exemplo Antiga", ativo: false, administrador: false, papel: "vendedor", profile_id: "p2", location_id: null, negocios_abertos: 0 },
  ],
  pessoas: [
    { id: "p1", nome: "Vendedor Exemplo", papel: "vendas" },
    { id: "p2", nome: "Pessoa Exemplo Antiga", papel: "vendas" },
    { id: "p3", nome: "Gerente Exemplo", papel: "gerente" },
  ],
  lojas: [
    { id: "l1", nome: "Loja Exemplo Centro" },
    { id: "l2", nome: "Loja Exemplo Norte" },
  ],
};

const demo: Demo = {
  caminho: "/admin/kommo",
  desenho: () => <TelaDoMapa mapa={mapa} aoSalvar={async () => { "use server"; return { ok: true as const }; }} />,
};
export default demo;
