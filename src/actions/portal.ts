'use server'

import { getAdminSupabase } from '@/lib/supabase'
import { requireClientePorToken } from '@/lib/auth-guard'
import { enviarClickUpChat } from '@/lib/clickup-chat'
import { criarUploadAnexo, inserirMensagem, lerConversa, contarNaoLidas, type AnexoTipo, type NovaMensagem } from '@/lib/conversa'

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
    // Mensagens da equipe que o cliente ainda não leu, por material (tabela pode não existir ainda)
    const naoLidas = await contarNaoLidas({ clienteId: cliente.id }, 'cliente').catch(() => ({}))
    return { cliente, materiais: materiais || [], naoLidas: naoLidas as Record<string, number> }
  } catch {
    return { cliente: null, materiais: [], naoLidas: {} as Record<string, number> }
  }
}

/** Confere se o material é do cliente dono do token. */
async function materialDoCliente(token: string, materialId: string) {
  const cliente = await requireClientePorToken(token)
  const { data: material } = await getAdminSupabase()
    .from('materiais').select('id, titulo').eq('id', materialId).eq('cliente_id', cliente.id).maybeSingle()
  if (!material) throw new Error('Não autorizado')
  return { cliente, material }
}

// ---------- Conversa do conteúdo (texto, fotos e áudio) ----------

export async function conversaPortal(token: string, materialId: string) {
  await materialDoCliente(token, materialId)
  return lerConversa(materialId, 'cliente')
}

export async function prepararAnexoPortal(token: string, materialId: string, tipo: AnexoTipo, ext: string) {
  const { cliente } = await materialDoCliente(token, materialId)
  return criarUploadAnexo(cliente.id, materialId, tipo, ext)
}

export async function enviarMensagemPortal(token: string, materialId: string, msg: NovaMensagem, opts?: { feitoPelaAgencia?: boolean; avisarEquipe?: boolean }) {
  const { cliente, material } = await materialDoCliente(token, materialId)
  const id = await inserirMensagem({
    materialId, clienteId: cliente.id, autor: 'cliente',
    autorNome: opts?.feitoPelaAgencia ? 'Agência (pelo portal)' : cliente.nome,
    feitoPelaAgencia: !!opts?.feitoPelaAgencia,
  }, msg)

  // Mensagem comum avisa a equipe no ClickUp; pedido de ajuste e aprovação já têm aviso próprio
  if (opts?.avisarEquipe !== false && !msg.ajuste && !msg.evento) {
    const anexos = [msg.fotos?.length ? `${msg.fotos.length} foto(s)` : '', msg.audio ? 'áudio' : ''].filter(Boolean).join(' + ')
    const texto = `💬 MENSAGEM DO CLIENTE${opts?.feitoPelaAgencia ? ' (FEITO PELA AGÊNCIA)' : ''}\n\n**${cliente.nome}**\n${material.titulo}\n\n${msg.texto || ''}${anexos ? `\n📎 ${anexos} (veja na tarefa)` : ''}`
    await enviarClickUpChat(texto.slice(0, 4000)).catch(() => null)
  }
  return id
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
