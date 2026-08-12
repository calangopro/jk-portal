import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { EmptyState } from "@/components/ui/states";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Página não encontrada",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main>
      <Container className="py-24">
        <EmptyState
          title="Página não encontrada"
          description="O endereço que você procurou não existe ou foi movido."
          action={<Button href="/">Voltar ao início</Button>}
        />
      </Container>
    </main>
  );
}
