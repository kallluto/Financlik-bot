// Обработчики команд бота, WizardScene-сцены и inline-клавиатуры (без эмодзи)

const { Markup, Scenes } = require('telegraf');
const {
  addTransaction,
  getTransactions,
  getTransactionById,
  deleteTransaction,
  updateTransaction,
} = require('./storage');
const {
  TYPES,
  CATEGORIES,
  parseAmount,
  isValidType,
  isValidCategory,
  calcStats,
  formatAmount,
} = require('./transactions');

// ===== Клавиатуры (все кнопки — только текст, без эмодзи) =====

// Главное меню (после /start)
const mainMenuKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('Добавить', 'menu_add'), Markup.button.callback('Список', 'menu_list')],
  [
    Markup.button.callback('Статистика', 'menu_stats'),
    Markup.button.callback('Удалить', 'menu_delete'),
  ],
  [Markup.button.callback('Изменить', 'menu_edit')],
]);

// Клавиатура выбора типа транзакции (шаг 1 /add)
const typeKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback('Доход', `type:${TYPES.INCOME}`),
    Markup.button.callback('Расход', `type:${TYPES.EXPENSE}`),
  ],
  [Markup.button.callback('Отмена', 'add_cancel')],
]);

// Клавиатура выбора категории (шаг 2 /add): по 2 кнопки в ряд + Отмена
function buildCategoryKeyboard(cancelAction) {
  const rows = [];
  for (let i = 0; i < CATEGORIES.length; i += 2) {
    const row = [Markup.button.callback(CATEGORIES[i], `cat:${CATEGORIES[i]}`)];
    if (CATEGORIES[i + 1]) {
      row.push(Markup.button.callback(CATEGORIES[i + 1], `cat:${CATEGORIES[i + 1]}`));
    }
    rows.push(row);
  }
  rows.push([Markup.button.callback('Отмена', cancelAction)]);
  return Markup.inlineKeyboard(rows);
}

// Клавиатура шага комментария (Пропустить / Отмена)
const commentKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('Пропустить', 'skip_comment')],
  [Markup.button.callback('Отмена', 'add_cancel')],
]);

// Клавиатура подтверждения удаления
function buildDeleteConfirmKeyboard(id) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('Да, удалить', `del:confirm:${id}`),
      Markup.button.callback('Нет, отмена', 'del:cancel'),
    ],
  ]);
}

// Клавиатура выбора поля при редактировании
const editFieldKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback('Тип', 'field:type'),
    Markup.button.callback('Категория', 'field:category'),
  ],
  [
    Markup.button.callback('Сумма', 'field:amount'),
    Markup.button.callback('Комментарий', 'field:comment'),
  ],
  [Markup.button.callback('Отмена', 'edit_cancel')],
]);

// ===== Вспомогательные функции форматирования =====

// Форматирование одной транзакции для вывода в списке
function formatTransaction(tx) {
  const comment = tx.comment ? `\nКомментарий: ${tx.comment}` : '';
  return (
    `id: ${tx.id}\n` +
    `Дата: ${tx.date}\n` +
    `Тип: ${tx.type}\n` +
    `Категория: ${tx.category}\n` +
    `Сумма: ${formatAmount(tx.amount)}${comment}`
  );
}

// Текст приветствия со списком команд
const WELCOME_TEXT =
  'Бот для учета личных финансов.\n\n' +
  'Доступные команды:\n' +
  '/add — добавить транзакцию\n' +
  '/list — список транзакций\n' +
  '/stats — статистика (доходы, расходы, баланс)\n' +
  '/delete <id> — удалить транзакцию\n' +
  '/edit <id> — изменить транзакцию\n\n' +
  'Используйте кнопки ниже или команды.';

// ===== WizardScene: пошаговое добавление транзакции (/add) =====

// Шаг 1: предложить выбрать тип
async function addStepType(ctx) {
  try {
    ctx.wizard.state.data = {};
    await ctx.reply('Шаг 1. Выберите тип транзакции:', typeKeyboard);
    return ctx.wizard.next();
  } catch (err) {
    console.error('Ошибка на шаге выбора типа:', err.message);
    await ctx.reply('Произошла ошибка. Попробуйте позже.');
    return ctx.scene.leave();
  }
}

