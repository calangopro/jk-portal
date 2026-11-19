import { TelaDosAutores, type Linha } from "@/app/admin/(painel)/autores/Tela";
import type { Demo } from "../tipos";

/** Três pessoas de exemplo: uma completa, uma sem credencial e uma desativada. */
const linhas: Linha[] = [
  {
    id: "a1", slug: "autor-exemplo-um", name: "Autor Exemplo Um", jobTitle: "Editor de conteúdo",
    credentials: "Escreve sobre alianças há cinco anos", bio: "Texto de exemplo sobre a pessoa que assina os guias.",
    email: "autor1@exemplo.com", sameAs: [], is_active: true, conteudos: 12,
  },
  {
    id: "a2", slug: "autor-exemplo-dois", name: "Autor Exemplo Dois", jobTitle: "Redator",
    credentials: null, bio: null, email: null, sameAs: [], is_active: true, conteudos: 3,
  },
  {
    id: "a3", slug: "autor-exemplo-tres", name: "Autor Exemplo Três", jobTitle: "Revisor",
    credentials: "Ourives", bio: null, email: null, sameAs: [], is_active: false, conteudos: 5,
  },
];

const demo: Demo = {
  caminho: "/admin/autores",
  desenho: () => <TelaDosAutores linhas={linhas} />,
};
export default demo;
