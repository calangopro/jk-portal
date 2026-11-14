/**
 * Entrada de cada tela do painel.
 *
 * `template.tsx` é remontado a cada troca de página (o `layout.tsx` não é), e
 * é isso que faz a animação tocar de novo. Ela dura 160 ms e é só opacidade: o
 * bastante para a troca parecer de aplicativo, sem segurar ninguém. O
 * esqueleto (`loading.tsx`) entra por aqui também, então a animação toca uma
 * vez, na chegada, e não de novo quando os dados aparecem.
 */
export default function EntradaDaTela({ children }: { children: React.ReactNode }) {
  return <div className="painel-entrada">{children}</div>;
}
