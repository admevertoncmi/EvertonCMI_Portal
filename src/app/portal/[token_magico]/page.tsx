import PortalCliente from "@/components/ClientPortal"; // Ajuste o caminho import se necessário

export default function Page({ params }: { params: Promise<{ token_magico: string }> }) {
  // Passamos o token diretamente para o novo portal inteligente, sem precisar de Wrappers!
  return <PortalCliente params={params} />;
}