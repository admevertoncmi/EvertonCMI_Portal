"use server"

export async function notificarClickUpChat(mensagem: string, chatId?: string) {
  // Puxa o token de forma segura das variáveis de ambiente
  const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN;

  if (!CLICKUP_TOKEN) {
    console.error("ERRO: O token do ClickUp não está configurado no .env");
    return;
  }

  // Se não passar um ID de um membro específico, ele envia para um Chat Geral da Agência
  const targetChat = chatId || '6-900702112393-8';

  if (!targetChat) return;

  // O ClickUp usa Markdown em vez de HTML. Isto converte as nossas marcações!
  const cleanMessage = mensagem
    .replace(/<b>/g, '**')
    .replace(/<\/b>/g, '**')
    .replace(/<i>/g, '_')
    .replace(/<\/i>/g, '_');

  try {
    const response = await fetch(`https://api.clickup.com/api/v2/view/${targetChat}/comment`, {
      method: 'POST',
      headers: {
        'Authorization': CLICKUP_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        comment_text: cleanMessage,
        notify_all: true // Faz o ClickUp enviar notificação (apitar) para quem está no chat
      })
    });

    if (!response.ok) {
      console.error("Erro no ClickUp:", await response.text());
    }
  } catch (error) {
    console.error("Falha ao enviar notificação para o ClickUp:", error);
  }
}

export async function getClickUpTaskAndSubtasks(taskId: string) {
  const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN;
  if (!CLICKUP_TOKEN) return { error: "CLICKUP_API_TOKEN não configurado" };

  try {
    const cleanId = taskId.replace('https://app.clickup.com/t/', '').trim();
    const res = await fetch(`https://api.clickup.com/api/v2/task/${cleanId}?include_subtasks=true`, { 
      headers: { Authorization: CLICKUP_TOKEN },
      cache: 'no-store'
    });
    
    if (!res.ok) return { error: "Tarefa não encontrada no ClickUp" };
    
    const data = await res.json();
    const subtarefasBasicas = data.subtasks || [];
    
    if (subtarefasBasicas.length === 0) {
      return { error: "❌ ERRO: Esta tarefa não tem Subtarefas! O sistema precisa que os roteiros sejam subtarefas." };
    }

    const subtarefasCompletas = await Promise.all(
      subtarefasBasicas.map(async (sub: any) => { 
        const subRes = await fetch(`https://api.clickup.com/api/v2/task/${sub.id}`, { 
          headers: { Authorization: CLICKUP_TOKEN },
          cache: 'no-store'
        }); 
        return await subRes.json(); 
      })
    );

    return { data: subtarefasCompletas };
  } catch (error: any) {
    console.error("Erro na comunicação com o ClickUp:", error);
    return { error: "Erro na comunicação com o ClickUp" };
  }
}

export async function getClickUpTask(taskId: string) {
  const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN;
  if (!CLICKUP_TOKEN) return { error: "CLICKUP_API_TOKEN não configurado" };

  try {
    const cleanId = taskId.replace('https://app.clickup.com/t/', '').trim();
    const res = await fetch(`https://api.clickup.com/api/v2/task/${cleanId}`, { 
      headers: { Authorization: CLICKUP_TOKEN },
      cache: 'no-store'
    });
    
    if (!res.ok) return { error: "Tarefa não encontrada" };
    
    const data = await res.json();
    return { data };
  } catch (error: any) {
    return { error: "Erro na comunicação com o ClickUp" };
  }
}