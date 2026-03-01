const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// === ТОКЕН И ID ===
const BOT_TOKEN = "8648067650:AAF5AkkojfiHJIn9rjFyfke96vZa0hYdcIs";
const ADMIN_CHAT_ID = "7862998301";

const PUBLIC_URL = process.env.PUBLIC_URL; 
const PLATFORM_URL = process.env.PLATFORM_URL || "https://tracking.aset.tj/new/";

const TG = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Функция для получения текущего времени в Таджикистане (UTC+5)
const getTjTime = () => {
  return new Date().toLocaleString("ru-RU", {
    timeZone: "Asia/Dushanbe",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
};

app.get("/setWebhook", async (req, res) => {
  try {
    const url = `${PUBLIC_URL}/telegram`;
    const r = await axios.post(`${TG}/setWebhook`, { url });
    res.json(r.data);
  } catch (e) {
    res.status(500).json({ ok: false, error: "setWebhook failed" });
  }
});

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

  axios.post(`${TG}/sendMessage`, {
    chat_id: ADMIN_CHAT_ID,
    text: `🌐 **Переход по ссылке**\n👤 Имя: ${decodeURIComponent(name)}\n🆔 ID: ${uid}\n🎯 Тип: ${target}\n⏰ Время (TJK): ${getTjTime()}`,
    parse_mode: "Markdown"
  }).catch(() => {});

  return res.redirect(302, redirectUrl);
});

app.post("/telegram", async (req, res) => {
  res.sendStatus(200);

  if (req.body?.callback_query) {
    const cq = req.body.callback_query;
    const chatId = cq.message?.chat?.id;
    const from = cq.from;
    const data = cq.data;

    try { await axios.post(`${TG}/answerCallbackQuery`, { callback_query_id: cq.id }); } catch {}

    if (data === "GET_PASS" && chatId) {
      try {
        await axios.post(`${TG}/sendMessage`, {
          chat_id: chatId,
          text: `🔐 Ваш демо-доступ:\n\n🌐 ${PLATFORM_URL}\n👤 Логин: demo\n🔑 Пароль: demo1234`,
        });
      } catch {}

      try {
        await axios.post(`${TG}/sendMessage`, {
          chat_id: ADMIN_CHAT_ID,
          text: `🚨 **ПАРОЛЬ ВЫДАН**\n👤 ${from.first_name || ""} (@${from.username || "id" + from.id})\n⏰ Время (TJK): ${getTjTime()}`,
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
