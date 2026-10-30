export async function enviarClickUpChat(mensagem: string, chatId?: string) {
  // Puxa o token de forma segura das variáveis de ambiente
  const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN;

  if (!CLICKUP_TOKEN) {
    console.error("ERRO: O token do ClickUp não está configurado no .env");
    return;
  }

  // Se não passar um ID, buscamos todos os membros com role 'admin' para notificar
  let targetChats: string[] = [];
  
  if (chatId) {
    targetChats = [chatId];
  } else {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      const { data: admins } = await supabaseAdmin
        .from('perfis_equipe')
        .select('telegram_thread_id')
        .ilike('role', 'admin');
        
      targetChats = admins?.map(a => a.telegram_thread_id).filter(id => !!id) as string[] || [];
    } catch (err) {
      console.error("Erro ao buscar admins para notificação:", err);
    }
  }

  // Se ainda não tiver nenhum chat (nem passado, nem no banco), avisamos no terminal
  if (targetChats.length === 0) {
    console.warn("⚠️ AVISO: Nenhuma notificação enviada. Motivo: Nenhum administrador encontrado com ID de chat configurado.");
    return;
  }

  // O ClickUp usa Markdown em vez de HTML. Isto converte as nossas marcações!
  const cleanMessage = mensagem
    .replace(/<b>/g, '**')
    .replace(/<\/b>/g, '**')
    .replace(/<i>/g, '_')
    .replace(/<\/i>/g, '_');

  for (const chat of targetChats) {
    try {
      const response = await fetch(`https://api.clickup.com/api/v2/view/${chat}/comment`, {
        method: 'POST',
        headers: {
          'Authorization': CLICKUP_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          comment_text: cleanMessage,
          notify_all: true
        })
      });

      if (!response.ok) {
        console.error(`Erro no ClickUp (Chat ${chat}):`, await response.text());
      }
    } catch (error) {
      console.error(`Falha ao enviar para o chat ${chat}:`, error);
    }
  }
}
