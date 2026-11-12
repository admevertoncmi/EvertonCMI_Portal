'use server'

import { getAdminSupabase } from '@/lib/supabase'
import { requireEquipe } from '@/lib/auth-guard'
import { criarUploadAnexo, inserirMensagem, lerConversa, contarNaoLidas, transcreverAudio, type AnexoTipo, type NovaMensagem } from '@/lib/conversa'

// Lado da equipe da conversa do portal. Toda action exige membro da equipe logado.

async function materialComCliente(materialId: string) {
  const { data: material } = await getAdminSupabase()
    .from('materiais').select('id, cliente_id').eq('id', materialId).maybeSingle()
  if (!material?.cliente_id) throw new Error('Material não encontrado')
  return material as { id: string; cliente_id: string }
}

export async function conversaEquipe(materialId: string) {
  await requireEquipe()
  await materialComCliente(materialId)
  return lerConversa(materialId, 'equipe')
}

export async function prepararAnexoEquipe(materialId: string, tipo: AnexoTipo, ext: string) {
  await requireEquipe()
  const material = await materialComCliente(materialId)
  return criarUploadAnexo(material.cliente_id, materialId, tipo, ext)
}

export async function enviarMensagemEquipe(materialId: string, msg: NovaMensagem) {
  const { user, perfil } = await requireEquipe()
  const material = await materialComCliente(materialId)
  const { data: membro } = await getAdminSupabase().from('perfis_equipe').select('nome').eq('id', user.id).maybeSingle()
  return inserirMensagem({
    materialId, clienteId: material.cliente_id, autor: 'equipe',
    autorId: user.id, autorNome: membro?.nome || perfil.email || 'Equipe',
  }, { ...msg, ajuste: false, evento: null })
}

/** Transcreve um áudio da conversa (só quando a equipe clica em "Transcrever"). */
export async function transcreverAudioEquipe(materialId: string, mensagemId: string): Promise<{ texto?: string; erro?: string }> {
  try {
    await requireEquipe()
    await materialComCliente(materialId)
    return { texto: await transcreverAudio(materialId, mensagemId) }
  } catch (e: any) {
    return { erro: e?.message || 'Não foi possível transcrever o áudio' }
  }
}

/** Mensagens do cliente ainda não lidas pela equipe, por material. */
export async function naoLidasEquipe(materialIds?: string[]) {
  await requireEquipe()
  return contarNaoLidas({ materialIds }, 'equipe').catch(() => ({} as Record<string, number>))
}