// Шаг 2: получить тип, предложить категорию
async function addStepCategory(ctx) {
  try {
    const cb = ctx.callbackQuery;
    if (!cb || !cb.data || !cb.data.startsWith('type:')) {
      await ctx.reply('Пожалуйста, выберите тип с помощью кнопок.');
      return; // остаемся на текущем шаге
    }
    await ctx.answerCbQuery();

    const type = cb.data.slice('type:'.length);
    if (!isValidType(type)) {
      await ctx.reply('Неизвестный тип. Выберите кнопкой.');
      return;
    }

    ctx.wizard.state.data.type = type;
    await ctx.reply('Шаг 2. Выберите категорию:', buildCategoryKeyboard('add_cancel'));
    return ctx.wizard.next();
  } catch (err) {
    console.error('Ошибка на шаге выбора категории:', err.message);
    await ctx.reply('Произошла ошибка. Попробуйте позже.');
    return ctx.scene.leave();
  }
}

// Шаг 3: получить категорию, запросить сумму
async function addStepAmount(ctx) {
  try {
    const cb = ctx.callbackQuery;
    if (!cb || !cb.data || !cb.data.startsWith('cat:')) {
      await ctx.reply('Пожалуйста, выберите категорию с помощью кнопок.');
      return;
    }
    await ctx.answerCbQuery();

    const category = cb.data.slice('cat:'.length);
    if (!isValidCategory(category)) {
      await ctx.reply('Неизвестная категория. Выберите кнопкой.');
      return;
    }

    ctx.wizard.state.data.category = category;
    await ctx.reply('Шаг 3. Введите сумму (число больше 0):');
    return ctx.wizard.next();
  } catch (err) {
    console.error('Ошибка на шаге ввода суммы:', err.message);
    await ctx.reply('Произошла ошибка. Попробуйте позже.');
    return ctx.scene.leave();
  }
}

// Шаг 4: проверить сумму, запросить комментарий
async function addStepComment(ctx) {
  try {
    const text = ctx.message && ctx.message.text;
    if (!text) {
      await ctx.reply('Введите сумму числом, например 1500 или 99.90');
      return;
    }

    const amount = parseAmount(text);
    if (amount === null) {
      await ctx.reply('Некорректная сумма. Введите положительное число, например 1500');
      return; // остаемся на этом шаге до корректного ввода
    }

    ctx.wizard.state.data.amount = amount;
    await ctx.reply('Шаг 4. Введите комментарий или нажмите "Пропустить":', commentKeyboard);
    return ctx.wizard.next();
  } catch (err) {
    console.error('Ошибка на шаге ввода комментария:', err.message);
    await ctx.reply('Произошла ошибка. Попробуйте позже.');
    return ctx.scene.leave();
  }
}

// Финал: сохранить транзакцию в Supabase
async function addStepFinish(ctx) {
  try {
    let comment = null;

    if (ctx.callbackQuery && ctx.callbackQuery.data === 'skip_comment') {
      await ctx.answerCbQuery();
      comment = null;
    } else if (ctx.message && ctx.message.text) {
      comment = ctx.message.text.trim() || null;
    } else {
      await ctx.reply('Введите комментарий текстом или нажмите "Пропустить".');
      return;
    }

    const { type, category, amount } = ctx.wizard.state.data;
    await addTransaction(ctx.from.id, type, category, amount, comment);

    await ctx.reply(
      'Транзакция добавлена.\n\n' +
        `Тип: ${type}\n` +
        `Категория: ${category}\n` +
        `Сумма: ${formatAmount(amount)}` +
        (comment ? `\nКомментарий: ${comment}` : ''),
      mainMenuKeyboard
    );
    return ctx.scene.leave();
  } catch (err) {
    console.error('Ошибка при сохранении транзакции:', err.message);
    await ctx.reply('Не удалось сохранить транзакцию. Попробуйте позже.');
    return ctx.scene.leave();
  }
}

