# Finance Bot — Telegram-бот для учета личных финансов

Telegram-бот для учета доходов и расходов. Пошаговое добавление транзакций, список,
статистика (доходы / расходы / баланс), удаление и редактирование. Данные хранятся
в Supabase (PostgreSQL). Каждый пользователь видит только свои транзакции.

## Стек технологий

- **Язык:** JavaScript (Node.js 20+)
- **Telegram-фреймворк:** [Telegraf.js](https://telegraf.js.org) 4.16.3+
- **База данных:** Supabase (PostgreSQL)
- **Клиент БД:** @supabase/supabase-js 2.108.1+
- **Переменные окружения:** dotenv 16
- **Деплой:** Railway (Dockerfile)
- **Качество кода:** ESLint + Prettier

## Команды бота

| Команда        | Описание                                      |
| -------------- | --------------------------------------------- |
| `/start`       | Приветствие и список команд                   |
| `/add`         | Пошаговое добавление транзакции (WizardScene) |
| `/list`        | Список всех транзакций пользователя           |
| `/stats`       | Статистика: доходы, расходы, баланс           |
| `/delete <id>` | Удаление транзакции по id (с подтверждением)  |
| `/edit <id>`   | Редактирование транзакции по id               |
| `/cancel`      | Отмена внутри сцены /add или /edit            |

## Структура проекта

```
finance-bot/
├── bot.js              # Точка входа: инициализация Telegraf, сцены, запуск
├── handlers.js         # Обработчики команд, WizardScene, inline-кнопки
├── db.js               # Инициализация клиента Supabase
├── storage.js          # CRUD-операции с базой данных
├── transactions.js     # Бизнес-логика: валидация и статистика
├── schema.sql          # SQL для создания таблицы transactions
├── Dockerfile          # Образ для деплоя на Railway (node:20-alpine)
├── railway.json        # Конфигурация деплоя
├── eslint.config.js    # Конфигурация ESLint (flat config)
├── .prettierrc         # Конфигурация Prettier
├── .env.example        # Шаблон переменных окружения
├── package.json        # Зависимости проекта
└── README.md           # Документация
```

## Подготовка Supabase

1. Создайте проект на [supabase.com](https://supabase.com).
2. Откройте **SQL Editor → New query**, вставьте содержимое [`schema.sql`](schema.sql) и нажмите **Run**.
3. В **Project Settings → API** скопируйте `Project URL` (это `SUPABASE_URL`) и
   `anon public` ключ (это `SUPABASE_KEY`).

## Локальный запуск

Требуется **Node.js 20+**.

```bash
# 1. Установить зависимости
npm install

# 2. Создать .env из шаблона и заполнить значения
cp .env.example .env

# 3. Запустить бота
npm start
```

Содержимое `.env`:

```
BOT_TOKEN=токен_от_@BotFather
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=anon_public_key
```

## Проверка качества кода

```bash
npm run lint          # проверка ESLint
npm run lint:fix      # автоисправление ESLint
npm run format        # форматирование Prettier
npm run format:check  # проверка форматирования
```

## Деплой на Railway

1. Создайте новый проект на [Railway](https://railway.app) и подключите репозиторий.
2. Railway автоматически использует `Dockerfile` (см. `railway.json`, builder = `DOCKERFILE`).
3. В разделе **Variables** добавьте `BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_KEY`.
4. Деплой запустится автоматически. Бот работает в режиме long polling.

## Сценарий добавления транзакции (/add)

```
Шаг 1: Выбор типа        -> кнопки: Доход / Расход / Отмена
Шаг 2: Выбор категории   -> кнопки категорий
Шаг 3: Ввод суммы        -> текст, валидация: число > 0
Шаг 4: Ввод комментария  -> текст или кнопка "Пропустить"
Финал:  INSERT в Supabase + сообщение об успехе
```

## Особенности реализации

- Все inline-кнопки — только текст, без эмодзи.
- Изоляция данных: каждый запрос к БД фильтруется по `user_id`.
- Только `const` / `let`, весь асинхронный код — `async/await`.
- `try/catch` на каждом обращении к Supabase.
- Все комментарии в коде — на русском языке.
