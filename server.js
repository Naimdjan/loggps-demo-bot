const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// === ВАЖНО: вставь токен бота сюда ===
const BOT_TOKEN = "8648067650:AAF5AkkojfiHJIn9rjFyfke96vZa0hYdcIs";

// Твой Telegram ID (админ, куда приходит ALERT только при выдаче пароля)
const ADMIN_CHAT_ID = "7862998301";

// Публичный URL твоего Render-сервиса (задай в Render ENV: PUBLIC_URL)
const PUBLIC_URL = process.env.PUBLIC_URL || "https://YOUR-SERVICE.onrender.com";

// Куда вести пользователя (платформа/демо)
const PLATFORM_URL = process.env.PLATFORM_URL || "https://tracking.aset.tj";

if (!BOT_TOKEN || BOT_TOKEN.includes("PASTE_NEW_BOT_TOKEN_HERE")) {
  console.error("❌ Укажи BOT_TOKEN в server.js (PASTE_NEW_BOT_TOKEN_HERE)");
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

// 2) Редирект на платформу + уведомление админу о переходе (оставляем как было)
app.get("/go", async (req, res) => {
  const uid = req.query.uid || "unknown";
  const target = req.query.target || "platform";
  const links = {
    platform: "https://tracking.aset.tj",
    android: "https://play.google.com/store/apps/details?id=ideabits.fmc",
    ios: "https://apps.apple.com/tj/app/fmc/id879075470",
  };
  const redirectUrl = links[target] || links.platform;

  try {
    await axios.post(`${TG}/sendMessage`, {
      chat_id: ADMIN_CHAT_ID,
      text: `🌐 Переход по ссылке из бота\n👤 Telegram ID: ${uid}\n🎯 Тип: ${target}\n🔗 URL: ${redirectUrl}`,
    });
  } catch (e) {
    // ignore
  }
  return res.redirect(302, redirectUrl);
});

// 3) Webhook Telegram: inline-кнопки + выдача пароля + ALERT админу (только при выдаче)
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
      // 1) отправляем пароль пользователю
      try {
        await axios.post(`${TG}/sendMessage`, {
          chat_id: chatId,
          text:
            "🔐 Ваш демо-доступ:\n\n" +
            `🌐 ${PLATFORM_URL}\n` +
            "👤 Логин: demo\n" +
            "🔑 Пароль: demo1234",
        });
      } catch {}

      // 2) ЕДИНСТВЕННЫЙ ALERT админу (только при выдаче пароля)
      try {
        await axios.post(`${TG}/sendMessage`, {
          chat_id: ADMIN_CHAT_ID,
          text:
            "🚨 ПАРОЛЬ ВЫДАН\n\n" +
            `👤 ${from.first_name || ""} ${from.last_name || ""} (@${from.username || "no_username"})\n` +
            `🆔 Telegram ID: ${from.id}\n` +
            `⏰ ${new Date().toLocaleString()}`,
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
    // ✅ ПРЯМЫЕ ССЫЛКИ (без /go), чтобы Telegram открывал нужные URL, а не Render
    const platformLink = "https://tracking.aset.tj";
    const androidLink = "https://play.google.com/store/apps/details?id=ideabits.fmc";
    const iosLink = "https://apps.apple.com/tj/app/fmc/id879075470";

    // меню (без уведомлений админу)
    try {
      await axios.post(`${TG}/sendMessage`, {
        chat_id: chatId,
        text: "Выберите действие:",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔑 Получить пароль", callback_data: "GET_PASS" }],
            [{ text: "🌐 Открыть платформу", url: platformLink }],
            [{ text: "📲 Скачать Android", url: androidLink }],
            [{ text: "📱 Скачать iOS", url: iosLink }],
          ],
        },
      });
    } catch {}

    return;
  }

  // fallback автоответчик
  try {
    await axios.post(`${TG}/sendMessage`, {
      chat_id: chatId,
      text: "Нажмите /start, чтобы получить кнопки демо-доступа.",
    });
  } catch {}
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("✅ Bot started on port", PORT));
