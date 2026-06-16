// CRUD-операции с базой данных Supabase (таблица transactions)
// Все запросы строго фильтруются по user_id для изоляции данных пользователей.

const { supabase } = require('./db');

// Название таблицы в Supabase
const TABLE = 'transactions';

// Добавление новой транзакции в базу данных
// userId   — Telegram ID пользователя (bigint)
// type     — "доход" или "расход"
// category — категория транзакции
// amount   — сумма (> 0)
// comment  — необязательный комментарий (может быть null)
async function addTransaction(userId, type, category, amount, comment) {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        user_id: userId,
        type,
        category,
        amount,
        comment: comment ?? null,
      })
      .select()
      .single();

    if (error) throw error; // Пробрасываем ошибку Supabase для обработки выше
    return data;
  } catch (err) {
    console.error('Ошибка при добавлении транзакции:', err.message);
    throw err;
  }
}

// Получение всех транзакций пользователя, отсортированных по дате (свежие сверху)
async function getTransactions(userId) {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('id', { ascending: false });

    if (error) throw error;
    return data ?? [];
  } catch (err) {
    console.error('Ошибка при получении списка транзакций:', err.message);
    throw err;
  }
}

// Получение одной транзакции по id с проверкой принадлежности пользователю
// Возвращает запись или null, если она не найдена / принадлежит другому пользователю
async function getTransactionById(userId, id) {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('user_id', userId)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ?? null;
  } catch (err) {
    console.error('Ошибка при получении транзакции по id:', err.message);
    throw err;
  }
}

// Удаление транзакции по id (только своей)
// Возвращает true, если запись была удалена, иначе false
async function deleteTransaction(userId, id) {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .delete()
      .eq('user_id', userId)
      .eq('id', id)
      .select();

    if (error) throw error;
    // Если массив data пустой — удалять было нечего (чужая или несуществующая запись)
    return Array.isArray(data) && data.length > 0;
  } catch (err) {
    console.error('Ошибка при удалении транзакции:', err.message);
    throw err;
  }
}

// Обновление транзакции по id (только своей)
// fields — объект с полями для изменения, например { amount: 100, category: 'Еда' }
// Возвращает обновленную запись или null, если изменять было нечего
async function updateTransaction(userId, id, fields) {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .update(fields)
      .eq('user_id', userId)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data ?? null;
  } catch (err) {
    console.error('Ошибка при обновлении транзакции:', err.message);
    throw err;
  }
}

module.exports = {
  addTransaction,
  getTransactions,
  getTransactionById,
  deleteTransaction,
  updateTransaction,
};
