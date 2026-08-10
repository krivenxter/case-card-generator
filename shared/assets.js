(function exposeCalltouchAssets(global) {
  const PUBLIC_BASE_URL = "https://calltouch-public.website.yandexcloud.net/";
  const fromEntries = Object.fromEntries || ((entries) => entries.reduce((result, [key, value]) => ({ ...result, [key]: value }), {}));
  const visualFiles = [
    ["analytics", "Сквозная аналитика", "Сквозная аналитика.png", ["аналитика", "данные", "сквозная", "метрика"]],
    ["calltouch", "Calltouch", "Calltouch-1.png", ["calltouch", "платформа", "маркетинг"]],
    ["cdp-platform", "CDP-платформа", "CDP-платформа.png", ["cdp", "сегмент", "аудитория", "персонализация"]],
    ["cdp", "CDP", "CDP.png", ["cdp", "данные", "клиенты"]],
    ["marquiz", "Marquiz", "Marquiz.png", ["marquiz", "квиз", "опрос", "форма"]],
    ["car", "Автомобиль", "Автомобиль.png", ["авто", "автомобиль", "дилер"]],
    ["autodialer", "Автопрозвон", "Автопрозвон.png", ["автопрозвон", "звонок", "телефония"]],
    ["big-data", "Биг Дата", "Биг Дата.png", ["биг дата", "данные", "аналитика"]],
    ["budget", "Бюджет", "Бюджет.png", ["бюджет", "расход", "деньги"]],
    ["voice-target", "Войс-таргет", "Войс-таргет.png", ["войс", "таргет", "голос"]],
    ["data", "Данные", "Данные.png", ["данные", "отчёт", "метрика"]],
    ["device", "Девайс", "Девайс-2.png", ["девайс", "устройство", "гаджет"]],
    ["email-tracking", "Емейл-трекинг", "Емейл-трекинг.png", ["email", "почта", "трекинг"]],
    ["ai-assistant", "ИИ Ассистент", "ИИ Ассистент.png", ["ии", "ассистент", "ai"]],
    ["ai-operator", "ИИ Оператор", "ИИ Оператор.png", ["ии", "оператор", "колл-центр"]],
    ["fortune-wheel", "Колесо фортуны", "Колесо фортуны.png", ["колесо", "фортуны", "розыгрыш"]],
    ["call-tracking", "Коллтрекинг", "Коллтрекинг.png", ["коллтрекинг", "звонки", "звонок"]],
    ["marketing-budget", "Маркетинг-Бюджет", "Маркетинг-Бюджет.png", ["маркетинг", "бюджет"]],
    ["display", "Медийный формат", "Медийный формат.png", ["медийный", "реклама", "баннер"]],
    ["multi-button", "Мультикнопка", "Мультикнопка.png", ["мультикнопка", "кнопка", "виджет"]],
    ["callback", "Обратный звонок", "Обратный звонок.png", ["обратный звонок", "заявка"]],
    ["online-chat", "Онлайн-чат", "Онлайн-чат.png", ["чат", "сообщение", "мессенджер"]],
    ["predict", "Предикт", "Предикт.png", ["прогноз", "предикт"]],
    ["programmatic", "Программатик", "Программатик.png", ["программатик", "dsp", "реклама"]],
    ["promo-widgets", "Промо виджеты", "Промо виджеты.png", ["промо", "виджет", "поп-ап"]],
    ["customer-scoring", "Скоринг Клиентов", "Скоринг Клиентов.png", ["скоринг", "клиент", "оценка"]],
    ["smartphone", "Смартфон-гаджет", "Смартфон-гаджет.png", ["смартфон", "телефон", "гаджет"]],
    ["sms-mailing", "СМС рассылка", "СМС рассылка по базе клиентов.png", ["смс", "рассылка", "база"]],
    ["sms", "СМС", "СМС.png", ["смс", "сообщение"]],
    ["construction", "Строительство", "Строительство.png", ["строительство", "недвижимость", "дом"]],
    ["real-estate", "Недвижимость", "Недвижимость.png", ["недвижимость", "риелтор", "квартира", "дом", "жильё"]],
    ["target-sms", "Таргетированная СМС рассылка", "Таргетированная СМС рассылка.png", ["таргет", "смс", "аудитория"]],
    ["plate", "Тарелка", "Тарелка.png", ["еда", "ресторан", "блюдо"]],
    ["tagging", "Тегирование", "Тегирование.png", ["тег", "тегирование", "метка"]],
    ["trade-in", "Трейд-ин", "Трейд-ин.png", ["трейд-ин", "авто", "обмен"]],
    ["smart-request", "Умная заявка", "Умная заявка.png", ["умная заявка", "заявка", "лид"]],
    ["outdoor", "Цифровая наружная реклама", "Цифровая наружная реклама.png", ["наружная", "dooh", "реклама"]]
  ];

  const visuals = visualFiles.map(([id, label, file, keywords]) => ({
    id,
    label,
    file,
    keywords,
    previewSource: `visuals/${file}`,
    exportUrl: `${PUBLIC_BASE_URL}visuals/${encodeURIComponent(file)}`
  }));

  const backgrounds = [1, 2, 3, 4, 5, 6].map((number) => ({
    id: `email-background-${number}`,
    label: `Фон ${number}`,
    file: `prez-bg-${number}.png`,
    keywords: ["фон", "градиент", "абстрактный"],
    previewSource: `backgrounds-light/prez-bg-${number}.png`,
    exportUrl: `${PUBLIC_BASE_URL}backgrounds-light/prez-bg-${number}.png`
  }));

  global.CALLTOUCH_ASSETS = Object.freeze({
    publicBaseUrl: PUBLIC_BASE_URL,
    visuals: Object.freeze(visuals),
    backgrounds: Object.freeze(backgrounds),
    logos: Object.freeze({
      dark: { previewSource: "logos/calltouch-dark.svg", exportUrl: `${PUBLIC_BASE_URL}logos/calltouch-dark.svg` },
      light: { previewSource: "logos/calltouch-light.svg", exportUrl: `${PUBLIC_BASE_URL}logos/calltouch-light.svg` },
      color: { previewSource: "logos/calltouch-color.svg", exportUrl: `${PUBLIC_BASE_URL}logos/calltouch-color.svg` }
    }),
    essentials: Object.freeze(fromEntries([
      ["send", "Старт"], ["verify", "Результат"], ["clock", "Время"], ["message", "Поддержка"], ["ok-2", "Одобрение"],
      ["sms", "Сообщения"], ["house", "Дом"], ["key", "Доступ"], ["chart", "График"], ["gallery", "Изображения"], ["profile-circle", "Профиль"], ["copy-success", "Копирование"], ["like", "Одобрение"], ["cpu", "Технологии"], ["element-plus", "Добавить"], ["3d-cube-scan", "Объём"], ["teacher", "Обучение"], ["gps", "Местоположение"], ["shop", "Магазин"], ["briefcase", "Работа"], ["user", "Пользователь"], ["shopping-cart", "Покупки"], ["flag", "Цель"], ["monitor-mobbile", "Устройства"], ["notification", "Уведомления"], ["brush-square", "Дизайн"], ["link", "Ссылка"], ["document", "Документ"], ["call-incoming", "Входящий звонок"], ["lock", "Защита"], ["tag", "Метка"], ["toggle-on-circle", "Переключатель"], ["moneys", "Деньги"], ["star", "Избранное"], ["mobile", "Телефон"], ["eye", "Просмотр"], ["car", "Автомобиль"], ["crown", "Премиум"], ["empty-wallet", "Кошелёк"], ["edit", "Редактирование"], ["monitor", "Монитор"], ["ticket-discount", "Скидка"], ["folder", "Папка"], ["cloud-connection", "Облако"], ["share", "Поделиться"], ["search-normal", "Поиск"], ["discount-shape", "Скидка"], ["calendar", "Дата"], ["people", "Команда"], ["video-play", "Видео"], ["location", "Адрес"], ["setting-4", "Настройки"], ["diagram", "Схема"], ["shield-tick", "Безопасность"], ["refresh-2", "Обновление"], ["clipboard-tick", "Задача"], ["call", "Звонок"], ["call-outgoing", "Исходящий звонок"], ["heart", "Избранное"], ["hierarchy-2", "Связи"], ["setting-2", "Параметры"], ["graph", "Рост"], ["danger", "Внимание"]
    ].map(([id, label]) => { const file = id === "send" ? "icons-send-2.svg" : id === "ok-2" ? "icons-OK 2.svg" : `icons-${id}.svg`; return [id, { label, keywords: label.toLowerCase().split(" "), previewSource: `icons/essentials/${file}`, exportUrl: `${PUBLIC_BASE_URL}icons/essentials/${encodeURIComponent(file)}` }]; }))),
    social: Object.freeze({
      telegram: { label: "Telegram", previewSource: "icons/Telegram.svg", exportUrl: `${PUBLIC_BASE_URL}icons/Telegram.svg`, url: "https://t.me/blogcalltouch" },
      max: { label: "MAX", previewSource: "icons/MAX.svg", exportUrl: `${PUBLIC_BASE_URL}icons/MAX.svg`, url: "https://max.ru/calltouch" },
      vk: { label: "VK", previewSource: "icons/VK.svg", exportUrl: `${PUBLIC_BASE_URL}icons/VK.svg`, url: "https://vk.com/calltouch" },
      youtube: { label: "YouTube", previewSource: "icons/Youtube.svg", exportUrl: `${PUBLIC_BASE_URL}icons/Youtube.svg`, url: "https://www.youtube.com/@CalltouchRu" }
    })
  });
})(window);
