// Regras de status dos materiais usadas em mais de uma tela (sem dependências: roda no navegador e no servidor).

/**
 * Material aprovado que está pronto para postar (página "Prontos para postar").
 * - "Aprovado (post)" (post_aprovado): sempre — inclusive post entregue e aprovado por fora da plataforma, sem link.
 * - "Aprovado (vídeo)" (aprovado): com link do vídeo/capa, ou se já passou pela produção
 *   (editor, designer, pasta decupada ou parte entregue).
 * "aprovado" sem link e sem produção é roteiro aprovado do fluxo antigo: continua na fila de roteiros.
 */
export function prontoParaPostar(m: { status?: string | null; link_drive?: string | null; link_capa?: string | null; editor_id?: string | null; designer_id?: string | null; link_organizado?: string | null; video_entregue?: boolean | null; design_entregue?: boolean | null }) {
  if (m.status === 'post_aprovado') return true
  if (m.status !== 'aprovado') return false
  return !!(m.link_drive || m.link_capa || m.editor_id || m.designer_id || m.link_organizado || m.video_entregue || m.design_entregue)
}
