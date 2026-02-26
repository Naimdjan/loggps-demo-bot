const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// === ВАЖНО: вставь токен бота сюда ===
const BOT_TOKEN = "8648067650:AAGb3L7ASsAqYdIx8aHEqvyojeUm1Rn2mzE";

// Твой Telegram ID (админ, куда приходят уведомления)
const ADMIN_CHAT_ID = "7862998301";

// Публичный URL твоего Render-сервиса (нужен для webhook и редиректа)
const PUBLIC_URL = process.env.PUBLIC_URL || "https://YOUR-SERVICE.onrender.com";

// Куда вести пользователя (платформа/демо)
const PLATFORM_URL = process.env.PLATFORM_URL || "https://tracking.aset.tj/new/";

if (!BOT_TOKEN || BOT_TOKEN.includes("PASTE_YOUR_BOT_TOKEN_HERE")) {
  console.error("❌ Укажи BOT_TOKEN в server.js (PASTE_YOUR_BOT_TOKEN_HERE)");
}
if (!PUBLIC_URL || PUBLIC_URL.includes("YOUR-SERVICE.onrender.com")) {
  console.warn("⚠️ PUBLIC_URL не задан. Укажи PUBLIC_URL в Render ENV или в server.js.");
}

const TG = `https://api.telegram.org/bot${BOT_TOKEN}`;

// 1) Установка webhook (вызвать 1 раз после деплоя)
app.get("/setWebhook", async (req, res) => {
  try {
    const url = `${PUBLIC_URL}/telegram`;
    const r = await axios.post(`${TG}/setWebhook`, { url });
    res.json(r.data);
  } catch (e) {
    res.status(500).json({ ok: false, error: "setWebhook failed" });
  }
});

// 2) Редирект на платформу + уведомление админу
app.get("/go", async (req, res) => {
  const uid = req.query.uid || "unknown";
  try {
    await axios.post(`${TG}/sendMessage`, {
      chat_id: ADMIN_CHAT_ID,
      text: `🌐 Переход на платформу из бота\n👤 Telegram ID: ${uid}\n🔗 URL: ${PLATFORM_URL}`
    });
  } catch (e) {
    // ignore
  }
  return res.redirect(302, PLATFORM_URL);
});

// 3) Webhook Telegram: inline-кнопки + выдача пароля + уведомления админу
app.post("/telegram", async (req, res) => {
  res.sendStatus(200);

  // === Callback от inline-кнопок ===
  if (req.body?.callback_query) {
    const cq = req.body.callback_query;
    const chatId = cq.message?.chat?.id;
    const from = cq.from;
    const data = cq.data;

    // убираем "часики" на кнопке
    try {
      await axios.post(`${TG}/answerCallbackQuery`, { callback_query_id: cq.id });
    } catch {}

    if (!chatId) return;

    if (data === "GET_PASS") {
      // уведомление админу
      try {
        await axios.post(`${TG}/sendMessage`, {
          chat_id: ADMIN_CHAT_ID,
          text:
            `🔑 Запрос пароля (inline)\n` +
            `👤 ${from.first_name || ""} ${from.last_name || ""} (@${from.username || "no_username"})\n` +
            `🆔 Telegram ID: ${from.id}`
        });
      } catch {}

      // ответ пользователю
      try {
        await axios.post(`${TG}/sendMessage`, {
          chat_id: chatId,
          text:
            "🔐 Ваш демо-доступ:\n\n" +
            `🌐 ${PLATFORM_URL}\n` +
            "👤 Логин: demo_user\n" +
            "🔑 Пароль: demo123"
        });
      } catch {}

      return;
    }

    return;
  }

  // === Обычные сообщения ===
  const msg = req.body?.message;
  if (!msg?.chat?.id) return;

  const chatId = msg.chat.id;
  const text = (msg.text || "").trim();

  // /start или /start demo
  if (text.startsWith("/start")) {
    const isDemo = text.includes("demo");

    // уведомление админу: вход в бота
    try {
      await axios.post(`${TG}/sendMessage`, {
        chat_id: ADMIN_CHAT_ID,
        text:
          `🤖 Вход в бота\n` +
          `👤 ${msg.from?.first_name || ""} ${msg.from?.last_name || ""} (@${msg.from?.username || "no_username"})\n` +
          `🆔 Telegram ID: ${msg.from?.id}\n` +
          `📌 Source: ${isDemo ? "site_button_demo" : "start"}`
      });
    } catch {}

    const goLink = `${PUBLIC_URL}/go?uid=${encodeURIComponent(msg.from?.id || chatId)}`;

    // меню
    try {
      await axios.post(`${TG}/sendMessage`, {
        chat_id: chatId,
        text: "Выберите действие:",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔑 Получить пароль", callback_data: "GET_PASS" }],
            [{ text: "🌐 Открыть платформу", url: goLink }]
          ]
        }
      });
    } catch {}

    return;
  }

  // fallback автоответчик
  try {
    await axios.post(`${TG}/sendMessage`, {
      chat_id: chatId,
      text: "Нажмите /start, чтобы получить кнопки демо-доступа."
    });
  } catch {}
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("✅ Bot started on port", PORT));
