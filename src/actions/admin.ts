'use server'

import { createClient } from '@supabase/supabase-js'
import { notificarTelegram } from './notificacoes'
import { revalidatePath } from 'next/cache'
import type { Material, EquipeMember } from '../types/assent'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function updateMaterialStatus(materialId: string, newStatus: Material['status']) {
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
      await notificarTelegram(`✅ APROVADO PELO ADMIN\n\n${data.cliente?.nome}\n${data.titulo.toUpperCase()}`)
    }
  }

  revalidatePath('/admin/dashboard')
}

export async function bulkUpdateStatus(materialIds: string[], newStatus: Material['status']) {
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
  const { error } = await supabaseAdmin
    .from('materiais')
    .delete()
    .eq('id', materialId)

  if (error) throw new Error(`Erro ao deletar: ${error.message}`)

  revalidatePath('/admin/dashboard')
}

export async function updateMaterialLink(materialId: string, newLink: string) {
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
