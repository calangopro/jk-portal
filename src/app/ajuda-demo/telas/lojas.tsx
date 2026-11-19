import { TelaDeLojas, type Linha } from "@/app/admin/(painel)/lojas/Tela";
import type { Demo } from "../tipos";

const base: Linha = {
  id: "l1", slug: "loja-exemplo-um", name: "Loja Exemplo Um", address: "Rua Exemplo, 100", address_locality: "Cidade Exemplo", phone: "(11) 90000-0001",
  latitude: -23.5, status: "published", updated_at: "2026-11-10T12:00:00Z",
};
const itens: Linha[] = [
  base,
  { ...base, id: "l2", slug: "loja-exemplo-dois", name: "Loja Exemplo Dois", address: "Avenida Exemplo, 200", phone: "(11) 90000-0002", status: "published" },
  { ...base, id: "l3", slug: "loja-exemplo-tres", name: "Loja Exemplo Três", address: null, address_locality: null, phone: null, latitude: null, status: "draft" },
];

const demo: Demo = {
  caminho: "/admin/lojas",
  desenho: () => <TelaDeLojas itens={itens} />,
};
export default demo;
