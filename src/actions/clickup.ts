"use server"

import { requireEquipe } from '@/lib/auth-guard'
import { enviarClickUpChat } from '@/lib/clickup-chat'

export async function notificarClickUpChat(mensagem: string, chatId?: string) {
  await requireEquipe()
  return enviarClickUpChat(mensagem, chatId)
}

export async function getClickUpTaskAndSubtasks(taskId: string) {
  await requireEquipe()
  const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN;
  if (!CLICKUP_TOKEN) return { error: "CLICKUP_API_TOKEN não configurado" };

  try {
    const cleanId = taskId.replace('https://app.clickup.com/t/', '').trim();
    const res = await fetch(`https://api.clickup.com/api/v2/task/${cleanId}?include_subtasks=true&include_markdown_description=true`, { 
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
        const subRes = await fetch(`https://api.clickup.com/api/v2/task/${sub.id}?include_markdown_description=true`, { 
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
  await requireEquipe()
  const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN;
  if (!CLICKUP_TOKEN) return { error: "CLICKUP_API_TOKEN não configurado" };

  try {
    const cleanId = taskId.replace('https://app.clickup.com/t/', '').trim();
    const res = await fetch(`https://api.clickup.com/api/v2/task/${cleanId}?include_markdown_description=true`, { 
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