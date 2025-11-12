-- Добавление вкладки "Картинки"

INSERT INTO tabs (name, position) VALUES ('Картинки', 9);

-- Создание таблицы для хранения изображений
CREATE TABLE IF NOT EXISTS images (
    id SERIAL PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at DESC);