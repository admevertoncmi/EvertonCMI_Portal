import { createServerClient } from '@/lib/supabase-server'

// --- ACTIONS ORIGINAIS ---

export async function createCliente(formData: FormData) {
  const supabase = await createServerClient()
  const nome = formData.get('nome') as string
  const telefone = formData.get('telefone') as string
  const token_magico = crypto.randomUUID()

  const { error } = await supabase
    .from('clientes')
    .insert({ nome, telefone, token_magico })

  if (error) throw error
  return { success: true, token_magico }
}

export async function deleteCliente(id: string) {
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('clientes')
    .delete()
    .eq('id', id)
  
  if (error) throw error
  return { success: true }
}

export async function createMaterial(formData: FormData) {
  const supabase = await createServerClient()
  const cliente_id = formData.get('cliente_id') as string
  const titulo = formData.get('titulo') as string
  const link_drive = formData.get('link_drive') as string

  const { error } = await supabase
    .from('materiais')
    .insert({ cliente_id, titulo, link_drive, status: 'pendente' })

  if (error) throw error
  return { success: true }
}

// --- NOVAS ACTIONS: EDITOR E ADMIN ---

// 1. Ação para o EDITOR subir uma nova versão corrigida
export async function updateMaterialVersion(id: string, newLinkDrive: string) {
  const supabase = await createServerClient()
  
  const { error } = await supabase
    .from('materiais')
    .update({ 
      link_drive: newLinkDrive, 
      status: 'pendente', // Volta para a fila do cliente aprovar
      feedback: null      // Limpa o aviso de erro/feedback antigo
    })
    .eq('id', id)

  if (error) throw error
  return { success: true }
}

// 2. Ação para o ADMIN mudar o status de um único material
export async function updateMaterialStatus(id: string, novoStatus: string) {
  const supabase = await createServerClient()
  
  const { error } = await supabase
    .from('materiais')
    .update({ status: novoStatus })
    .eq('id', id)

  if (error) throw error
  return { success: true }
}

// 3. Ação para o ADMIN mudar o status de VÁRIOS materiais de uma vez (Ações em Lote)
export async function updateBulkMaterialStatus(ids: string[], novoStatus: string) {
  if (!ids || ids.length === 0) return { success: false }
  
  const supabase = await createServerClient()
  
  const { error } = await supabase
    .from('materiais')
    .update({ status: novoStatus })
    .in('id', ids) // Atualiza todos os IDs dessa lista de uma vez só

  if (error) throw error
  return { success: true }
}