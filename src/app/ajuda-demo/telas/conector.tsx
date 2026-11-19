import { TelaDoConector, type Acesso, type Linha } from "@/app/admin/(painel)/conector/Tela";
import { AREAS, OPERACOES } from "@/lib/conector/operacoes";
import { operacaoLiberada } from "@/lib/conector/quem-usa";
import type { Demo } from "../tipos";

/**
 * O conector com acessos e registro de exemplo. Nenhuma chave de verdade (a chave nova só aparece depois de criar,
 * e a demo não cria), endereço de exemplo e a pergunta "quem está mexendo" fora, porque cita gente da equipe.
 */
const MCP = "https://painel.exemplo.com.br/guias/api/mcp";
const pessoa = { full_name: "Pessoa Exemplo", email: "pessoa@exemplo.com.br" };

const lista: Acesso[] = [
  { id: "1", nome: "Claude Code de exemplo", prefixo: "jk_exem", escopo: "completo", cliente: null, oauth_codigo: null, criado_em: "2026-11-10T15:00:00Z", ultimo_uso_em: "2026-11-18T15:00:00Z", profile_id: "p1", profiles: pessoa },
  { id: "2", nome: "Claude no celular", prefixo: "", escopo: "leitura", cliente: "app", oauth_codigo: "x", criado_em: "2026-11-12T15:00:00Z", ultimo_uso_em: null, profile_id: "p1", profiles: pessoa },
];

const linhas: Linha[] = [
  { id: 3, criado_em: "2026-11-18T15:00:00Z", ferramenta: "executar", operacao: "conteudos.criar", risco: "escrita", ok: true, erro: null, alvo: "rascunho de exemplo", profiles: pessoa },
  { id: 2, criado_em: "2026-11-18T14:00:00Z", ferramenta: "consultar", operacao: "conteudos.listar", risco: "leitura", ok: true, erro: null, alvo: null, profiles: pessoa },
  { id: 1, criado_em: "2026-11-18T13:00:00Z", ferramenta: "executar", operacao: "conteudos.editar", risco: "escrita", ok: false, erro: "O texto tem travessão.", alvo: "rascunho de exemplo", profiles: pessoa },
];

const porArea = AREAS.map((a) => ({ ...a, ops: OPERACOES.filter((o) => o.nome.startsWith(`${a.nome}.`) && operacaoLiberada("gm", o.nome)) })).filter((a) => a.ops.length);

const demo: Demo = {
  caminho: "/admin/conector",
  desenho: () => (
    <TelaDoConector
      admin
      limite={null}
      mcp={MCP}
      nomes={{ noApp: "JK Exemplo", noTerminal: "jk-exemplo" }}
      lista={lista}
      linhas={linhas}
      porArea={porArea}
      quemEstaMexendo={null}
    />
  ),
};
export default demo;
