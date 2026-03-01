const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// === НАСТРОЙКИ ===
const BOT_TOKEN = "8648067650:AAF5AkkojfiHJIn9rjFyfke96vZa0hYdcIs";
const ADMIN_CHAT_ID = "7862998301";

// Переменные из панели Render
const PUBLIC_URL = process.env.PUBLIC_URL; 
const PLATFORM_URL = process.env.PLATFORM_URL || "https://tracking.aset.tj/new/";

const TG = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Функция для получения времени Tajikistan (UTC+5)
const getTjTime = () => {
  return new Date().toLocaleString("ru-RU", {
    timeZone: "Asia/Dushanbe",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
};

// 1) Основной обработчик Webhook
app.post("/telegram", async (req, res) => {
  res.sendStatus(200);

  // Обработка нажатий на кнопки (callback_data)
  if (req.body?.callback_query) {
    const cq = req.body.callback_query;
    const from = cq.from;
    const data = cq.data;
    const chatId = cq.message.chat.id;

    const links = {
      "GO_PLATFORM": PLATFORM_URL,
      "GO_ANDROID": "https://play.google.com/store/apps/details?id=ideabits.fmc",
      "GO_IOS": "https://apps.apple.com/tj/app/fmc/id879075470"
    };

    const labels = {
      "GO_PLATFORM": "🌐 Платформа",
      "GO_ANDROID": "📲 Android",
      "GO_IOS": "📱 iOS",
      "GET_PASS": "🔑 Пароль"
    };

    // Убираем анимацию загрузки на кнопке
    axios.post(`${TG}/answerCallbackQuery`, { callback_query_id: cq.id }).catch(() => {});

    // ОТПРАВКА АЛЕРТА АДМИНУ
    axios.post(`${TG}/sendMessage`, {
      chat_id: ADMIN_CHAT_ID,
      text: `🚨 **ДЕЙСТВИЕ**\n👤 КТО: ${from.first_name || ""} (@${from.username || "id" + from.id})\n🎯 НАЖАЛ: ${labels[data] || data}\n⏰ ВРЕМЯ: ${getTjTime()}`,
      parse_mode: "Markdown"
    }).catch(e => console.error("Ошибка алерта:", e.message));

    // ОТВЕТ ПОЛЬЗОВАТЕЛЮ
    if (data === "GET_PASS") {
      axios.post(`${TG}/sendMessage`, {
        chat_id: chatId,
        text: `🔐 **Ваш демо-доступ:**\n\n🌐 ${PLATFORM_URL}\n👤 Логин: \`demo\`\n🔑 Пароль: \`demo1234\``,
        parse_mode: "Markdown"
      }).catch(() => {});
    } else if (links[data]) {
      axios.post(`${TG}/sendMessage`, {
        chat_id: chatId,
        text: `🚀 Ссылка для перехода:\n${links[data]}`
      }).catch(() => {});
    }
    
    return;
  }

  // Обработка /start
  const msg = req.body?.message;
  if (msg?.text?.startsWith("/start")) {
    axios.post(`${TG}/sendMessage`, {
      chat_id: msg.chat.id,
      text: "Добро пожаловать в Aset GPS! Выберите действие:",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔑 Получить пароль", callback_data: "GET_PASS" }],
          [{ text: "🌐 Открыть платформу", callback_data: "GO_PLATFORM" }],
          [{ text: "📲 Скачать Android", callback_data: "GO_ANDROID" }],
          [{ text: "📱 Скачать iOS", callback_data: "GO_IOS" }]
        ]
      }
    }).catch(() => {});
  }
});

// Запуск сервера с автоматической установкой Webhook
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`✅ Сервер запущен`);
  
  if (PUBLIC_URL) {
    try {
      await axios.post(`${TG}/setWebhook`, { url: `${PUBLIC_URL}/telegram` });
      console.log(`📡 Webhook активен: ${PUBLIC_URL}/telegram`);
    } catch (e) {
      console.log(`❌ Ошибка установки Webhook: ${e.message}`);
    }
  }
});
