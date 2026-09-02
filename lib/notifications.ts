// lib/notifications.ts

export async function sendTelegramNotification(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn("Telegram no configurado. Variables de entorno faltantes.");
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error enviando notificación Telegram:", errorData);
    } else {
      console.log("Notificación enviada a Telegram");
    }
  } catch (error) {
    console.error("Error al enviar notificación Telegram:", error);
  }
}
