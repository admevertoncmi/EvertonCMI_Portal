'use server'

import { requireEquipe } from '@/lib/auth-guard'

import { createClient } from '@supabase/supabase-js'
import { notificarTelegram } from './notificacoes'
import { revalidatePath } from 'next/cache'
import type { Material, EquipeMember } from '../types/assent'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function updateMaterialStatus(materialId: string, newStatus: Material['status']) {
  await requireEquipe()
  const { error } = await supabaseAdmin
    .from('materiais')
    .update({ status: newStatus })
    .eq('id', materialId)

  if (error) throw new Error(`Erro ao atualizar status: ${error.message}`)

  // Optional: Notify on approval
  if (newStatus === 'aprovado') {
    // Fetch material for notification
    const { data } = await supabaseAdmin.from('materiais').select('*, cliente(nome)').eq('id', materialId).single()
    if (data) {
      await notificarTelegram(`✅ APROVADO PELO ADMIN\n\n**${data.cliente?.nome}**\n${data.titulo}`)
    }
  }

  revalidatePath('/admin/dashboard')
}

export async function bulkUpdateStatus(materialIds: string[], newStatus: Material['status']) {
  await requireEquipe()
  if (materialIds.length === 0) return

  const { error } = await supabaseAdmin
    .from('materiais')
    .update({ status: newStatus })
    .in('id', materialIds)

  if (error) throw new Error(`Erro no bulk update: ${error.message}`)

  if (newStatus === 'concluido') {
    await notificarTelegram(`📁 Arquivados ${materialIds.length} materiais em lote.`)
  }

  revalidatePath('/admin/dashboard')
}

export async function deleteMaterial(materialId: string) {
  await requireEquipe()
  const { error } = await supabaseAdmin
    .from('materiais')
    .delete()
    .eq('id', materialId)

  if (error) throw new Error(`Erro ao deletar: ${error.message}`)

  revalidatePath('/admin/dashboard')
}

export async function updateMaterialLink(materialId: string, newLink: string) {
  await requireEquipe()
  const { error } = await supabaseAdmin
    .from('materiais')
    .update({ 
      link_drive: newLink, 
      status: 'pendente' as const,
      feedback: null 
    })
    .eq('id', materialId)

  if (error) throw new Error(`Erro ao atualizar link: ${error.message}`)

  revalidatePath('/admin/dashboard')
}

export async function getEquipeMembers() {
  await requireEquipe()
  const { data, error } = await supabaseAdmin
    .from('auth.users')
    .select('id, email, user_metadata')
    .order('email')

  if (error) throw error

  return data.map((u: any) => ({
    id: u.id,
    email: u.email,
    role: (u.user_metadata?.role as 'admin' | 'editor') || 'editor'
  })) as EquipeMember[]
}

/**
 * Exclui uma tag do sistema e a tira de todas as tarefas onde estava aplicada.
 * Roda no servidor para não depender das policies da tabela de tags
 * (pelo navegador o banco pode recusar a exclusão sem devolver erro).
 */
export async function excluirTagSistema(label: string): Promise<{ label: string; materiaisAlterados: string[] }> {
  await requireEquipe()
  if (!label) throw new Error('Tag sem nome.')

  const { data: comTags, error: erroMateriais } = await supabaseAdmin.from('materiais').select('id, tags').not('tags', 'is', null)
  if (erroMateriais) throw new Error(`Erro ao buscar as tarefas: ${erroMateriais.message}`)

  const materiaisAlterados: string[] = []
  for (const row of (comTags || []) as { id: string; tags: string[] | null }[]) {
    const tags = Array.isArray(row.tags) ? row.tags : []
    if (!tags.includes(label)) continue
    const { error } = await supabaseAdmin.from('materiais').update({ tags: tags.filter(t => t !== label) }).eq('id', row.id)
    if (error) throw new Error(`Erro ao tirar a tag de uma tarefa: ${error.message}`)
    materiaisAlterados.push(row.id)
  }

  const { error: erroDelete } = await supabaseAdmin.from('tags').delete().eq('label', label)
  if (erroDelete) throw new Error(`Erro ao excluir a tag: ${erroDelete.message}`)
  const { data: restou } = await supabaseAdmin.from('tags').select('label').eq('label', label).limit(1)
  if (restou && restou.length > 0) throw new Error('O banco não confirmou a exclusão da tag.')

  return { label, materiaisAlterados }
}
