'use server'

import { getAdminSupabase } from '@/lib/supabase'
import { requireEquipe } from '@/lib/auth-guard'

// Sino de notificações dos painéis da equipe (admin, editor, designer e decupador).

export type Notificacao = {
  id: string
  material_id: string | null
  tipo: string
  titulo: string
  texto: string | null
  lida: boolean
  created_at: string
}

/** De quem são as notificações: a própria pessoa, ou o membro que a admin está vendo no modo "Entrar". */
async function alvo(membroId?: string | null) {
  const { user, perfil } = await requireEquipe()
  if (membroId && membroId !== user.id) {
    if (perfil.role !== 'admin') throw new Error('Não autorizado')
    return { id: membroId, proprio: false }
  }
  return { id: user.id, proprio: true }
}

export async function minhasNotificacoes(membroId?: string | null): Promise<{ itens: Notificacao[]; naoLidas: number; indisponivel?: boolean }> {
  try {
    const { id } = await alvo(membroId)
    const admin = getAdminSupabase()
    const [lista, contagem] = await Promise.all([
      admin.from('notificacoes').select('id, material_id, tipo, titulo, texto, lida, created_at')
        .eq('membro_id', id).order('created_at', { ascending: false }).limit(40),
      admin.from('notificacoes').select('id', { count: 'exact', head: true }).eq('membro_id', id).eq('lida', false),
    ])
    if (lista.error) return { itens: [], naoLidas: 0, indisponivel: true } // tabela ainda não criada
    return { itens: (lista.data || []) as Notificacao[], naoLidas: contagem.count || 0 }
  } catch {
    return { itens: [], naoLidas: 0, indisponivel: true }
  }
}

/** Marca como lidas: uma lista de ids, tudo de uma tarefa, ou todas. A admin vendo o painel de outra pessoa não marca. */
export async function marcarNotificacoesLidas(filtro: { ids?: string[]; materialId?: string; todas?: boolean }, membroId?: string | null) {
  try {
    const { id, proprio } = await alvo(membroId)
    if (!proprio) return
    let q = getAdminSupabase().from('notificacoes').update({ lida: true }).eq('membro_id', id).eq('lida', false)
    if (filtro.materialId) q = q.eq('material_id', filtro.materialId)
    else if (filtro.ids?.length) q = q.in('id', filtro.ids.slice(0, 200))
    else if (!filtro.todas) return
    await q
  } catch { /* sem sessão ou tabela: ignora */ }
}
