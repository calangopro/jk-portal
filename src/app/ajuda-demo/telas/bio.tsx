import { EditorDaBio } from "@/app/admin/(painel)/bio/EditorDaBio";
import type { Bio } from "@/lib/bio/tipos";
import type { Location } from "@/lib/content/types";
import type { Demo } from "../tipos";

// Tudo inventado: nada da bio nem das campanhas reais.
const bio: Bio = {
  versao: 2,
  cabecalho: { nome: "Loja Exemplo", frase: "Frase de exemplo da loja" },
  normal: {
    blocos: [
      {
        id: "links", tipo: "links", visivel: true, titulo: "",
        itens: [
          { id: "a", rotulo: "Link de exemplo um", detalhe: "Uma linha explicando o link", href: "https://exemplo.com.br/um", icone: "alianca", destaque: true },
          { id: "b", rotulo: "Link de exemplo dois", detalhe: "", href: "https://exemplo.com.br/dois", icone: "dicas", destaque: false },
          { id: "c", rotulo: "Link de exemplo três", detalhe: "", href: "https://exemplo.com.br/tres", icone: "link", destaque: false },
        ],
      },
      {
        id: "captura", tipo: "captura", visivel: true, rotulo: "Receber ofertas no WhatsApp", detalhe: "Ofertas de exemplo no grupo",
        eyebrow: "Grupo de exemplo", titulo: "A oferta de exemplo chega primeiro no seu WhatsApp", descricao: "Texto de exemplo para explicar o grupo.",
        aceite: "Aceito receber ofertas de exemplo pelo WhatsApp.", botaoEnviar: "Quero receber", nota: "Para sair, é só responder SAIR.",
        sucessoTitulo: "Pronto! Falta um toque.", sucessoTexto: "Entre no grupo para receber a primeira oferta.",
        grupoLink: "", grupoRotulo: "Entrar no grupo do WhatsApp", email: "opcional", momento: true,
      },
      { id: "lojas", tipo: "lojas", visivel: true, titulo: "Fale com a loja mais perto", detalhe: "Escolha a unidade e chame no WhatsApp", mensagem: "Olá! Vim pelo Instagram e queria falar com a loja {loja}." },
    ],
  },
  campanhas: [
    {
      id: "exemplo", nome: "Oferta Exemplo", tema: "esquenta", inicio: "2026-12-01", fim: "2026-12-10", ativa: true,
      blocos: [
        { id: "camp", tipo: "campanha", visivel: true, eyebrow: "Campanha de exemplo", titulo: "Oferta de exemplo por tempo limitado", texto: "Texto de exemplo da campanha.", contador: true, contadorAte: null, rotuloContador: "A oferta de exemplo acaba em", botao: { rotulo: "Ver ofertas", href: "https://exemplo.com.br/ofertas" } },
      ],
    },
  ],
};

const lojas = [
  { id: "1", slug: "exemplo-centro", name: "Loja Exemplo Centro", address: "Rua Exemplo, 100", whatsapp: "5511900000000", status: "published" },
  { id: "2", slug: "exemplo-shopping", name: "Loja Exemplo Shopping", address: "Avenida Exemplo, 200", whatsapp: "5511900000001", status: "published" },
] as unknown as Location[];

const demo: Demo = {
  caminho: "/admin/bio",
  desenho: () => (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl text-ink">Link da bio</h1>
        <p className="mt-1.5 max-w-[70ch] text-sm leading-relaxed text-muted">
          A página de jkaliancas.com.br/bio. Cada cartão é uma faixa da página, na ordem em que aparece: arraste pela alça
          para reordenar e abra para editar. A prévia ao lado muda enquanto você edita, e nada vai ao ar antes de
          Publicar. Preço e foto vêm da loja, sempre atualizados.
        </p>
      </header>
      <EditorDaBio inicial={bio} lojas={lojas} categorias={[]} hoje="2026-11-19" />
    </div>
  ),
};
export default demo;
