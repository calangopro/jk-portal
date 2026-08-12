"use client";

import { Container } from "@/components/layout/Container";
import { ErrorState } from "@/components/ui/states";
import { Button } from "@/components/ui/Button";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main>
      <Container className="py-24">
        <ErrorState
          action={<Button onClick={reset}>Tentar novamente</Button>}
        />
        <div className="mt-6 text-center">
          <Button href="/" variant="outline">
            Voltar ao início
          </Button>
        </div>
      </Container>
    </main>
  );
}
