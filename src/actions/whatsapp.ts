"use server"

import { requireEquipe } from '@/lib/auth-guard'
import { enviarWhatsApp } from '@/lib/whatsapp'

export async function notificarWhatsApp(mensagem: string, chatId: string) {
  await requireEquipe()
  return enviarWhatsApp(mensagem, chatId)
}

/**
 * Busca a lista de grupos para ajudar o Admin a encontrar os IDs.
 * (Pode ser usado no futuro em um seletor no painel)
 */
export async function buscarGruposWhatsApp() {
  const ID_INSTANCE = process.env.ZAPI_INSTANCE_ID;
  const API_TOKEN = process.env.ZAPI_TOKEN;
  const CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;

  if (!ID_INSTANCE || !API_TOKEN) return { error: "Sem credenciais" };

  try {
    const url = `https://api.z-api.io/instances/${ID_INSTANCE}/token/${API_TOKEN}/groups`;
    
    const headers: any = {};
    if (CLIENT_TOKEN) {
      headers["Client-Token"] = CLIENT_TOKEN;
    }

    let todosGrupos: any[] = [];
    let page = 1;
    const pageSize = 100;

    // Fazendo um loop para buscar todas as páginas de grupos (limitado a 20 páginas por segurança)
    while (page <= 20) {
      const url = `https://api.z-api.io/instances/${ID_INSTANCE}/token/${API_TOKEN}/groups?page=${page}&pageSize=${pageSize}`;
      const res = await fetch(url, { headers });
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`❌ Erro Z-API (Grupos) - Pagina ${page}:`, res.status, errorText);
        if (page === 1) {
          // Só retorna erro se falhar na primeira página
          return { error: `Z-API retornou erro ${res.status}: ${errorText}` };
        } else {
          break; // Se falhou nas próximas, só para de buscar e retorna o que já tem
        }
      }
      
      const data = await res.json();
      const listaDaPagina = Array.isArray(data) ? data : (data.groups || data);
      
      if (Array.isArray(listaDaPagina) && listaDaPagina.length > 0) {
        todosGrupos = todosGrupos.concat(listaDaPagina);
        // Se a página retornou menos itens que o limite, significa que não há mais páginas
        if (listaDaPagina.length < pageSize) {
          break;
        }
      } else {
        break; // Nenhuma lista retornada, finaliza
      }
      
      page++;
    }

    return { data: todosGrupos };
  } catch (err: any) {
    return { error: err.message };
  }
}
