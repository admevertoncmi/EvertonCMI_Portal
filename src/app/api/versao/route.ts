// Versão publicada agora no servidor. Abas/apps abertos antes de uma atualização comparam com a sua
// e mostram o aviso para recarregar (ver src/components/AvisoNovaVersao.tsx).
export const dynamic = 'force-dynamic'

export function GET() {
  return Response.json({ versao: process.env.NEXT_PUBLIC_VERSAO_APP || '' }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
}
