const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// === КОНФИГУРАЦИЯ ===
const BOT_TOKEN = "8648067650:AAF5AkkojfiHJIn9rjFyfke96vZa0hYdcIs";
const ADMIN_CHAT_ID = "7862998301";

// Берем из ENV или используем значения по умолчанию
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

// 1) Установка webhook (вызвать один раз: /setWebhook)
app.get("/setWebhook", async (req, res) => {
  try {
    const url = `${PUBLIC_URL}/telegram`;
    const r = await axios.post(`${TG}/setWebhook`, { url });
    res.json(r.data);
  } catch (e) {
    res.status(500).json({ ok: false, error: "setWebhook failed" });
  }
});

// 2) Основной обработчик Webhook
app.post("/telegram", async (req, res) => {
  res.sendStatus(200);

  // --- ОБРАБОТКА НАЖАТИЙ КНОПОК (CALLBACK) ---
  if (req.body?.callback_query) {
    const cq = req.body.callback_query;
    const from = cq.from;
    const data = cq.data;
    const chatId = cq.message.chat.id;

    // Маппинг ссылок
    const links = {
      "GO_PLATFORM": PLATFORM_URL,
      "GO_ANDROID": "https://play.google.com/store/apps/details?id=ideabits.fmc",
      "GO_IOS": "https://apps.apple.com/tj/app/fmc/id879075470"
    };

    const labels = {
      "GO_PLATFORM": "🌐 Веб-платформа",
      "GO_ANDROID": "📲 Android App",
      "GO_IOS": "📱 iOS App",
      "GET_PASS": "🔑 Запрос пароля"
    };

    try {
      // Убираем анимацию загрузки на кнопке
      await axios.post(`${TG}/answerCallbackQuery`, { callback_query_id: cq.id });

      if (data === "GET_PASS") {
        // Выдача пароля
        await axios.post(`${TG}/sendMessage`, {
          chat_id: chatId,
          text: `🔐 **Ваш демо-доступ:**\n\n🌐 ${PLATFORM_URL}\n👤 Логин: \`demo\`\n🔑 Пароль: \`demo1234\`\n\n_Нажмите на логин/пароль, чтобы скопировать._`,
          parse_mode: "Markdown"
        });
      } else if (links[data]) {
        // Отправка чистой ссылки пользователю в чат
        await axios.post(`${TG}/sendMessage`, {
          chat_id: chatId,
          text: `✅ Ссылка готова. Нажмите для перехода:\n${links[data]}`
        });
      }

      // ОТПРАВКА АЛЕРТА АДМИНУ
      await axios.post(`${TG}/sendMessage`, {
        chat_id: ADMIN_CHAT_ID,
        text: `🔔 **Действие в боте**\n👤 Пользователь: ${from.first_name || ""} (@${from.username || "id" + from.id})\n🎯 Кнопка: ${labels[data] || data}\n⏰ Время (TJK): ${getTjTime()}`,
        parse_mode: "Markdown"
      });

    } catch (e) {
      console.error("Ошибка в блоке callback");
    }
    return;
  }

  // --- ОБРАБОТКА КОМАНДЫ /START ---
  const msg = req.body?.message;
  if (msg?.text?.startsWith("/start")) {
    try {
      await axios.post(`${TG}/sendMessage`, {
        chat_id: msg.chat.id,
        text: "Добро пожаловать в Aset GPS! Выберите необходимое действие:",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔑 Получить пароль", callback_data: "GET_PASS" }],
            [{ text: "🌐 Открыть платформу", callback_data: "GO_PLATFORM" }],
            [{ text: "📲 Скачать Android", callback_data: "GO_ANDROID" }],
            [{ text: "📱 Скачать iOS", callback_data: "GO_IOS" }]
          ]
        }
      });
    } catch (e) {
      console.error("Ошибка при отправке меню");
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Бот активен на порту ${PORT}`));
