'use server'

import { requireAdmin } from '@/lib/auth-guard'
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
  return erroFoto ? { success: true, aviso: `Membro criado. ${erroFoto}` } : { success: true }
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

  return { success: true }
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