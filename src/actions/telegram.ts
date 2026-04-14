'use server'

// 1. Adicionamos o threadId como parâmetro opcional
export async function notificarTelegram(mensagem: string, threadId?: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  
  // AVISO: Lembre-se de ir ao ficheiro .env.local da Vercel e mudar o valor 
  // do TELEGRAM_CHAT_ID para -1003725526566
  const chatId = process.env.TELEGRAM_CHAT_ID;

  // LOGS PARA O TERMINAL DO VS CODE
  console.log("--- DEBUG TELEGRAM ---");
  console.log("Token carregado:", token ? "SIM (v...)" : "NÃO ❌");
  console.log("Chat ID carregado:", chatId ? "SIM (" + chatId + ")" : "NÃO ❌");
  
  // Novo log para você ver no terminal se o tópico está a ser enviado corretamente
  if (threadId) console.log("Tópico Alvo (Thread ID):", threadId); 

  if (!token || !chatId) return { success: false, error: 'Configuração ausente' };

  try {
    // 2. Preparamos o corpo da mensagem
    const payload: any = {
      chat_id: chatId,
      text: mensagem,
      parse_mode: 'HTML'
    };

    // 3. A MAGIA: Se a função receber um threadId (ex: '3'), ele adiciona ao envio!
    if (threadId) {
      payload.message_thread_id = threadId;
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      console.log("ERRO API TELEGRAM:", result); // Aqui ele vai dizer se o bot foi bloqueado, etc.
      return { success: false, error: result.description };
    }

    console.log("MENSAGEM ENVIADA COM SUCESSO! ✅");
    return { success: true };
  } catch (err) {
    console.error("ERRO CRÍTICO NO FETCH:", err);
    return { success: false, error: 'Falha de rede' };
  }
}