const addWizard = new Scenes.WizardScene(
  'add-wizard',
  addStepType,
  addStepCategory,
  addStepAmount,
  addStepComment,
  addStepFinish
);

// Отмена добавления в любой момент
addWizard.action('add_cancel', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.reply('Добавление отменено.', mainMenuKeyboard);
  } catch (err) {
    console.error('Ошибка при отмене добавления:', err.message);
  }
  return ctx.scene.leave();
});

addWizard.command('cancel', async (ctx) => {
  await ctx.reply('Добавление отменено.', mainMenuKeyboard);
  return ctx.scene.leave();
});

// ===== WizardScene: редактирование транзакции (/edit) =====

// Загрузка транзакции с проверкой принадлежности и показ клавиатуры выбора поля
async function showEditFields(ctx, id) {
  const tx = await getTransactionById(ctx.from.id, id);
  if (!tx) {
    await ctx.reply('Транзакция с таким id не найдена.', mainMenuKeyboard);
    return false;
  }
  ctx.wizard.state.id = tx.id;
  ctx.wizard.state.current = tx;
  await ctx.reply(
    'Текущая транзакция:\n\n' + formatTransaction(tx) + '\n\nЧто изменить?',
    editFieldKeyboard
  );
  return true;
}

// Шаг 1: определить id (из аргумента команды или спросить текстом)
async function editStepId(ctx) {
  try {
    const id = ctx.scene.state && ctx.scene.state.id;
    if (id) {
      const ok = await showEditFields(ctx, id);
      if (!ok) return ctx.scene.leave();
      // переходим сразу к шагу выбора поля (минуя шаг чтения id текстом)
      return ctx.wizard.selectStep(2);
    }
    await ctx.reply('Введите id транзакции для редактирования (см. /list):');
    return ctx.wizard.next();
  } catch (err) {
    console.error('Ошибка на шаге определения id:', err.message);
    await ctx.reply('Произошла ошибка. Попробуйте позже.');
    return ctx.scene.leave();
  }
}

// Шаг 2: прочитать id из текста
async function editStepReadId(ctx) {
  try {
    const text = ctx.message && ctx.message.text;
    if (!text) {
      await ctx.reply('Введите id транзакции текстом.');
      return;
    }
    const ok = await showEditFields(ctx, text.trim());
    if (!ok) return ctx.scene.leave();
    return ctx.wizard.next();
  } catch (err) {
    console.error('Ошибка при чтении id:', err.message);
    await ctx.reply('Произошла ошибка. Попробуйте позже.');
    return ctx.scene.leave();
  }
}

// Шаг 3: выбрать поле для изменения
async function editStepChooseField(ctx) {
  try {
    const cb = ctx.callbackQuery;
    if (!cb || !cb.data || !cb.data.startsWith('field:')) {
      await ctx.reply('Выберите поле для изменения с помощью кнопок.');
      return;
    }
    await ctx.answerCbQuery();

    const field = cb.data.slice('field:'.length);
    ctx.wizard.state.field = field;

    if (field === 'type') {
      await ctx.reply('Выберите новый тип:', typeKeyboard);
    } else if (field === 'category') {
      await ctx.reply('Выберите новую категорию:', buildCategoryKeyboard('edit_cancel'));
    } else if (field === 'amount') {
      await ctx.reply('Введите новую сумму (число больше 0):');
    } else if (field === 'comment') {
      await ctx.reply('Введите новый комментарий:');
    } else {
      await ctx.reply('Неизвестное поле.');
      return;
    }
    return ctx.wizard.next();
  } catch (err) {
    console.error('Ошибка при выборе поля:', err.message);
    await ctx.reply('Произошла ошибка. Попробуйте позже.');
    return ctx.scene.leave();
  }
}

