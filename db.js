// Инициализация клиента Supabase
// Здесь создается единственный экземпляр клиента, который используется во всем проекте.

const { createClient } = require('@supabase/supabase-js');

// Проверяем наличие обязательных переменных окружения до создания клиента
const { SUPABASE_URL, SUPABASE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  // Без этих переменных подключение к базе невозможно — останавливаем запуск
  throw new Error(
    'Отсутствуют переменные окружения SUPABASE_URL и/или SUPABASE_KEY. Проверьте файл .env'
  );
}

// Создаем клиент Supabase для работы с PostgreSQL
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    // Бот работает без пользовательских сессий Supabase Auth — отключаем хранение/обновление сессии
    persistSession: false,
    autoRefreshToken: false,
  },
});

module.exports = { supabase };
