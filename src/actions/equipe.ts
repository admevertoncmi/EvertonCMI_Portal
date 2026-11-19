'use server'

import { requireAdmin, requireEquipe } from '@/lib/auth-guard'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Em produção o Next esconde a mensagem de erros lançados por server actions; por isso estas
// ações DEVOLVEM { success: false, error } para o aviso certo chegar na tela.
type Resultado = { success: true; aviso?: string } | { success: false; error: string }

// Grava a foto de perfil (coluna foto_url). Devolve a mensagem de erro, ou null se deu certo.
async function salvarFotoMembro(userId: string, formData: FormData, ignorarVazia: boolean): Promise<string | null> {
  if (!formData.has('foto_url')) return null
  const foto = String(formData.get('foto_url') || '').trim() || null
  if (!foto && ignorarVazia) return null
  const { error } = await supabaseAdmin.from('perfis_equipe').update({ foto_url: foto }).eq('id', userId)
  if (!error) return null
  const faltaColuna = /foto_url/i.test(error.message)
  // Sem a coluna e sem foto para gravar, não há nada a fazer
  if (faltaColuna && !foto) return null
  return faltaColuna
    ? 'A foto não foi salva: falta rodar a atualização do banco (coluna foto_url em perfis_equipe).'
    : `A foto não foi salva: ${error.message}`
}

// WhatsApp para avisos (coluna nova: supabase-notificacoes.sql). Devolve a mensagem de erro, ou null.
async function salvarWhatsappMembro(userId: string, formData: FormData): Promise<string | null> {
  if (!formData.has('whatsapp')) return null
  const bruto = String(formData.get('whatsapp') || '').trim()
  // número: só dígitos (com DDD; o DDI 55 entra sozinho no envio); ID de grupo da Z-API fica como está
  const whatsapp = !bruto ? null : (bruto.includes('@') || /-group$/.test(bruto)) ? bruto : bruto.replace(/\D/g, '')
  if (whatsapp && !bruto.includes('@') && !/-group$/.test(bruto) && (whatsapp.length < 10 || whatsapp.length > 13)) return 'WhatsApp inválido: use DDD + número (ex.: 98 99999-9999).'
  const { error } = await supabaseAdmin.from('perfis_equipe').update({ whatsapp }).eq('id', userId)
  if (!error) return null
  if (/whatsapp/i.test(error.message)) return whatsapp ? 'O WhatsApp não foi salvo: falta rodar a atualização do banco (supabase-notificacoes.sql).' : null
  return `O WhatsApp não foi salvo: ${error.message}`
}

export async function criarMembroEquipe(formData: FormData): Promise<Resultado> {
  await requireAdmin()
  const nome = formData.get("nome") as string
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const role = formData.get("role") as string
  const telegram_thread_id = formData.get("telegram_thread_id") as string

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role, nome },
    // app_metadata só pode ser escrito com a service role: é dele que o trigger lê o role
    app_metadata: { role }
  })

  if (error) return { success: false, error: `Não foi possível criar o membro: ${error.message}` }

  if (telegram_thread_id || nome) {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const updatePayload: any = {};
    if (telegram_thread_id) updatePayload.telegram_thread_id = telegram_thread_id;
    if (nome) updatePayload.nome = nome;

    await supabaseAdmin
      .from('perfis_equipe')
      .update(updatePayload)
      .eq('id', data.user.id);
  }

  // O membro já foi criado: se só a foto falhar, avisa sem dar erro
  const erroFoto = await salvarFotoMembro(data.user.id, formData, true)
  const erroWpp = await salvarWhatsappMembro(data.user.id, formData)
  const avisos = [erroFoto, erroWpp].filter(Boolean).join(' ')
  return avisos ? { success: true, aviso: `Membro criado. ${avisos}` } : { success: true }
}

// 👇 NOVA FUNÇÃO PARA EDITAR UM MEMBRO EXISTENTE 👇
export async function atualizarMembroEquipe(userId: string, formData: FormData): Promise<Resultado> {
  await requireAdmin()
  const nome = formData.get("nome") as string
  const role = formData.get("role") as string
  const telegram_thread_id = formData.get("telegram_thread_id") as string
  const password = formData.get("password") as string

  const updateData: any = {
    user_metadata: { role, nome }
  }

  // Só atualiza a senha se você digitar algo no campo
  if (password && password.trim() !== '') {
    updateData.password = password
  }

  // 1. Atualiza no sistema de autenticação
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, updateData)
  if (error) return { success: false, error: `Não foi possível salvar o acesso do membro: ${error.message}` }

  // 2. Atualiza na tabela visual do painel
  const { error: erroPerfil } = await supabaseAdmin
    .from('perfis_equipe')
    .update({ nome, role, telegram_thread_id })
    .eq('id', userId);
  if (erroPerfil) return { success: false, error: `Erro ao salvar os dados do membro: ${erroPerfil.message}` }

  const erroFoto = await salvarFotoMembro(userId, formData, false)
  if (erroFoto) return { success: false, error: erroFoto }

  const erroWpp = await salvarWhatsappMembro(userId, formData)
  if (erroWpp) return { success: false, error: erroWpp }

  return { success: true }
}

/**
 * O próprio membro troca a foto de perfil pelo painel dele (o admin também pode, no modo "Entrar").
 * Só aceita a URL pública de um avatar enviado para o bucket roteiros-midia.
 */
export async function salvarMinhaFoto(fotoUrl: string | null, membroId?: string | null): Promise<Resultado> {
  try {
    const { user, perfil } = await requireEquipe()
    const alvo = membroId && membroId !== user.id ? membroId : user.id
    if (alvo !== user.id && perfil.role !== 'admin') return { success: false, error: 'Você só pode trocar a sua própria foto.' }

    const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/roteiros-midia/avatar-`
    const foto = fotoUrl ? String(fotoUrl).trim() : null
    if (foto && (!foto.startsWith(base) || foto.length > 500)) return { success: false, error: 'Foto inválida. Envie a imagem de novo.' }

    const { error } = await supabaseAdmin.from('perfis_equipe').update({ foto_url: foto }).eq('id', alvo)
    if (error) {
      return { success: false, error: /foto_url/i.test(error.message)
        ? 'A foto não foi salva: falta rodar a atualização do banco (coluna foto_url em perfis_equipe).'
        : `A foto não foi salva: ${error.message}` }
    }
    return { success: true }
  } catch {
    return { success: false, error: 'Sua sessão expirou. Entre de novo para trocar a foto.' }
  }
}

export async function atualizarRoleMembro(userId: string, newRole: string) {
  await requireAdmin()
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    user_metadata: { role: newRole }
  })
  if (error) throw error
  return { success: true }
}

export async function excluirMembro(userId: string) {
  await requireAdmin()
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (error) throw error
  return { success: true }
}