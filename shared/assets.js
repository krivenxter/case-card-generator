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
    ["voice-target", "Войс-таргет", "Войс-таргет.png", ["войс", "таргет", "голос"]],
    ["data", "Данные", "Данные.png", ["данные", "отчёт", "метрика"]],
    ["device", "Девайс", "Девайс-2.png", ["девайс", "устройство", "гаджет"]],
    ["email-tracking", "Емейл-трекинг", "Емейл-трекинг.png", ["email", "почта", "трекинг"]],
    ["ai-assistant", "ИИ Ассистент", "ИИ Ассистент.png", ["ии", "ассистент", "ai"]],
    ["ai-operator", "ИИ Оператор", "ИИ Оператор.png", ["ии", "оператор", "колл-центр"]],
    ["fortune-wheel", "Колесо фортуны", "Колесо фортуны.png", ["колесо", "фортуны", "розыгрыш"]],
    ["call-tracking", "Коллтрекинг", "Коллтрекинг.png", ["коллтрекинг", "звонки", "звонок"]],
    ["marketing-budget", "Маркетинг-Бюджет", "Маркетинг-Бюджет.png", ["маркетинг", "бюджет"]],
    ["display", "Медийный формат", "Медийный формат.png", ["медийный", "реклама", "баннер"]],
    ["multi-button", "Мультикнопка", "Мультикнопка.png", ["мультикнопка", "кнопка", "виджет"]],
    ["callback", "Обратный звонок", "Обратный звонок.png", ["обратный звонок", "заявка"]],
    ["online-chat", "Онлайн-чат", "Онлайн-чат.png", ["чат", "сообщение", "мессенджер"]],
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
    ["trade-in", "Трейд-ин", "Трейд-ин.png", ["трейд-ин", "авто", "обмен"]],
    ["smart-request", "Умная заявка", "Умная заявка.png", ["умная заявка", "заявка", "лид"]],
    ["outdoor", "Цифровая наружная реклама", "Цифровая наружная реклама.png", ["наружная", "dooh", "реклама"]]
  ];

  const visuals = visualFiles.map(([id, label, file, keywords]) => ({
    id,
    label,
    file: file.normalize("NFC"),
    keywords,
    previewSource: `visuals/${file.normalize("NFC")}`,
    exportUrl: `${PUBLIC_BASE_URL}visuals/${encodeURIComponent(file.normalize("NFC"))}`
  }));

  const generalVisualFiles = [
    "01 Сканирование куба.png", "02 Галочка успеха.png", "03 Деловой портфель.png", "04 Кисть цвета.png", "05 Календарь.png",
    "06 Входящий звонок.png", "07 Исходящий звонок.png", "08 Телефонная трубка.png", "09 Автомобиль.png", "09 Автомобиль-B.png",
    "10 Столбчатая диаграмма.png", "11 Планшет проверки.png", "12 Часы.png", "13 Облачная связь.png", "14 Копирование.png",
    "15 Процессор.png", "16 Корона.png", "17 Предупреждение.png", "18 Блок-схема.png", "19 Знак скидки.png",
    "20 Документ.png", "21 Редактирование.png", "22 Добавление.png", "23 Кошелёк.png", "24 Просмотр.png",
    "25 Флажок.png", "26 Папка.png", "27 Галерея.png", "28 Навигация.png", "29 График.png",
    "29 График 2.png", "30 Сердце.png", "31 Иерархия.png", "32 Дом.png", "33 Ключ.png",
    "34 Одобрение.png", "35 Связь.png", "36 Местоположение.png", "37 Замок.png", "38 Сообщение.png",
    "39 Смартфон.png", "40 Деньги.png", "41 Устройства.png", "42 Монитор.png", "43 Уведомление.png",
    "44 Команда.png", "45 Профиль.png", "46 Обновление.png", "47 Поиск.png", "48 Отправка.png",
    "49 Настройки.png", "50 Регулировка.png", "51 Поделиться.png", "52 Безопасность.png", "53 Магазин.png",
    "54 Покупки.png", "55 Конверт.png", "56 Избранное.png", "57 Ценник.png", "58 Обучение.png",
    "59 Билет скидки.png", "60 Переключатель.png", "61 Пользователь.png", "62 Подтверждение.png", "63 Видео.png"
  ];
  const generalVisualExportUrls = Object.freeze({
  "01 Сканирование куба.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-01-72bbdb7522d21090d023279f.png",
  "02 Галочка успеха.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-02-ca1c8e0c28755a9acc57d045.png",
  "04 Кисть цвета.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-04-1f23ee8e8a00f397e63ad8fe.png",
  "03 Деловой портфель.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-03-685efe29b182c658ac197343.png",
  "06 Входящий звонок.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-06-9d421139b25ac66ba065b5e4.png",
  "05 Календарь.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-05-a228d9d8184d360814370059.png",
  "08 Телефонная трубка.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-08-142a860835bc8299f982400d.png",
  "09 Автомобиль-B.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-09-d6d564144c3334ae611c2f79.png",
  "09 Автомобиль.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-09-3bffe35599d2635332e4c088.png",
  "07 Исходящий звонок.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-07-c427c790c1801e656663cb77.png",
  "11 Планшет проверки.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-11-f831716c91374bd6f722f2e5.png",
  "12 Часы.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-12-158a5d2e8d0d5aacaab05ed4.png",
  "13 Облачная связь.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-13-214c94d651633634b8637c9d.png",
  "14 Копирование.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-14-3cff2153f70f3c12a5d7e736.png",
  "15 Процессор.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-15-b97b58144260d14458a33051.png",
  "16 Корона.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-16-235c25d61ebbb3e88b630795.png",
  "17 Предупреждение.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-17-30ae49f3fb9ea2467fec6172.png",
  "10 Столбчатая диаграмма.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-10-9c5446d138460a6c776c3c91.png",
  "19 Знак скидки.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-19-b5e8de2fabd4c1ca6411f090.png",
  "20 Документ.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-20-696e85e7b16d05d8de072bb7.png",
  "21 Редактирование.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-21-d5f4ec4718e69a083a4ac027.png",
  "18 Блок-схема.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-18-ee9dfde384e5bfd17140cdbc.png",
  "22 Добавление.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-22-202ef2990d3882a4016c59e8.png",
  "23 Кошелёк.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-23-fafcf52b1c566be76725f16e.png",
  "25 Флажок.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-25-5e3eafa41988e2a0047eba9b.png",
  "24 Просмотр.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-24-49b22e55b5853bb32fe1ccb4.png",
  "26 Папка.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-26-4b501fbed7dfed92a7de04b5.png",
  "27 Галерея.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-27-6073a0b3632eb65b888348c4.png",
  "28 Навигация.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-28-85dd4d2466d30baeca1edbe5.png",
  "29 График 2.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-29-44b29c32a7924a57e1f71f55.png",
  "30 Сердце.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-30-5c9f234a870d659c09bf9cd4.png",
  "31 Иерархия.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-31-29a8e4d6fcec72ab8db9c663.png",
  "32 Дом.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-32-e4d4d14235c9999a7511c9a9.png",
  "29 График.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-29-4973a1c8cd9f555786b04432.png",
  "34 Одобрение.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-34-4747a67a9b579a06073d681d.png",
  "33 Ключ.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-33-e2fdf58cf83a7bcbd19f5a59.png",
  "35 Связь.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-35-0fc2f478b8ebe33fd935416e.png",
  "37 Замок.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-37-af093a5b4c3364610158fd0b.png",
  "38 Сообщение.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-38-343c338cefcc851963c3f3fe.png",
  "39 Смартфон.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-39-e94eadf9b03fb57db7e62779.png",
  "40 Деньги.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-40-9022e9777e9a26dacb41b7d4.png",
  "41 Устройства.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-41-7b4baa229aaa4f395096d988.png",
  "42 Монитор.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-42-c01731f22fb29349340dfb30.png",
  "36 Местоположение.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-36-dfecea3952abfe8baf16c8e1.png",
  "44 Команда.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-44-bd6fa7ac9a58b5ad2c8090cc.png",
  "45 Профиль.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-45-af494711b4b1f8499cdf1b58.png",
  "46 Обновление.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-46-40c08c4637893078a66ca702.png",
  "47 Поиск.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-47-44ff7213f56b4027647516af.png",
  "48 Отправка.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-48-4f9cf2ee78dcc7d65ce586d1.png",
  "49 Настройки.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-49-a283a7e8dc5e8bef2a859bf5.png",
  "50 Регулировка.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-50-44d9438db43730f6773fdd6c.png",
  "43 Уведомление.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-43-069880ce433dc3808e52694d.png",
  "52 Безопасность.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-52-0111b4f1d3174ccd366dcf23.png",
  "51 Поделиться.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-51-b3dbed00a3cf340faee2ff4f.png",
  "53 Магазин.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-53-5b3ea5318443b0f3953c8f5f.png",
  "55 Конверт.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-55-3802aece06adc1655e722916.png",
  "56 Избранное.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-56-4fc8713f301c7ed7eb381137.png",
  "54 Покупки.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-54-54eead698ab550695ae71118.png",
  "58 Обучение.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-58-eabc20ffc1e0aa5c87264b74.png",
  "57 Ценник.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-57-0c7d4ff7955b57f3d455a387.png",
  "60 Переключатель.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-60-c230a6072f20dbb94e123c95.png",
  "61 Пользователь.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-61-ac76bec457abc8128b4c59b0.png",
  "62 Подтверждение.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-62-8e33851a83c63a6718635942.png",
  "63 Видео.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-63-5a66a1f86e907e1ec181a15c.png",
  "59 Билет скидки.png": "https://calltouch-public.website.yandexcloud.net/email-assets/uploads/2026/11/essentials-59-bdb9cbafd46ad51e7eecdc00.png"
});

  const generalVisuals = generalVisualFiles.map((rawFile, index) => {
    const file = rawFile.normalize("NFC");
    const label = file.replace(/^\d+\s*/, "").replace(/\.png$/i, "");
    return {
      id: `general-${String(index + 1).padStart(2, "0")}`,
      label,
      file,
      keywords: label.toLowerCase().split(/[\s-]+/),
      previewSource: `essentials/${encodeURIComponent(file)}`,
      exportUrl: generalVisualExportUrls[file]
    };
  });

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
    generalVisuals: Object.freeze(generalVisuals),
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
      telegram: { label: "Telegram", previewSource: "icons/Telegram.svg?v=cyan-1", exportUrl: `${PUBLIC_BASE_URL}icons/Telegram.svg`, url: "https://t.me/blogcalltouch" },
      max: { label: "MAX", previewSource: "icons/MAX.svg?v=cyan-1", exportUrl: `${PUBLIC_BASE_URL}icons/MAX.svg`, url: "https://max.ru/calltouch" },
      vk: { label: "VK", previewSource: "icons/VK.svg?v=cyan-1", exportUrl: `${PUBLIC_BASE_URL}icons/VK.svg`, url: "https://vk.com/calltouch" },
      youtube: { label: "YouTube", previewSource: "icons/Youtube.svg?v=cyan-1", exportUrl: `${PUBLIC_BASE_URL}icons/Youtube.svg`, url: "https://www.youtube.com/@CalltouchRu" }
    })
  });
})(window);
