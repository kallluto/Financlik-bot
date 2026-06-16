// Точка входа: инициализация Telegraf, подключение сцен и запуск бота

require('dotenv').config();

const { Telegraf, Scenes, session } = require('telegraf');
const { registerHandlers, addWizard, editWizard } = require('./handlers');

// Проверяем наличие токена бота
const { BOT_TOKEN } = process.env;
if (!BOT_TOKEN) {
  throw new Error('Отсутствует переменная окружения BOT_TOKEN. Проверьте файл .env');
}

// Создаем экземпляр бота
const bot = new Telegraf(BOT_TOKEN);

// Регистрируем менеджер сцен (Stage) с WizardScene-сценами
const stage = new Scenes.Stage([addWizard, editWizard]);

// session обязателен для работы сцен (хранит состояние шагов)
bot.use(session());
bot.use(stage.middleware());

// Подключаем все обработчики команд и кнопок
registerHandlers(bot);

// Глобальный перехват ошибок, чтобы один сбой не уронил бота
bot.catch((err, ctx) => {
  console.error(`Необработанная ошибка для update ${ctx.updateType}:`, err);
});

// Запуск бота
async function start() {
  try {
    await bot.launch();
    console.log('Бот запущен и ожидает сообщения.');
  } catch (err) {
    console.error('Не удалось запустить бота:', err.message);
    process.exit(1);
  }
}

start();

// Корректное завершение работы при остановке процесса (Railway, Ctrl+C)
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
