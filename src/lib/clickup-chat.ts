import { getAdminSupabase } from '@/lib/supabase'

// Avisos da equipe pelo chat do ClickUp. Cada membro tem o "ID do chat do ClickUp (View ID)"
// no cadastro da equipe (coluna perfis_equipe.telegram_thread_id).
//
// Canal dos avisos de admin (ex.: "Central de Avisos") quando nenhum admin tem chat próprio cadastrado.
// Vem SÓ da variável de ambiente CLICKUP_CHAT_GERAL. Sem ela, os avisos de admin não vão para canal
// nenhum do ClickUp (o sino da plataforma continua avisando). Nunca usar ID fixo aqui: o antigo
// '6-900702112393-8' hoje é o canal de Decupagem e os avisos de admin caíam lá.
const CHAT_GERAL = (process.env.CLICKUP_CHAT_GERAL || '').trim()

export async function chatsDosAdmins(): Promise<string[]> {
  try {
    const { data } = await getAdminSupabase().from('perfis_equipe').select('telegram_thread_id').ilike('role', 'admin')
    const chats: string[] = Array.from(new Set((data || []).map((a: { telegram_thread_id: string | null }) => String(a.telegram_thread_id || '').trim()).filter(Boolean)))
    return chats.length ? chats : CHAT_GERAL ? [CHAT_GERAL] : []
  } catch (err) {
    console.error('Erro ao buscar admins para notificação:', err)
    return CHAT_GERAL ? [CHAT_GERAL] : []
  }
}

export async function enviarClickUpChat(mensagem: string, chatId?: string | string[]) {
  const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN
  if (!CLICKUP_TOKEN) {
    console.error('ERRO: O token do ClickUp não está configurado no .env')
    return
  }

  // Sem chat informado = aviso para os admins
  const lista = Array.isArray(chatId) ? chatId : chatId ? [chatId] : await chatsDosAdmins()
  const targetChats = Array.from(new Set(lista.map(c => String(c || '').trim()).filter(Boolean)))
  if (targetChats.length === 0) return

  // O ClickUp usa Markdown em vez de HTML
  const cleanMessage = mensagem
    .replace(/<b>/g, '**')
    .replace(/<\/b>/g, '**')
    .replace(/<i>/g, '_')
    .replace(/<\/i>/g, '_')

  await Promise.all(targetChats.map(async chat => {
    try {
      const response = await fetch(`https://api.clickup.com/api/v2/view/${chat}/comment`, {
        method: 'POST',
        headers: { Authorization: CLICKUP_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_text: cleanMessage, notify_all: true }),
      })
      if (!response.ok) console.error(`Erro no ClickUp (Chat ${chat}):`, await response.text())
    } catch (error) {
      console.error(`Falha ao enviar para o chat ${chat}:`, error)
    }
  }))
}
