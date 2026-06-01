"use server"

/**
 * Envia uma mensagem via Z-API para um contato ou grupo.
 * @param mensagem O texto da mensagem
 * @param chatId O ID do chat (ex: 5511999999999 para privado ou 123456789-123456@g.us para grupo)
 */
export async function notificarWhatsApp(mensagem: string, chatId: string) {
  const ID_INSTANCE = process.env.ZAPI_INSTANCE_ID;
  const API_TOKEN = process.env.ZAPI_TOKEN;
  const CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;

  if (!ID_INSTANCE || !API_TOKEN) {
    console.warn("⚠️ AVISO: Z-API não configurada no .env. Ignorando disparo automático.");
    return;
  }

  try {
    const url = `https://api.z-api.io/instances/${ID_INSTANCE}/token/${API_TOKEN}/send-text`;
    
    const headers: any = { "Content-Type": "application/json" };
    if (CLIENT_TOKEN) {
      headers["Client-Token"] = CLIENT_TOKEN;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        phone: chatId, // Na Z-API, o campo 'phone' aceita tanto números quanto IDs de grupos
        message: mensagem
      }),
      cache: 'no-store'
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("❌ Erro ao enviar mensagem via Z-API:", errorData);
      return { success: false, error: errorData };
    }

    return { success: true };
  } catch (error: any) {
    console.error("❌ Falha na comunicação com a Z-API:", error);
    return { success: false, error: error.message };
  }
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

    const res = await fetch(url, { headers });
    if (!res.ok) {
      const errorText = await res.text();
      console.error("❌ Erro Z-API (Grupos):", res.status, errorText);
      return { error: `Z-API retornou erro ${res.status}: ${errorText}` };
    }
    
    const data = await res.json();
    
    // A Z-API costuma retornar a lista diretamente ou dentro de alguma propriedade.
    // Mapeamos de forma segura para evitar que o array quebre se a estrutura mudar.
    const listaGrupos = Array.isArray(data) ? data : (data.groups || data);
    return { data: listaGrupos };
  } catch (err: any) {
    return { error: err.message };
  }
}
