-- SQL для создания таблицы transactions в Supabase (PostgreSQL)
-- Выполните этот скрипт в Supabase: SQL Editor -> New query -> Run

CREATE TABLE transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id bigint NOT NULL,
  type text NOT NULL CHECK (type IN ('доход', 'расход')),
  category text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  comment text,
  date date NOT NULL DEFAULT CURRENT_DATE
);

-- Индекс для быстрой выборки транзакций конкретного пользователя
CREATE INDEX idx_transactions_user_id ON transactions (user_id);
