# Образ для деплоя на Railway
# Node.js 22 (LTS)
FROM node:22-alpine

WORKDIR /app

# Сначала копируем манифесты для кеширования слоя установки зависимостей
COPY package*.json ./

# Устанавливаем только продакшн-зависимости
RUN npm ci --omit=dev

# Копируем исходный код проекта
COPY . .

# Запуск бота
CMD ["node", "bot.js"]
