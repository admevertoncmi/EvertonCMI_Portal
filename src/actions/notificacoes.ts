export async function notificarTelegram(mensagem: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn("Credenciais do Telegram não configuradas no .env");
    return { success: false };
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: mensagem,
        parse_mode: 'HTML' // Permite usar tags <b> para negrito, etc.
      })
    });

    if (!res.ok) throw new Error('Falha ao disparar mensagem');
    return { success: true };
  } catch (error) {
    console.error("Erro no Telegram:", error);
    return { success: false };
  }
}