// Шаг 4: применить новое значение и обновить запись
async function editStepApply(ctx) {
  try {
    const field = ctx.wizard.state.field;
    const id = ctx.wizard.state.id;
    let updateFields = null;

    if (field === 'type') {
      const cb = ctx.callbackQuery;
      if (!cb || !cb.data || !cb.data.startsWith('type:')) {
        await ctx.reply('Выберите тип кнопкой.');
        return;
      }
      await ctx.answerCbQuery();
      const type = cb.data.slice('type:'.length);
      if (!isValidType(type)) {
        await ctx.reply('Неизвестный тип.');
        return;
      }
      updateFields = { type };
    } else if (field === 'category') {
      const cb = ctx.callbackQuery;
      if (!cb || !cb.data || !cb.data.startsWith('cat:')) {
        await ctx.reply('Выберите категорию кнопкой.');
        return;
      }
      await ctx.answerCbQuery();
      const category = cb.data.slice('cat:'.length);
      if (!isValidCategory(category)) {
        await ctx.reply('Неизвестная категория.');
        return;
      }
      updateFields = { category };
    } else if (field === 'amount') {
      const text = ctx.message && ctx.message.text;
      const amount = parseAmount(text || '');
      if (amount === null) {
        await ctx.reply('Некорректная сумма. Введите положительное число.');
        return;
      }
      updateFields = { amount };
    } else if (field === 'comment') {
      const text = ctx.message && ctx.message.text;
      if (!text) {
        await ctx.reply('Введите комментарий текстом.');
        return;
      }
      updateFields = { comment: text.trim() || null };
    } else {
      await ctx.reply('Неизвестное поле.');
      return ctx.scene.leave();
    }

    const updated = await updateTransaction(ctx.from.id, id, updateFields);
    if (!updated) {
      await ctx.reply('Не удалось обновить транзакцию.', mainMenuKeyboard);
      return ctx.scene.leave();
    }

    await ctx.reply('Транзакция обновлена.\n\n' + formatTransaction(updated), mainMenuKeyboard);
    return ctx.scene.leave();
  } catch (err) {
    console.error('Ошибка при обновлении транзакции:', err.message);
    await ctx.reply('Не удалось обновить транзакцию. Попробуйте позже.');
    return ctx.scene.leave();
  }
}

const editWizard = new Scenes.WizardScene(
  'edit-wizard',
  editStepId,
  editStepReadId,
  editStepChooseField,
  editStepApply
);

editWizard.action('edit_cancel', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.reply('Редактирование отменено.', mainMenuKeyboard);
  } catch (err) {
    console.error('Ошибка при отмене редактирования:', err.message);
  }
  return ctx.scene.leave();
});

editWizard.command('cancel', async (ctx) => {
  await ctx.reply('Редактирование отменено.', mainMenuKeyboard);
  return ctx.scene.leave();
});

// ===== Обработчики команд (вешаются на bot в registerHandlers) =====

// /start — приветствие и главное меню
async function handleStart(ctx) {
  try {
    await ctx.reply(WELCOME_TEXT, mainMenuKeyboard);
  } catch (err) {
    console.error('Ошибка в /start:', err.message);
  }
}

// /list — список транзакций пользователя
async function handleList(ctx) {
  try {
    const transactions = await getTransactions(ctx.from.id);
    if (transactions.length === 0) {
      await ctx.reply('Транзакций пока нет. Добавьте первую: /add', mainMenuKeyboard);
      return;
    }

    // Выводим транзакции (разбиваем на части, если их много)
    const blocks = transactions.map(formatTransaction);
    let message = '';
    for (const block of blocks) {
      // Telegram ограничивает длину сообщения ~4096 символами
      if (message.length + block.length + 2 > 3500) {
        await ctx.reply(message);
        message = '';
      }
      message += (message ? '\n\n' : '') + block;
    }
    if (message) {
      await ctx.reply(message, mainMenuKeyboard);
    }
  } catch (err) {
    console.error('Ошибка в /list:', err.message);
    await ctx.reply('Не удалось получить список транзакций. Попробуйте позже.');
  }
}

