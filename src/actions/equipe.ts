'use server'

import { requireAdmin } from '@/lib/auth-guard'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function criarMembroEquipe(formData: FormData) {
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

  if (error) throw error

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

  return { success: true, user: data.user }
}

// 👇 NOVA FUNÇÃO PARA EDITAR UM MEMBRO EXISTENTE 👇
export async function atualizarMembroEquipe(userId: string, formData: FormData) {
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
  if (error) throw error

  // 2. Atualiza na tabela visual do painel
  await supabaseAdmin
    .from('perfis_equipe')
    .update({ nome, role, telegram_thread_id })
    .eq('id', userId);

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