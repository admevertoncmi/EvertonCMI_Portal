"use server"

/**
 * Envia uma mensagem via Green API para um contato ou grupo.
 * @param mensagem O texto da mensagem
 * @param chatId O ID do chat (ex: 5511999999999@c.us para privado ou 123456789@g.us para grupo)
 */
export async function notificarWhatsApp(mensagem: string, chatId: string) {
  const ID_INSTANCE = process.env.GREEN_API_ID_INSTANCE;
  const API_TOKEN = process.env.GREEN_API_TOKEN;

  if (!ID_INSTANCE || !API_TOKEN) {
    console.warn("⚠️ AVISO: Green API não configurada no .env. Ignorando disparo automático.");
    return;
  }

  try {
    const url = `https://api.green-api.com/waInstance${ID_INSTANCE}/sendMessage/${API_TOKEN}`;
    
    // Garante que o formato do chatId esteja correto
    const finalChatId = chatId.includes("@") ? chatId : `${chatId}@c.us`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId: finalChatId,
        message: mensagem
      }),
      cache: 'no-store'
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("❌ Erro ao enviar mensagem via Green API:", errorData);
      return { success: false, error: errorData };
    }

    return { success: true };
  } catch (error: any) {
    console.error("❌ Falha na comunicação com a Green API:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Busca a lista de grupos para ajudar o Admin a encontrar os IDs.
 * (Pode ser usado no futuro em um seletor no painel)
 */
export async function buscarGruposWhatsApp() {
  const ID_INSTANCE = process.env.GREEN_API_ID_INSTANCE;
  const API_TOKEN = process.env.GREEN_API_TOKEN;

  if (!ID_INSTANCE || !API_TOKEN) return { error: "Sem credenciais" };

  try {
    const url = `https://api.green-api.com/waInstance${ID_INSTANCE}/getContacts/${API_TOKEN}`;
    const res = await fetch(url);
    if (!res.ok) return { error: "Erro ao buscar contatos" };
    
    const data = await res.json();
    // Filtra apenas grupos
    return { data: data.filter((c: any) => c.type === 'group') };
  } catch (err: any) {
    return { error: err.message };
  }
}
