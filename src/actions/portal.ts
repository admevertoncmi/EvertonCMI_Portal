'use server'

import { getAdminSupabase } from '@/lib/supabase'
import { requireClientePorToken } from '@/lib/auth-guard'
import { enviarClickUpChat } from '@/lib/clickup-chat'

// O portal do cliente não tem login: o token mágico é a credencial.
// Toda leitura/escrita do portal passa por aqui, validando o token e
// restringindo aos materiais daquele cliente. O navegador não acessa o banco.

const STATUS_PERMITIDOS_CLIENTE = ['post_aprovado', 'roteiro_aprovado', 'ajustes', 'roteiro_pendente', 'pendente']

type PatchMaterialCliente = {
  status: string
  feedback?: string | null
  video_entregue?: boolean
  design_entregue?: boolean
}

export async function carregarPortal(token: string) {
  try {
    const cliente = await requireClientePorToken(token)
    const { data: materiais } = await getAdminSupabase()
      .from('materiais')
      .select('*')
      .eq('cliente_id', cliente.id)
      .neq('status', 'concluido')
      .order('ordem', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
    return { cliente, materiais: materiais || [] }
  } catch {
    return { cliente: null, materiais: [] }
  }
}

export async function atualizarMateriaisPortal(token: string, ids: string[], patch: PatchMaterialCliente) {
  const cliente = await requireClientePorToken(token)
  if (!ids.length || !STATUS_PERMITIDOS_CLIENTE.includes(patch.status)) throw new Error('Operação inválida')

  const dados: PatchMaterialCliente = { status: patch.status }
  if ('feedback' in patch) dados.feedback = patch.feedback ?? null
  if (typeof patch.video_entregue === 'boolean') dados.video_entregue = patch.video_entregue
  if (typeof patch.design_entregue === 'boolean') dados.design_entregue = patch.design_entregue

  const { error } = await getAdminSupabase()
    .from('materiais')
    .update(dados)
    .in('id', ids)
    .eq('cliente_id', cliente.id)
  if (error) throw new Error(error.message)
}

export async function registrarLogPortal(token: string, materialId: string, evento: string) {
  const cliente = await requireClientePorToken(token)
  const admin = getAdminSupabase()
  const { data: material } = await admin.from('materiais').select('id').eq('id', materialId).eq('cliente_id', cliente.id).maybeSingle()
  if (!material) return
  await admin.from('logs_acesso').insert([{ material_id: materialId, evento: String(evento).slice(0, 300) }])
}

export async function notificarEquipePortal(token: string, mensagem: string) {
  await requireClientePorToken(token)
  return enviarClickUpChat(String(mensagem).slice(0, 4000))
}
