const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// === ТОКЕН И ID ===
const BOT_TOKEN = "8648067650:AAF5AkkojfiHJIn9rjFyfke96vZa0hYdcIs";
const ADMIN_CHAT_ID = "7862998301";

// Переменные из панели Render
const PUBLIC_URL = process.env.PUBLIC_URL; 
const PLATFORM_URL = process.env.PLATFORM_URL || "https://tracking.aset.tj/new/";

const TG = `https://api.telegram.org/bot${BOT_TOKEN}`;

// 1) Установка webhook
app.get("/setWebhook", async (req, res) => {
  try {
    const url = `${PUBLIC_URL}/telegram`;
    const r = await axios.post(`${TG}/setWebhook`, { url });
    res.json(r.data);
  } catch (e) {
    res.status(500).json({ ok: false, error: "setWebhook failed" });
  }
});

// 2) Эндпоинт "невидимка" для логирования и мгновенного перехода
app.get("/go", async (req, res) => {
  const uid = req.query.uid || "unknown";
  const name = req.query.name || "User";
  const target = req.query.target || "platform";
  
  const links = {
    platform: PLATFORM_URL,
    android: "https://play.google.com/store/apps/details?id=ideabits.fmc",
    ios: "https://apps.apple.com/tj/app/fmc/id879075470",
  };
  
  const redirectUrl = links[target] || links.platform;

  // Отправляем алерт админу (в фоне)
  axios.post(`${TG}/sendMessage`, {
    chat_id: ADMIN_CHAT_ID,
    text: `🔔 **Клик по кнопке**\n👤 Имя: ${decodeURIComponent(name)}\n🆔 ID: ${uid}\n🎯 Куда: ${target}`,
    parse_mode: "Markdown"
  }).catch(() => {}); // Игнорируем ошибки отправки, чтобы не тормозить юзера

  // Мгновенный переброс пользователя
  return res.redirect(302, redirectUrl);
});

// 3) Webhook Telegram
app.post("/telegram", async (req, res) => {
  res.sendStatus(200);

  if (req.body?.callback_query) {
    const cq = req.body.callback_query;
    const chatId = cq.message?.chat?.id;
    const from = cq.from;
    const data = cq.data;

    try { await axios.post(`${TG}/answerCallbackQuery`, { callback_query_id: cq.id }); } catch {}

    if (data === "GET_PASS" && chatId) {
      // Сообщение пользователю
      try {
        await axios.post(`${TG}/sendMessage`, {
          chat_id: chatId,
          text: `🔐 Ваш демо-доступ:\n\n🌐 ${PLATFORM_URL}\n👤 Логин: demo\n🔑 Пароль: demo1234`,
        });
      } catch {}

      // Алерт админу (выдача пароля)
      try {
        await axios.post(`${TG}/sendMessage`, {
          chat_id: ADMIN_CHAT_ID,
          text: `🚨 **ПАРОЛЬ ВЫДАН**\n👤 ${from.first_name || ""} (@${from.username || "id" + from.id})`,
          parse_mode: "Markdown"
        });
      } catch {}
    }
    return;
  }

  const msg = req.body?.message;
  if (!msg?.chat?.id) return;

  if (msg.text && msg.text.startsWith("/start")) {
    const uid = msg.from.id;
    const name = encodeURIComponent(msg.from.first_name || "User");

    // Формируем ссылки-редиректы
    const btnPlatform = `${PUBLIC_URL}/go?uid=${uid}&name=${name}&target=platform`;
    const btnAndroid = `${PUBLIC_URL}/go?uid=${uid}&name=${name}&target=android`;
    const btnIos = `${PUBLIC_URL}/go?uid=${uid}&name=${name}&target=ios`;

    try {
      await axios.post(`${TG}/sendMessage`, {
        chat_id: msg.chat.id,
        text: "Выберите действие:",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔑 Получить пароль", callback_data: "GET_PASS" }],
            [{ text: "🌐 Открыть платформу", url: btnPlatform }],
            [{ text: "📲 Скачать Android", url: btnAndroid }],
            [{ text: "📱 Скачать iOS", url: btnIos }],
          ],
        },
      });
    } catch {}
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("✅ Бот запущен"));