// /stats — статистика: доходы, расходы, баланс
async function handleStats(ctx) {
  try {
    const transactions = await getTransactions(ctx.from.id);
    const { income, expense, balance } = calcStats(transactions);

    await ctx.reply(
      'Статистика:\n\n' +
        `Доходы: ${formatAmount(income)}\n` +
        `Расходы: ${formatAmount(expense)}\n` +
        `Баланс: ${formatAmount(balance)}\n\n` +
        `Всего операций: ${transactions.length}`,
      mainMenuKeyboard
    );
  } catch (err) {
    console.error('Ошибка в /stats:', err.message);
    await ctx.reply('Не удалось рассчитать статистику. Попробуйте позже.');
  }
}

// /delete <id> — запросить подтверждение удаления
async function handleDelete(ctx) {
  try {
    // Получаем аргумент команды (id) после "/delete"
    const parts = ctx.message.text.trim().split(/\s+/);
    const id = parts[1];

    if (!id) {
      await ctx.reply(
        'Использование: /delete <id>\nid транзакции можно посмотреть в /list',
        mainMenuKeyboard
      );
      return;
    }

    const tx = await getTransactionById(ctx.from.id, id);
    if (!tx) {
      await ctx.reply('Транзакция с таким id не найдена.', mainMenuKeyboard);
      return;
    }

    await ctx.reply(
      'Удалить транзакцию?\n\n' + formatTransaction(tx),
      buildDeleteConfirmKeyboard(tx.id)
    );
  } catch (err) {
    console.error('Ошибка в /delete:', err.message);
    await ctx.reply('Не удалось обработать удаление. Попробуйте позже.');
  }
}

// Подтверждение удаления (inline-кнопка "Да, удалить")
async function handleDeleteConfirm(ctx) {
  try {
    await ctx.answerCbQuery();
    const id = ctx.match[1];
    const ok = await deleteTransaction(ctx.from.id, id);
    if (ok) {
      await ctx.reply('Транзакция удалена.', mainMenuKeyboard);
    } else {
      await ctx.reply('Не удалось удалить: транзакция не найдена.', mainMenuKeyboard);
    }
  } catch (err) {
    console.error('Ошибка при подтверждении удаления:', err.message);
    await ctx.reply('Не удалось удалить транзакцию. Попробуйте позже.');
  }
}

// Отмена удаления (inline-кнопка "Нет, отмена")
async function handleDeleteCancel(ctx) {
  try {
    await ctx.answerCbQuery();
    await ctx.reply('Удаление отменено.', mainMenuKeyboard);
  } catch (err) {
    console.error('Ошибка при отмене удаления:', err.message);
  }
}

// ===== Регистрация всех обработчиков на экземпляре бота =====

function registerHandlers(bot) {
  // Команды
  bot.start(handleStart);
  bot.command('add', (ctx) => ctx.scene.enter('add-wizard'));
  bot.command('list', handleList);
  bot.command('stats', handleStats);
  bot.command('delete', handleDelete);
  bot.command('edit', (ctx) => {
    // Если передан id аргументом — сразу заходим в сцену с этим id
    const parts = ctx.message.text.trim().split(/\s+/);
    const id = parts[1];
    return ctx.scene.enter('edit-wizard', id ? { id } : {});
  });

  // Inline-кнопки главного меню
  bot.action('menu_add', (ctx) => {
    ctx.answerCbQuery();
    return ctx.scene.enter('add-wizard');
  });
  bot.action('menu_list', (ctx) => {
    ctx.answerCbQuery();
    return handleList(ctx);
  });
  bot.action('menu_stats', (ctx) => {
    ctx.answerCbQuery();
    return handleStats(ctx);
  });
  bot.action('menu_delete', (ctx) => {
    ctx.answerCbQuery();
    return ctx.reply(
      'Чтобы удалить транзакцию, отправьте: /delete <id>\nid можно посмотреть в /list',
      mainMenuKeyboard
    );
  });
  bot.action('menu_edit', (ctx) => {
    ctx.answerCbQuery();
    return ctx.scene.enter('edit-wizard', {});
  });

  // Подтверждение/отмена удаления
  bot.action(/^del:confirm:(.+)$/, handleDeleteConfirm);
  bot.action('del:cancel', handleDeleteCancel);
}

module.exports = {
  registerHandlers,
  addWizard,
  editWizard,
};
