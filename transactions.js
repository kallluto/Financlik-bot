// Бизнес-логика: валидация данных и расчет статистики

// Допустимые типы транзакций
const TYPES = {
  INCOME: 'доход',
  EXPENSE: 'расход',
};

// Список категорий для inline-кнопок (без эмодзи)
const CATEGORIES = ['Еда', 'Транспорт', 'Жилье', 'Здоровье', 'Развлечения', 'Зарплата', 'Другое'];

// Валидация и нормализация суммы
// Принимает строку ввода пользователя, возвращает число > 0 или null при ошибке
function parseAmount(input) {
  if (typeof input !== 'string') return null;

  // Разрешаем запятую как разделитель дробной части и убираем пробелы
  const normalized = input.trim().replace(',', '.').replace(/\s+/g, '');
  if (normalized === '') return null;

  const value = Number(normalized);

  // Сумма должна быть конечным положительным числом
  if (!Number.isFinite(value) || value <= 0) return null;

  // Округляем до 2 знаков после запятой (копейки)
  return Math.round(value * 100) / 100;
}

// Проверка, что категория входит в список допустимых
function isValidCategory(category) {
  return CATEGORIES.includes(category);
}

// Проверка типа транзакции
function isValidType(type) {
  return type === TYPES.INCOME || type === TYPES.EXPENSE;
}

// Расчет статистики по массиву транзакций пользователя
// Возвращает { income, expense, balance }
function calcStats(transactions) {
  let income = 0;
  let expense = 0;

  for (const tx of transactions) {
    const amount = Number(tx.amount) || 0;
    if (tx.type === TYPES.INCOME) {
      income += amount;
    } else if (tx.type === TYPES.EXPENSE) {
      expense += amount;
    }
  }

  // Округляем итоги, чтобы избежать ошибок плавающей точки
  income = Math.round(income * 100) / 100;
  expense = Math.round(expense * 100) / 100;
  const balance = Math.round((income - expense) * 100) / 100;

  return { income, expense, balance };
}

// Форматирование суммы для вывода пользователю (с разделением разрядов)
function formatAmount(value) {
  return Number(value).toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

module.exports = {
  TYPES,
  CATEGORIES,
  parseAmount,
  isValidCategory,
  isValidType,
  calcStats,
  formatAmount,
};
