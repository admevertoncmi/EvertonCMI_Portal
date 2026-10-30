/**
 * Envia uma mensagem via Z-API para um contato ou grupo.
 * @param mensagem O texto da mensagem
 * @param chatId O ID do chat (ex: 5511999999999 para privado ou 123456789-123456@g.us para grupo)
 */
export async function enviarWhatsApp(mensagem: string, chatId: string) {
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

    // Inteligência para auto-corrigir números brasileiros sem DDI (55)
    // Se só tiver números e o tamanho for 10 ou 11 (DDD + Número), adiciona 55.
    let finalPhone = chatId;
    if (/^\d{10,11}$/.test(finalPhone)) {
      finalPhone = `55${finalPhone}`;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        phone: finalPhone, // Na Z-API, o campo 'phone' aceita tanto números quanto IDs de grupos
        message: mensagem
      }),
      cache: 'no-store'
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("❌ Erro ao enviar mensagem via Z-API:", errorData);
      return { success: false, error: errorData };
    }

    const successData = await response.json().catch(() => ({}));
    console.log("✅ Z-API Retorno Sucesso:", successData);

    if (successData.error || successData.status === 'ERROR') {
      return { success: false, error: JSON.stringify(successData) };
    }

    return { success: true, data: successData };
  } catch (error: any) {
    console.error("❌ Falha na comunicação com a Z-API:", error);
    return { success: false, error: error.message };
  }
}
