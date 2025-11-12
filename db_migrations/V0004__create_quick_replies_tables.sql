-- Создание таблиц для системы быстрых ответов

-- Таблица вкладок
CREATE TABLE IF NOT EXISTS tabs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    position INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица ячеек
CREATE TABLE IF NOT EXISTS cells (
    id SERIAL PRIMARY KEY,
    tab_id INTEGER NOT NULL REFERENCES tabs(id),
    row_index INTEGER NOT NULL,
    col_index INTEGER NOT NULL,
    content TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tab_id, row_index, col_index)
);

-- Создание индексов для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_cells_tab_id ON cells(tab_id);
CREATE INDEX IF NOT EXISTS idx_cells_position ON cells(tab_id, row_index, col_index);

-- Вставка начальных данных (8 вкладок)
INSERT INTO tabs (name, position) VALUES 
    ('Вкладка 1', 1),
    ('Вкладка 2', 2),
    ('Вкладка 3', 3),
    ('Вкладка 4', 4),
    ('Вкладка 5', 5),
    ('Вкладка 6', 6),
    ('Вкладка 7', 7),
    ('Вкладка 8', 8)
ON CONFLICT DO NOTHING;