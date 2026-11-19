import { TelaDosFatos } from "@/app/admin/(painel)/fatos/Tela";
import type { Fato } from "@/lib/content/fatos";
import type { Demo } from "../tipos";

const base = { detail: null, fileUrl: null, subject: null, attribute: null };

/** Fatos de exemplo, um em cada situação: aprovado, a validar e desatualizado. */
const fatos: Fato[] = [
  { ...base, id: "f1", claim: "Fato de exemplo: a loja de exemplo tem garantia de um ano.", module: "garantias", sourceUrl: "https://exemplo.com.br/garantia", capturedAt: "2026-11-02", responsible: "Pessoa Exemplo", status: "aprovado", usos: 4 },
  { ...base, id: "f2", claim: "Fato de exemplo: o ouro 18k tem 75% de ouro.", module: "materiais", sourceUrl: "https://exemplo.com.br/ouro", capturedAt: "2026-10-20", responsible: "Pessoa Exemplo", status: "aprovado", usos: 7 },
  { ...base, id: "f3", claim: "Fato de exemplo: a fábrica entrega em até dez dias.", module: "fabricacao", sourceUrl: null, capturedAt: null, responsible: null, status: "validar", usos: 0 },
  { ...base, id: "f4", claim: "Fato de exemplo: horário antigo de uma loja.", module: "lojas", sourceUrl: "https://exemplo.com.br/lojas", capturedAt: "2026-06-01", responsible: "Pessoa Exemplo", status: "desatualizado", usos: 2 },
];

const demo: Demo = {
  caminho: "/admin/fatos",
  desenho: () => <TelaDosFatos fatos={fatos} />,
};
export default demo;
