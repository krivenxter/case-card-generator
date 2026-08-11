# Функция публикации email-ассетов

Функция принимает base64-файл из генератора, проверяет формат и размер, сохраняет объект в Object Storage и возвращает публичный URL. Поддерживаются три режима:

- без `kind` — PNG фирменного блока до 2 МБ, 600–1600 × 180–1200 px, путь `email-assets/production/YYYY/MM/`;
- `kind: "dela"` — PNG текстового Dela-фрагмента до 2 МБ, 100–1600 × 24–1200 px, путь `email-assets/dela/YYYY/MM/`;
- `kind: "asset"` — пользовательский PNG, JPEG, WebP или GIF до 2 МБ без ограничения размеров, путь `email-assets/uploads/YYYY/MM/`.

Тело `POST` содержит `imageBase64`, `blockId` и при необходимости `kind`. Объекты получают `Cache-Control: public,max-age=31536000,immutable`. `OPTIONS` используется для CORS.

Переменные окружения:

- `S3_BUCKET=calltouch-public`
- `S3_ENDPOINT=https://storage.yandexcloud.net`
- `S3_ACCESS_KEY_ID` и `S3_SECRET_ACCESS_KEY` — новые ключи сервисного аккаунта с доступом только на загрузку объектов;
- `PUBLIC_ASSET_BASE_URL=https://calltouch-public.website.yandexcloud.net`
- `ALLOWED_ORIGINS` — адрес генератора, несколько адресов через запятую;
- `UPLOAD_TOKEN` — временная дополнительная защита, если функция опубликована без нормальной авторизации.

Точка входа: `index.handler`. Среда выполнения: Python 3.12. Таймаут: 30 секунд. Память: 256 МБ.

Локальные адреса `localhost`, `127.0.0.1` и `::1` разрешены на любом порту для работы через Live Server.

После публикации URL функции нужно записать в `shared/email-config.js` как `brandAssetUploadEndpoint`. Секретные S3-ключи в браузерный конфиг не добавляются.

Для боевого использования функцию следует закрыть авторизацией на уровне существующего внутреннего портала или API Gateway. Проверка Origin и токен во фронтенде защищают только от случайных запросов, но не заменяют пользовательскую авторизацию.
