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

// === ДЕТАЛЬНАЯ СТАТИСТИКА ===
// Данные хранятся в памяти и сбросятся при перезагрузке сервера на Render
let stats = {
  total: { pass: 0, web: 0, android: 0, ios: 0 },
  daily: {} // Формат: "01.03.2026": { pass: 0, web: 0, android: 0, ios: 0 }
};

const getTjDate = (offset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() - offset);
  return date.toLocaleDateString("ru-RU", { timeZone: "Asia/Dushanbe" });
};

const getTjTime = () => {
  return new Date().toLocaleString("ru-RU", {
    timeZone: "Asia/Dushanbe",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
};

const updateStats = (type) => {
  const today = getTjDate();
  if (!stats.daily[today]) stats.daily[today] = { pass: 0, web: 0, android: 0, ios: 0 };
  
  stats.total[type]++;
  stats.daily[today][type]++;
};

const formatReport = (title, data) => {
  return `<b>${title}</b>\n\n` +
         `🔑 Пароли: <b>${data.pass}</b>\n` +
         `🌐 Платформа: <b>${data.web}</b>\n` +
         `📲 Android: <b>${data.android}</b>\n` +
         `📱 iOS: <b>${data.ios}</b>\n\n` +
         `<i>Всего переходов: ${data.web + data.android + data.ios}</i>`;
};

app.post("/telegram", async (req, res) => {
  res.sendStatus(200);

  if (req.body?.callback_query) {
    const cq = req.body.callback_query;
    const from = cq.from;
    const data = cq.data;
    const chatId = cq.message.chat.id;
    const isAdmin = String(from.id) === ADMIN_CHAT_ID;

    axios.post(`${TG}/answerCallbackQuery`, { callback_query_id: cq.id }).catch(()=>{});

    // --- ЛОГИКА ОТЧЕТОВ ---
    if (data.startsWith("STATS_") && isAdmin) {
      let reportText = "";
      if (data === "STATS_TODAY") {
        const today = getTjDate();
        reportText = formatReport(`📊 ЗА СЕГОДНЯ (${today})`, stats.daily[today] || { pass: 0, web: 0, android: 0, ios: 0 });
      } else if (data === "STATS_YESTERDAY") {
        const yesterday = getTjDate(1);
        reportText = formatReport(`📊 ЗА ВЧЕРА (${yesterday})`, stats.daily[yesterday] || { pass: 0, web: 0, android: 0, ios: 0 });
      } else if (data === "STATS_TOTAL") {
        reportText = formatReport("📊 ЗА ВЕСЬ ПЕРИОД", stats.total);
      }

      await axios.post(`${TG}/sendMessage`, {
        chat_id: ADMIN_CHAT_ID,
        text: reportText,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: "⬅️ Назад в меню", callback_data: "ADMIN_MENU" }]]
        }
      }).catch(()=>{});
      return;
    }

    if (data === "ADMIN_MENU" && isAdmin) {
      await axios.post(`${TG}/sendMessage`, {
        chat_id: ADMIN_CHAT_ID,
        text: "📊 Выберите период отчета:",
        reply_markup: {
          inline_keyboard: [
            [{ text: "📅 Сегодня", callback_data: "STATS_TODAY" }, { text: "📅 Вчера", callback_data: "STATS_YESTERDAY" }],
            [{ text: "📈 Весь период", callback_data: "STATS_TOTAL" }]
          ]
        }
      }).catch(()=>{});
      return;
    }

    // --- ЛОГИКА КНОПОК ПОЛЬЗОВАТЕЛЯ ---
    const linkMap = { "GO_PLATFORM": "web", "GO_ANDROID": "android", "GO_IOS": "ios" };
    const urls = {
        "GO_PLATFORM": PLATFORM_URL,
        "GO_ANDROID": "https://play.google.com/store/apps/details?id=ideabits.fmc",
        "GO_IOS": "https://apps.apple.com/tj/app/fmc/id879075470"
    };

    if (data === "GET_PASS") {
      updateStats("pass");
      axios.post(`${TG}/sendMessage`, {
        chat_id: chatId,
        text: `🔐 <b>Демо-доступ:</b>\n\n🌐 ${PLATFORM_URL}\n👤 Логин: <code>demo</code>\n🔑 Пароль: <code>demo1234</code>`,
        parse_mode: "HTML"
      }).catch(()=>{});
    } else if (linkMap[data]) {
      updateStats(linkMap[data]);
      axios.post(`${TG}/sendMessage`, {
        chat_id: chatId,
        text: `🚀 Ссылка для перехода:\n${urls[data]}`
      }).catch(()=>{});
    }

    // Алерт админу
    if (data !== "ADMIN_MENU" && !data.startsWith("STATS_")) {
        axios.post(`${TG}/sendMessage`, {
          chat_id: ADMIN_CHAT_ID,
          text: `🔔 <b>Действие:</b> ${data}\n👤 <b>От:</b> ${from.first_name} (@${from.username || 'id' + from.id})\n⏰ <b>Время:</b> ${getTjTime()}`,
          parse_mode: "HTML"
        }).catch(()=>{});
    }
    return;
  }

  const msg = req.body?.message;
  if (msg?.text?.startsWith("/start")) {
    const keyboard = [
      [{ text: "🔑 Получить пароль", callback_data: "GET_PASS" }],
      [{ text: "🌐 Открыть платформу", callback_data: "GO_PLATFORM" }],
      [{ text: "📲 Скачать Android", callback_data: "GO_ANDROID" }],
      [{ text: "📱 Скачать iOS", callback_data: "GO_IOS" }]
    ];

    if (String(msg.from.id) === ADMIN_CHAT_ID) {
      keyboard.push([{ text: "📊 Статистика (Админ)", callback_data: "ADMIN_MENU" }]);
    }

    axios.post(`${TG}/sendMessage`, {
      chat_id: msg.chat.id,
      text: "Выберите действие:",
      reply_markup: { inline_keyboard: keyboard }
    }).catch(()=>{});
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  if (PUBLIC_URL) {
    axios.post(`${TG}/setWebhook`, { url: `${PUBLIC_URL}/telegram` }).catch(()=>{});
  }
});
