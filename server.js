const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// === НАСТРОЙКИ ===
const BOT_TOKEN = "8648067650:AAF5AkkojfiHJIn9rjFyfke96vZa0hYdcIs";
const ADMIN_CHAT_ID = "7862998301";

const PUBLIC_URL = process.env.PUBLIC_URL; 
const PLATFORM_URL = process.env.PLATFORM_URL || "https://tracking.aset.tj/new/";

const TG = `https://api.telegram.org/bot${BOT_TOKEN}`;

// === СТАТИСТИКА (сбрасывается при перезагрузке сервера) ===
let stats = {
  passwords_issued: 0,
  link_clicks: 0
};

// Время Таджикистана (UTC+5)
const getTjTime = () => {
  return new Date().toLocaleString("ru-RU", {
    timeZone: "Asia/Dushanbe",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    day: "2-digit", month: "2-digit", year: "numeric"
  });
};

app.post("/telegram", async (req, res) => {
  res.sendStatus(200);

  // --- ОБРАБОТКА НАЖАТИЙ КНОПОК ---
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
      "GET_PASS": "🔑 Пароль",
      "GET_STATS": "📊 Отчет"
    };

    axios.post(`${TG}/answerCallbackQuery`, { callback_query_id: cq.id }).catch(()=>{});

    // 1. ОБРАБОТКА КНОПКИ ОТЧЕТА (Только для админа)
    if (data === "GET_STATS") {
      if (String(from.id) === ADMIN_CHAT_ID) {
        await axios.post(`${TG}/sendMessage`, {
          chat_id: ADMIN_CHAT_ID,
          text: `<b>📊 ОТЧЕТ ПО СТАТИСТИКЕ</b>\n\n` +
                `🔑 Выдано паролей: <b>${stats.passwords_issued}</b>\n` +
                `🔗 Переходов по ссылкам: <b>${stats.link_clicks}</b>\n\n` +
                `<i>Обновлено: ${getTjTime()}</i>`,
          parse_mode: "HTML"
        }).catch(()=>{});
      }
      return;
    }

    // 2. ОТПРАВКА АЛЕРТА АДМИНУ + ОБНОВЛЕНИЕ СТАТИСТИКИ
    if (data === "GET_PASS") {
      stats.passwords_issued++;
    } else if (links[data]) {
      stats.link_clicks++;
    }

    const userName = from.first_name || "User";
    const userUser = from.username ? `@${from.username}` : `id${from.id}`;
    
    axios.post(`${TG}/sendMessage`, {
      chat_id: ADMIN_CHAT_ID,
      text: `<b>🚨 ALERT</b>\n<b>КТО:</b> ${userName} (${userUser})\n<b>КНОПКА:</b> ${labels[data] || data}\n<b>ВРЕМЯ:</b> ${getTjTime()}`,
      parse_mode: "HTML"
    }).catch(e => console.error("Ошибка алерта:", e.response ? e.response.data : e.message));

    // 3. ОТВЕТ ПОЛЬЗОВАТЕЛЮ
    if (data === "GET_PASS") {
      axios.post(`${TG}/sendMessage`, {
        chat_id: chatId,
        text: `🔐 <b>Ваш демо-доступ:</b>\n\n🌐 ${PLATFORM_URL}\n👤 Логин: <code>demo</code>\n🔑 Пароль: <code>demo1234</code>`,
        parse_mode: "HTML"
      }).catch(()=>{});
    } else if (links[data]) {
      axios.post(`${TG}/sendMessage`, {
        chat_id: chatId,
        text: `🚀 Ссылка для перехода:\n${links[data]}`
      }).catch(()=>{});
    }
    return;
  }

  // --- ОБРАБОТКА /START ---
  const msg = req.body?.message;
  if (msg?.text?.startsWith("/start")) {
    const isParamDemo = msg.text.includes("demo");
    const isAdmin = String(msg.from.id) === ADMIN_CHAT_ID;

    const keyboard = [
      [{ text: "🔑 Получить пароль", callback_data: "GET_PASS" }],
      [{ text: "🌐 Открыть платформу", callback_data: "GO_PLATFORM" }],
      [{ text: "📲 Скачать Android", callback_data: "GO_ANDROID" }],
      [{ text: "📱 Скачать iOS", callback_data: "GO_IOS" }]
    ];

    // Если пишет админ, добавляем ему кнопку отчета
    if (isAdmin) {
      keyboard.push([{ text: "📊 Посмотреть отчет", callback_data: "GET_STATS" }]);
    }

    axios.post(`${TG}/sendMessage`, {
      chat_id: msg.chat.id,
      text: "Добро пожаловать в Aset GPS! Выберите действие:",
      reply_markup: {
        inline_keyboard: keyboard
      }
    }).catch(()=>{});
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`✅ Сервер запущен`);
  if (PUBLIC_URL) {
    try {
      await axios.post(`${TG}/setWebhook`, { url: `${PUBLIC_URL}/telegram` });
      console.log(`📡 Webhook активен: ${PUBLIC_URL}/telegram`);
    } catch (e) {
      console.log(`❌ Ошибка Webhook: ${e.message}`);
    }
  }
});
