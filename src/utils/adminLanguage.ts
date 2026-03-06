export type AdminLanguage = 'az' | 'ru' | 'en';

export const ADMIN_LANGUAGE_STORAGE_KEY = 'forsaj_admin_language';

const normalizeText = (value: string) =>
  (value || '')
    .toLocaleLowerCase('az')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ə/g, 'e')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ğ/g, 'g')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .trim();

const sidebarUiLabels = {
  az: {
    primaryNavigation: 'ƏSAS NAVİQASİYA',
    groupContent: 'SAYT MƏZMUNU',
    groupLegal: 'HÜQUQİ SƏHİFƏLƏR',
    groupManagement: 'İDARƏETMƏ',
    emptyMenu: 'Menyu boşdur',
    logout: 'Çıxış',
  },
  ru: {
    primaryNavigation: 'ОСНОВНАЯ НАВИГАЦИЯ',
    groupContent: 'КОНТЕНТ САЙТА',
    groupLegal: 'ЮРИДИЧЕСКИЕ СТРАНИЦЫ',
    groupManagement: 'УПРАВЛЕНИЕ',
    emptyMenu: 'Меню пустое',
    logout: 'Выход',
  },
  en: {
    primaryNavigation: 'MAIN NAVIGATION',
    groupContent: 'SITE CONTENT',
    groupLegal: 'LEGAL PAGES',
    groupManagement: 'MANAGEMENT',
    emptyMenu: 'Menu is empty',
    logout: 'Logout',
  },
} as const;

const titleMapRu: Record<string, string> = {
  'ana sehife': 'Главная',
  'ana sehife / naviqasiya / footer': 'Главная / Навигация / Footer',
  haqqimizda: 'О нас',
  xeberler: 'Новости',
  tedbirler: 'Мероприятия',
  suruculer: 'Пилоты',
  qalereya: 'Галерея',
  qaydalar: 'Правила',
  elaqe: 'Контакты',
  'istifadeci idaresi': 'Управление пользователями',
  'sistem ayarlari': 'Системные настройки',
  'whatsapp integration': 'Интеграция WhatsApp',
  sosyal: 'Соцсети',
  'sosial media': 'Соцсети',
  muracietler: 'Заявки',
  'privacy policy': 'Политика конфиденциальности',
  'terms of service': 'Условия использования',
  'ana sehife bloklari': 'Блоки главной',
  'menyu ve naviqasiya': 'Меню и навигация',
  'hero bolmesi': 'Hero секция',
  'marquee yazisi': 'Бегущая строка',
  footer: 'Футер',
  'xeber mezmunu': 'Контент новостей',
  'xeber sehifesi metni': 'Текст страницы новости',
  'tedbir siyahisi': 'Список мероприятий',
  'tedbir sehifesi metni': 'Текст страницы мероприятия',
  'surucu cedveli': 'Таблица пилотов',
  'suruculer sehifesi metni': 'Текст страницы пилотов',
  'seo ayarlari': 'Настройки SEO',
  'umumi parametrler': 'Общие параметры',
  'elaqe ve sosial': 'Контакты и соцсети',
  'marquee ayarlari': 'Настройки бегущей строки',
  'tetbiq ayarlari': 'Настройки приложения',
  'gizlenen ayarlar': 'Скрытые настройки',
  translations: 'Переводы',
};

const titleMapAz: Record<string, string> = {
  'ana sehife / naviqasiya / footer': 'Ana Səhifə',
  sosyal: 'Sosial Media',
};

const titleMapEn: Record<string, string> = {
  'ana sehife': 'Home',
  'ana sehife / naviqasiya / footer': 'Home / Navigation / Footer',
  haqqimizda: 'About',
  xeberler: 'News',
  tedbirler: 'Events',
  suruculer: 'Drivers',
  qalereya: 'Gallery',
  qaydalar: 'Rules',
  elaqe: 'Contact',
  'istifadeci idaresi': 'User Management',
  'sistem ayarlari': 'System Settings',
  'whatsapp integration': 'WhatsApp Integration',
  sosyal: 'Social Media',
  'sosial media': 'Social Media',
  muracietler: 'Applications',
  'privacy policy': 'Privacy Policy',
  'terms of service': 'Terms of Service',
  translations: 'Translations',
};

const pathMapRu: Record<string, string> = {
  '/applications': 'Заявки',
  '/users-management': 'Управление пользователями',
  '/general-settings?tab=general': 'Системные настройки',
  '/?page=contactpage': 'Контакты',
  '/?page=rulespage': 'Правила',
  '/?page=newspage': 'Новости',
  '/?page=eventspage': 'Мероприятия',
  '/?page=drivers': 'Пилоты',
  '/?page=about': 'О нас',
  '/?page=gallerypage': 'Галерея',
  '/general-settings?tab=social': 'Соцсети',
  '/general-settings?tab=whatsapp': 'Интеграция WhatsApp',
  '/general-settings?tab=seo': 'Настройки SEO',
  '/general-settings?tab=contact': 'Контакты и соцсети',
  '/general-settings?tab=marquee': 'Настройки бегущей строки',
  '/general-settings?tab=stats': 'Настройки приложения',
  '/general-settings?tab=hidden': 'Скрытые настройки',
  '/translations': 'Переводы',
  '/?page=privacypolicypage': 'Политика конфиденциальности',
  '/?page=termsofservicepage': 'Условия использования',
};

const pathMapAz: Record<string, string> = {
  '/general-settings?tab=social': 'Sosial Media',
  '/general-settings?tab=whatsapp': 'WhatsApp Integration',
  '/translations': 'Translations',
};

const pathMapEn: Record<string, string> = {
  '/applications': 'Applications',
  '/users-management': 'User Management',
  '/general-settings?tab=general': 'System Settings',
  '/?page=contactpage': 'Contact',
  '/?page=rulespage': 'Rules',
  '/?page=newspage': 'News',
  '/?page=eventspage': 'Events',
  '/?page=drivers': 'Drivers',
  '/?page=about': 'About',
  '/?page=gallerypage': 'Gallery',
  '/general-settings?tab=social': 'Social Media',
  '/general-settings?tab=whatsapp': 'WhatsApp Integration',
  '/translations': 'Translations',
  '/?page=privacypolicypage': 'Privacy Policy',
  '/?page=termsofservicepage': 'Terms of Service',
};

const normalizeSidebarPathKey = (path?: string) => {
  const raw = String(path || '').trim().toLocaleLowerCase('az');
  if (!raw) return '';
  if (raw === '/admin') return '/';
  if (raw.startsWith('/admin?')) return `/${raw.slice('/admin'.length)}`;
  if (raw.startsWith('/admin/')) return raw.slice('/admin'.length);
  return raw;
};

type TranslationPair = { az: string; ru: string; en?: string };

const ADMIN_TEXT_PAIRS: TranslationPair[] = [
  { az: 'Yüklənir...', ru: 'Загрузка...' },
  { az: 'Səhifə tapılmadı', ru: 'Страница не найдена' },
  { az: 'Sayta Bax', ru: 'Открыть сайт' },
  { az: 'Forsaj İdarəçisi', ru: 'Администратор Forsaj' },
  { az: 'Baş Admin', ru: 'Главный админ' },
  { az: 'Sayt Redaktoru', ru: 'Редактор сайта' },
  { az: 'Profil', ru: 'Профиль' },
  { az: 'İstifadəçi adı və şifrə mütləqdir', ru: 'Логин и пароль обязательны' },
  { az: 'Tam ad mütləqdir', ru: 'Полное имя обязательно' },
  { az: 'Şifrə ən azı 6 simvol olmalıdır', ru: 'Пароль должен содержать минимум 6 символов' },
  { az: 'Giriş uğursuz oldu', ru: 'Ошибка входа' },
  { az: 'Quraşdırma uğursuz oldu', ru: 'Ошибка настройки' },
  { az: 'Xoş gəldiniz!', ru: 'Добро пожаловать!' },
  { az: 'Baza uğurla başladıldı! İndi daxil ola bilərsiniz.', ru: 'Система успешно инициализирована. Теперь можно войти.' },
  { az: 'Əməliyyat uğursuz oldu', ru: 'Операция не выполнена' },
  { az: 'Forsaj İdarəetmə Paneli', ru: 'Панель управления Forsaj' },
  { az: 'Sistem Quraşdırılması', ru: 'Настройка системы' },
  { az: 'Sistemə daxil olmaq üçün məlumatlarınızı daxil edin', ru: 'Введите данные для входа в систему' },
  { az: 'İlkin Baş Admin hesabını yaradaraq sistemi başladın', ru: 'Создайте первого главного администратора для запуска системы' },
  { az: 'Tam Adınız', ru: 'Ваше полное имя' },
  { az: 'İstifadəçi Adı', ru: 'Имя пользователя' },
  { az: 'Şifrə', ru: 'Пароль' },
  { az: 'Gözləyin...', ru: 'Подождите...' },
  { az: 'Daxil ol', ru: 'Войти' },
  { az: 'Sistemi başlat', ru: 'Запустить систему' },
  { az: 'Məs: Əli Məmmədov', ru: 'Например: Али Мамедов' },
  { az: 'Məs: admin', ru: 'Например: admin' },
  { az: 'Front qovluğu skan edilir...', ru: 'Сканируется папка front...' },
  { az: 'Skan xətası', ru: 'Ошибка сканирования' },
  { az: 'Skan tamamlandı! Panel yenilənir...', ru: 'Сканирование завершено! Панель обновляется...' },
  { az: 'Skan uğursuz oldu!', ru: 'Сканирование не удалось!' },
  { az: 'Sitemap Faylını Yaradın', ru: 'Создайте файл Sitemap' },
  { az: 'Front Layihəsini Sinxronlaşdırın', ru: 'Синхронизируйте Front-проект' },
  { az: 'Sistem Ayarlarını Tənzimləyin', ru: 'Настройте системные параметры' },
  { az: 'Xoş Gəlmisiniz! Paneli Qurmağa Başlayaq', ru: 'Добро пожаловать! Давайте настроим панель' },
  { az: 'Yeni Səhifə Əlavə Et', ru: 'Добавить новую страницу' },
  { az: 'Dinamik olaraq yeni admin səhifəsi yaradın.', ru: 'Создайте новую страницу админки динамически.' },
  { az: 'Front Skaner', ru: 'Сканер Front' },
  { az: '/front qosulub. Skanlamağa hazırdır.', ru: '/front подключен. Готов к сканированию.' },
  { az: 'İndi Skan Et', ru: 'Сканировать сейчас' },
  { az: 'Məlumat:', ru: 'Информация:' },
  { az: 'Sessiya müddəti bitib. Yenidən daxil olun.', ru: 'Сессия истекла. Войдите снова.' },
  { az: 'İstifadəçiləri yükləmək mümkün olmadı', ru: 'Не удалось загрузить пользователей' },
  { az: 'Zəhmət olmasa bütün sahələri doldurun', ru: 'Пожалуйста, заполните все поля' },
  { az: 'İstifadəçi yeniləndi', ru: 'Пользователь обновлен' },
  { az: 'Yeni istifadəçi yaradıldı', ru: 'Новый пользователь создан' },
  { az: 'Xəta baş verdi', ru: 'Произошла ошибка' },
  { az: 'Serverlə bağlantı kəsildi', ru: 'Потеряно соединение с сервером' },
  { az: 'Bu istifadəçini silmək istədiyinizə əminsiniz?', ru: 'Вы уверены, что хотите удалить этого пользователя?' },
  { az: 'İstifadəçi silindi', ru: 'Пользователь удален' },
  { az: 'Silmək mümkün olmadı', ru: 'Не удалось удалить' },
  { az: 'Admin Hesabları', ru: 'Аккаунты админов' },
  { az: 'Yeni idarəçi', ru: 'Новый админ' },
  { az: 'Baş admin', ru: 'Главный админ' },
  { az: 'Redaktor', ru: 'Редактор' },
  { az: 'Düzəliş et', ru: 'Редактировать' },
  { az: 'Sil', ru: 'Удалить' },
  { az: 'İstifadəçini redaktə et', ru: 'Редактировать пользователя' },
  { az: 'Yeni idarəçi hesabı', ru: 'Новый администратор' },
  { az: 'Dəyişmək istəmirsinizsə boş saxlayın', ru: 'Оставьте пустым, если не хотите менять' },
  { az: 'Baş Admin (Tam səlahiyyət)', ru: 'Главный админ (полные права)' },
  { az: 'Redaktor (Məhdud səlahiyyət)', ru: 'Редактор (ограниченные права)' },
  { az: 'Ləğv et', ru: 'Отмена' },
  { az: 'Yadda Saxla', ru: 'Сохранить' },
  { az: 'Müraciətlər yüklənərkən xəta baş verdi', ru: 'Ошибка при загрузке заявок' },
  { az: 'Bu müraciəti silmək istədiyinizə əminsiniz?', ru: 'Вы уверены, что хотите удалить эту заявку?' },
  { az: 'Müraciət silindi', ru: 'Заявка удалена' },
  { az: 'Silinmə zamanı xəta baş verdi', ru: 'Ошибка при удалении' },
  { az: 'Export üçün müraciət tapılmadı', ru: 'Нет заявок для экспорта' },
  { az: 'XLSX faylı yükləndi', ru: 'XLSX файл загружен' },
  { az: 'XLSX export zamanı xəta baş verdi', ru: 'Ошибка экспорта XLSX' },
  { az: 'Müraciətlər', ru: 'Заявки' },
  { az: 'Hamısı', ru: 'Все' },
  { az: 'Oxunmamış', ru: 'Непрочитанные' },
  { az: 'Oxunmuş', ru: 'Прочитанные' },
  { az: 'Excelə Aktar', ru: 'Экспорт в Excel' },
  { az: 'Heç bir müraciət tapılmadı', ru: 'Заявки не найдены' },
  { az: 'Müraciət Təfərrüatları', ru: 'Детали заявки' },
  { az: 'Göndərən', ru: 'Отправитель' },
  { az: 'Əlaqə', ru: 'Контакт' },
  { az: 'Məzmun', ru: 'Содержание' },
  { az: 'Baxmaq üçün siyahıdan müraciət seçin', ru: 'Выберите заявку из списка для просмотра' },
  { az: 'Sistem Ayarları', ru: 'Системные настройки' },
  { az: 'Yadda saxlanılır...', ru: 'Сохраняется...' },
  { az: 'Ayarlar qeyd edildi!', ru: 'Настройки сохранены!' },
  { az: 'Ayarlar yüklənərkən xəta baş verdi', ru: 'Ошибка загрузки настроек' },
  { az: 'Şəkil yüklənir...', ru: 'Загрузка изображения...' },
  { az: 'Şəkil yükləndi', ru: 'Изображение загружено' },
  { az: 'Yükləmə xətası', ru: 'Ошибка загрузки' },
  { az: 'Gizlədilmiş ayar kartları', ru: 'Скрытые карточки настроек' },
  { az: 'SEO, Brendinq və ümumi sayt tənzimləmələri', ru: 'SEO, брендинг и общие настройки сайта' },
  { az: 'Gizlənmiş kart yoxdur. Kartları gizlətmək üçün normal görünüşdə kartın üzərinə gəlib göz ikonuna klikləyin.', ru: 'Скрытых карточек нет. Чтобы скрыть карточку, наведите на нее и нажмите иконку глаза.' },
  { az: 'Gizlət', ru: 'Скрыть' },
  { az: 'Göstər', ru: 'Показать' },
  { az: 'Test et', ru: 'Проверить' },
  { az: 'Aktiv', ru: 'Активно' },
  { az: 'Deaktiv', ru: 'Неактивно' },
  { az: 'WhatsApp Integration', ru: 'Интеграция WhatsApp' },
  { az: 'Admin Panel', ru: 'Панель администратора' },
  { az: 'Komponentləri və məzmunu axtar...', ru: 'Поиск компонентов и контента...' },
  { az: 'Geniş Rejim: Məcburi', ru: 'Широкий режим: обязателен' },
  { az: 'Gizlədilənləri Aç', ru: 'Показать скрытые' },
  { az: 'Paneldə gizlə', ru: 'Скрыть в панели' },
  { az: 'Paneldə gizlədilən bütün bölmələri yenidən göstər', ru: 'Показать все разделы, скрытые в панели' },
  { az: 'Bu section paneldə gizlidir. Yenidən göstərmək üçün “Paneldə gizlə” seçimini söndürün.', ru: 'Этот раздел скрыт в панели. Чтобы снова показать его, отключите опцию «Скрыть в панели».' },
  { az: 'Marquee bölməsi paneldə gizlədildi. Yuxarıdakı checkbox ilə geri aça bilərsiniz.', ru: 'Раздел Marquee скрыт в панели. Вы можете снова открыть его с помощью чекбокса выше.' },
  { az: 'Saxla', ru: 'Сохранить' },
  { az: 'Ana Səhifə', ru: 'Главная' },
  { az: 'Tədbirlər', ru: 'События' },
  { az: 'Tədbir İdarəetməsi', ru: 'Управление мероприятиями' },
  { az: 'Tedbir Yönetimi', ru: 'Управление мероприятиями' },
  { az: 'Xəbərlər', ru: 'Новости' },
  { az: 'Sürücülər', ru: 'Пилоты' },
  { az: 'Videolar', ru: 'Видео' },
  { az: 'Fotolar', ru: 'Фото' },
  { az: 'Geniş rejim məcburi aktivdir: texniki ID, sıralama, silmə və gizlətmə alətləri hər zaman görünür.', ru: 'Расширенный режим включен принудительно: технический ID, сортировка, удаление и скрытие всегда отображаются.' },
  { az: 'Əlaqə Səhifəsi', ru: 'Страница контактов' },
  { az: 'Əlaqə səhifəsində ofis, departament və form mətnləri.', ru: 'Тексты офиса, отделов и формы на странице контактов.' },
  { az: 'VƏZİYYƏT:', ru: 'СИТУАЦИЯ:' },
  { az: 'Müraciət İstiqaməti Seçimləri', ru: 'Варианты направления обращения' },
  { az: 'Yeni Seçim', ru: 'Новый вариант' },
  { az: 'Bu seçimlər əlaqə formundakı dropdown içində göstərilir.', ru: 'Эти варианты отображаются в выпадающем списке формы контакта.' },
  { az: 'Mətn Sahələri', ru: 'Текстовые поля' },
  { az: 'Mətn Əlavə Et', ru: 'Добавить текст' },
  { az: 'Səhifə və Sistem', ru: 'Страница и система' },
  { az: 'Səhifə başlığı, status və sistem mesajları', ru: 'Заголовок страницы, статус и системные сообщения' },
  { az: 'Səhifənin ən üstündə görünən əsas başlıq.', ru: 'Основной заголовок, отображаемый в верхней части страницы.' },
  { az: 'Açar mətn', ru: 'Ключевой текст' },
  { az: 'Link əlavə et', ru: 'Добавить ссылку' },
  { az: 'Yuxarı', ru: 'Вверх' },
  { az: 'Aşağı', ru: 'Вниз' },
  { az: 'Yuxarı daşı', ru: 'Переместить вверх' },
  { az: 'Aşağı daşı', ru: 'Переместить вниз' },
  { az: 'Sayta Bax', ru: 'Открыть сайт', en: 'Open Site' },
  { az: 'Forsaj İdarəçisi', ru: 'Администратор Forsaj', en: 'Forsaj Administrator' },
  { az: 'Baş Admin', ru: 'Главный админ', en: 'Super Admin' },
  { az: 'Baş admin', ru: 'Главный админ', en: 'Super Admin' },
  { az: 'Sayt Redaktoru', ru: 'Редактор сайта', en: 'Site Editor' },
  { az: 'Profil', ru: 'Профиль', en: 'Profile' },
  { az: 'Admin Panel', ru: 'Панель администратора', en: 'Admin Panel' },
  { az: 'Geniş Rejim: Məcburi', ru: 'Широкий режим: обязателен', en: 'Wide Mode: Required' },
  { az: 'Gizlədilənləri Aç', ru: 'Показать скрытые', en: 'Show Hidden' },
  { az: 'Saxla', ru: 'Сохранить', en: 'Save' },
  { az: 'Yadda Saxla', ru: 'Сохранить', en: 'Save' },
  { az: 'Tədbir İdarəetməsi', ru: 'Управление мероприятиями', en: 'Event Management' },
  { az: 'Tedbir Yönetimi', ru: 'Управление мероприятиями', en: 'Event Management' },
  { az: 'Geniş rejim məcburi aktivdir: texniki ID, sıralama, silmə və gizlətmə alətləri hər zaman görünür.', ru: 'Расширенный режим включен принудительно: технический ID, сортировка, удаление и скрытие всегда отображаются.', en: 'Wide mode is enforced: technical ID, ordering, delete and hide tools are always visible.' },
  { az: 'Hero Bölməsi', ru: 'Hero секция', en: 'Hero Section' },
  { az: 'Ana səhifənin ilk ekranında görünən başlıq, alt başlıq və düymələr.', ru: 'Заголовок, подзаголовок и кнопки, отображаемые на первом экране главной страницы.', en: 'Heading, subheading and buttons shown on the first screen of the homepage.' },
  { az: 'VƏZİYYƏT:', ru: 'СИТУАЦИЯ:', en: 'STATUS:' },
  { az: 'Mətn Sahələri', ru: 'Текстовые поля', en: 'Text Fields' },
  { az: 'Mətn Əlavə Et', ru: 'Добавить текст', en: 'Add Text' },
  { az: 'Bu mətn saytda olduğu kimi göstərilir.', ru: 'Этот текст отображается на сайте в том виде, в котором он есть.', en: 'This text is displayed on the site as is.' },
  { az: 'Açar mətn', ru: 'Ключевой текст', en: 'Key Text' },
  { az: 'Link əlavə et', ru: 'Добавить ссылку', en: 'Add Link' },
  { az: 'Yuxarı', ru: 'Вверх', en: 'Up' },
  { az: 'Aşağı', ru: 'Вниз', en: 'Down' },
  { az: 'Yuxarı daşı', ru: 'Переместить вверх', en: 'Move Up' },
  { az: 'Aşağı daşı', ru: 'Переместить вниз', en: 'Move Down' },
  { az: 'Paneldə gizlə', ru: 'Скрыть в панели', en: 'Hide In Panel' },
  { az: 'Paneldə gizlədilən bütün bölmələri yenidən göstər', ru: 'Показать все разделы, скрытые в панели', en: 'Show all sections hidden in panel' },
  { az: 'Bu section paneldə gizlidir. Yenidən göstərmək üçün “Paneldə gizlə” seçimini söndürün.', ru: 'Этот раздел скрыт в панели. Чтобы снова показать его, отключите опцию «Скрыть в панели».', en: 'This section is hidden in the panel. Disable “Hide In Panel” to show it again.' },
  { az: 'Marquee bölməsi paneldə gizlədildi. Yuxarıdakı checkbox ilə geri aça bilərsiniz.', ru: 'Раздел Marquee скрыт в панели. Вы можете снова открыть его с помощью чекбокса выше.', en: 'Marquee section is hidden in panel. You can re-open it using the checkbox above.' },
  { az: 'Sistemi idarə edən bütün administratorların siyahısı və səlahiyyətləri', ru: 'Список всех администраторов системы и их полномочий', en: 'List of all system administrators and their permissions' },
  { az: 'Cəmi hesab', ru: 'Всего аккаунтов', en: 'Total Accounts' },
  { az: 'Ad və ya istifadəçi adı ilə axtar...', ru: 'Поиск по имени или логину...', en: 'Search by name or username...' },
  { az: 'Hamısı', ru: 'Все', en: 'All' },
  { az: 'Redaktor', ru: 'Редактор', en: 'Editor' },
  { az: 'Nəticə tapılmadı', ru: 'Ничего не найдено', en: 'No results found' },
  { az: 'Axtarış və filtr seçiminə uyğun hesab yoxdur.', ru: 'Нет аккаунтов, соответствующих поиску и выбранному фильтру.', en: 'No accounts match the search and selected filter.' },
  { az: 'Yaradılıb:', ru: 'Создан:', en: 'Created:' },
  { az: 'Tarix yoxdur', ru: 'Дата отсутствует', en: 'No date' },
  { az: 'Tam Ad', ru: 'Полное имя', en: 'Full Name' },
  { az: 'İstifadəçi Adı', ru: 'Имя пользователя', en: 'Username' },
  { az: 'Şifrə', ru: 'Пароль', en: 'Password' },
  { az: 'Yetki (Rol)', ru: 'Права (роль)', en: 'Permission (Role)' },
  { az: 'Məs: Əli Məmmədov', ru: 'Например: Али Мамедов', en: 'e.g. Ali Mammadov' },
  { az: 'Məs: alimm', ru: 'Например: alimm', en: 'e.g. alimm' },
  { az: 'Baş Admin bütün sistem daxilində tam səlahiyyətə malikdir.', ru: 'Главный админ имеет полный доступ ко всей системе.', en: 'Super Admin has full access across the entire system.' },
  { az: 'Sessiya müddəti bitib. Yenidən daxil olun.', ru: 'Сессия истекла. Войдите снова.', en: 'Session expired. Please sign in again.' },
  { az: 'İstifadəçiləri yükləmək mümkün olmadı', ru: 'Не удалось загрузить пользователей', en: 'Could not load users.' },
  { az: 'Zəhmət olmasa bütün sahələri doldurun', ru: 'Пожалуйста, заполните все поля', en: 'Please fill in all fields.' },
  { az: 'İstifadəçi yeniləndi', ru: 'Пользователь обновлен', en: 'User updated.' },
  { az: 'Yeni istifadəçi yaradıldı', ru: 'Новый пользователь создан', en: 'New user created.' },
  { az: 'Xəta baş verdi', ru: 'Произошла ошибка', en: 'An error occurred.' },
  { az: 'Serverlə bağlantı kəsildi', ru: 'Потеряно соединение с сервером', en: 'Connection to server lost.' },
  { az: 'Bu istifadəçini silmək istədiyinizə əminsiniz?', ru: 'Вы уверены, что хотите удалить этого пользователя?', en: 'Are you sure you want to delete this user?' },
  { az: 'İstifadəçi silindi', ru: 'Пользователь удален', en: 'User deleted.' },
  { az: 'Silmək mümkün olmadı', ru: 'Не удалось удалить', en: 'Could not delete.' },
  { az: 'Sistem Ayarları', ru: 'Системные настройки', en: 'System Settings' },
  { az: 'Gizlədilmiş ayar kartları', ru: 'Скрытые карточки настроек', en: 'Hidden settings cards' },
  { az: 'SEO, Brendinq və ümumi sayt tənzimləmələri', ru: 'SEO, брендинг и общие настройки сайта', en: 'SEO, branding and overall site settings' },
  { az: 'Kartı geri gətir', ru: 'Вернуть карточку', en: 'Restore card' },
  { az: 'Kartı gizlət', ru: 'Скрыть карточку', en: 'Hide card' },
  { az: 'Ayarlar yüklənərkən xəta baş verdi', ru: 'Ошибка загрузки настроек', en: 'Failed to load settings' },
  { az: 'Şəkil yüklənir...', ru: 'Загрузка изображения...', en: 'Uploading image...' },
  { az: 'Şəkil yükləndi', ru: 'Изображение загружено', en: 'Image uploaded' },
  { az: 'Yükləmə xətası', ru: 'Ошибка загрузки', en: 'Upload error' },
  { az: 'Yadda saxlanılır...', ru: 'Сохраняется...', en: 'Saving...' },
  { az: 'Ayarlar qeyd edildi!', ru: 'Настройки сохранены!', en: 'Settings saved!' },
  { az: 'Gizlənmiş kart yoxdur. Kartları gizlətmək üçün normal görünüşdə kartın üzərinə gəlib göz ikonuna klikləyin.', ru: 'Скрытых карточек нет. Чтобы скрыть карточку, наведите на нее и нажмите иконку глаза.', en: 'No hidden cards. To hide a card, hover over it in normal view and click the eye icon.' },
  { az: 'SEO əsas', ru: 'Основное SEO', en: 'SEO Basics' },
  { az: 'OG / Twitter', ru: 'OG / Twitter', en: 'OG / Twitter' },
  { az: 'Təsdiq kodları', ru: 'Коды подтверждения', en: 'Verification Codes' },
  { az: 'Əlaqə', ru: 'Контакты', en: 'Contact' },
  { az: 'Şöbə e-poçtları', ru: 'Почты отделов', en: 'Department Emails' },
  { az: 'SMTP', ru: 'SMTP', en: 'SMTP' },
  { az: 'Brendinq', ru: 'Брендинг', en: 'Branding' },
  { az: 'Sosial linklər', ru: 'Соцссылки', en: 'Social Links' },
  { az: 'WhatsApp', ru: 'WhatsApp', en: 'WhatsApp' },
  { az: 'Marquee', ru: 'Marquee', en: 'Marquee' },
  { az: 'Statistika', ru: 'Статистика', en: 'Statistics' },
  { az: 'SEO və axtarış motoru', ru: 'SEO и поисковые системы', en: 'SEO and Search Engines' },
  { az: 'Axtarış nəticələrində görünən əsas meta məlumatlar.', ru: 'Основные метаданные, отображаемые в поисковой выдаче.', en: 'Main meta information shown in search results.' },
  { az: 'Meta başlıq (sayt adı)', ru: 'Meta-заголовок (название сайта)', en: 'Meta Title (site name)' },
  { az: 'Məs: Forsaj Club - Offroad & Motorsport', ru: 'Например: Forsaj Club - Offroad & Motorsport', en: 'Example: Forsaj Club - Offroad & Motorsport' },
  { az: 'Meta təsvir', ru: 'Meta-описание', en: 'Meta Description' },
  { az: 'Sayt haqqında qısa məlumat...', ru: 'Краткая информация о сайте...', en: 'Short description about the site...' },
  { az: 'Tövsiyə: 140-160 simvol arası qısa təsvir.', ru: 'Рекомендация: короткое описание в пределах 140–160 символов.', en: 'Recommendation: keep it between 140–160 characters.' },
  { az: 'Açar sözlər', ru: 'Ключевые слова', en: 'Keywords' },
  { az: 'Açar sözləri vergül ilə ayırın.', ru: 'Разделяйте ключевые слова запятой.', en: 'Separate keywords with commas.' },
  { az: 'Kanonik URL', ru: 'Канонический URL', en: 'Canonical URL' },
  { az: 'Robots direktivi', ru: 'Директива robots', en: 'Robots directive' },
  { az: 'Müəllif', ru: 'Автор', en: 'Author' },
  { az: 'Dil (html lang)', ru: 'Язык (html lang)', en: 'Language (html lang)' },
  { az: 'Məs: `az`, `en`, `tr`.', ru: 'Например: `az`, `en`, `tr`.', en: 'Example: `az`, `en`, `tr`.' },
  { az: 'Sosial paylaşım SEO (OG / Twitter)', ru: 'SEO для соцсетей (OG / Twitter)', en: 'Social Sharing SEO (OG / Twitter)' },
  { az: 'Link paylaşılarkən görünən başlıq, təsvir və şəkil.', ru: 'Заголовок, описание и изображение, видимые при публикации ссылки.', en: 'Title, description and image shown when sharing links.' },
  { az: 'OG başlıq', ru: 'OG заголовок', en: 'OG Title' },
  { az: 'Sosial şəbəkə başlığı', ru: 'Заголовок для соцсетей', en: 'Social title' },
  { az: 'OG təsvir', ru: 'OG описание', en: 'OG Description' },
  { az: 'Sosial şəbəkə paylaşım təsviri', ru: 'Описание для публикации в соцсетях', en: 'Social sharing description' },
  { az: 'OG URL', ru: 'OG URL', en: 'OG URL' },
  { az: 'Twitter kart növü', ru: 'Тип карточки Twitter', en: 'Twitter card type' },
  { az: 'Twitter hesabı (site)', ru: 'Twitter аккаунт (site)', en: 'Twitter account (site)' },
  { az: 'Twitter müəllif', ru: 'Twitter автор', en: 'Twitter author' },
  { az: 'OG şəkli', ru: 'OG изображение', en: 'OG image' },
  { az: 'OG şəkli yoxdur', ru: 'Нет OG изображения', en: 'No OG image' },
  { az: 'Şəkil yüklə', ru: 'Загрузить изображение', en: 'Upload image' },
  { az: 'Axtarış motoru təsdiqləri', ru: 'Подтверждения поисковых систем', en: 'Search engine verifications' },
  { az: 'Google, Bing və Yandex üçün doğrulama kodları.', ru: 'Коды подтверждения для Google, Bing и Yandex.', en: 'Verification codes for Google, Bing and Yandex.' },
  { az: 'Google təsdiq kodu', ru: 'Код подтверждения Google', en: 'Google verification code' },
  { az: 'google-site-verification kodu', ru: 'Код google-site-verification', en: 'google-site-verification code' },
  { az: 'Bing təsdiq kodu', ru: 'Код подтверждения Bing', en: 'Bing verification code' },
  { az: 'msvalidate.01 kodu', ru: 'Код msvalidate.01', en: 'msvalidate.01 code' },
  { az: 'Yandex təsdiq kodu', ru: 'Код подтверждения Yandex', en: 'Yandex verification code' },
  { az: 'yandex-verification kodu', ru: 'Код yandex-verification', en: 'yandex-verification code' },
  { az: 'Əlaqə & Ünvan Məlumatları', ru: 'Контакты и данные адреса', en: 'Contact & Address Information' },
  { az: 'Footer və əlaqə hissəsində görünən ofis və əlaqə məlumatları.', ru: 'Данные офиса и контактов, отображаемые в футере и разделе контактов.', en: 'Office and contact details shown in footer and contact section.' },
  { az: 'Baş Ofis Ünvan (Sətir 1)', ru: 'Адрес главного офиса (строка 1)', en: 'Head Office Address (Line 1)' },
  { az: 'Məs: AZADLIQ 102, BAKI', ru: 'Например: AZADLIQ 102, BAKI', en: 'Example: AZADLIQ 102, BAKI' },
  { az: 'Baş Ofis Ünvan (Sətir 2)', ru: 'Адрес главного офиса (строка 2)', en: 'Head Office Address (Line 2)' },
  { az: 'Məs: AZƏRBAYCAN // SECTOR_01', ru: 'Например: AZERBAIJAN // SECTOR_01', en: 'Example: AZERBAIJAN // SECTOR_01' },
  { az: 'İş Saatları', ru: 'Часы работы', en: 'Working Hours' },
  { az: 'Məs: 09:00 - 18:00', ru: 'Например: 09:00 - 18:00', en: 'Example: 09:00 - 18:00' },
  { az: 'Əlaqə Nömrəsi', ru: 'Контактный номер', en: 'Contact Number' },
  { az: 'Əlaqə E-poçtu', ru: 'Контактный email', en: 'Contact Email' },
  { az: 'Şöbə E-poçtları', ru: 'E-mail отделов', en: 'Department Emails' },
  { az: 'Müraciətlərin istiqamətinə uyğun e-poçt ünvanları.', ru: 'E-mail адреса по направлениям обращений.', en: 'Email addresses by application direction.' },
  { az: 'Baş Ofis (HQ)', ru: 'Главный офис (HQ)', en: 'Head Office (HQ)' },
  { az: 'Media və PR', ru: 'СМИ и PR', en: 'Media & PR' },
  { az: 'Texniki Dəstək', ru: 'Техническая поддержка', en: 'Technical Support' },
  { az: 'SMTP Bildiriş Ayarları', ru: 'Настройки SMTP уведомлений', en: 'SMTP Notification Settings' },
  { az: 'Form müraciətləri göndəriləndə e-poçt bildirişi üçün SMTP məlumatları.', ru: 'SMTP параметры для email-уведомлений при отправке формы.', en: 'SMTP settings for email notifications when forms are submitted.' },
  { az: 'SMTP aktiv', ru: 'SMTP включен', en: 'SMTP enabled' },
  { az: 'Aktiv', ru: 'Активно', en: 'Active' },
  { az: 'Deaktiv', ru: 'Неактивно', en: 'Inactive' },
  { az: 'SMTP Host', ru: 'SMTP Host', en: 'SMTP Host' },
  { az: 'SMTP Port', ru: 'SMTP Порт', en: 'SMTP Port' },
  { az: 'Təhlükəsizlik (SSL/TLS)', ru: 'Безопасность (SSL/TLS)', en: 'Security (SSL/TLS)' },
  { az: 'Yox (STARTTLS/587)', ru: 'Нет (STARTTLS/587)', en: 'No (STARTTLS/587)' },
  { az: 'Bəli (SSL/465)', ru: 'Да (SSL/465)', en: 'Yes (SSL/465)' },
  { az: 'SMTP istifadəçi', ru: 'SMTP пользователь', en: 'SMTP user' },
  { az: 'SMTP şifrə / app password', ru: 'SMTP пароль / app password', en: 'SMTP password / app password' },
  { az: 'Gizlət', ru: 'Скрыть', en: 'Hide' },
  { az: 'Göstər', ru: 'Показать', en: 'Show' },
  { az: 'Göndərən ünvanı (From)', ru: 'Адрес отправителя (From)', en: 'Sender address (From)' },
  { az: 'Qəbul edən ünvan(lar) (To)', ru: 'Адрес(а) получателя (To)', en: 'Recipient address(es) (To)' },
  { az: 'Brendinq & Loqo', ru: 'Брендинг и логотип', en: 'Branding & Logo' },
  { az: 'Light/Dark loqoları yükləyin, görünüşü dərhal önizləyin.', ru: 'Загрузите Light/Dark логотипы и сразу смотрите предпросмотр.', en: 'Upload light/dark logos and preview instantly.' },
  { az: 'Əsas Loqo (Light)', ru: 'Основной логотип (Light)', en: 'Primary Logo (Light)' },
  { az: 'Loqo yoxdur', ru: 'Логотип отсутствует', en: 'No logo' },
  { az: 'Yüklə', ru: 'Загрузить', en: 'Upload' },
  { az: 'Alternativ Loqo (Dark)', ru: 'Альтернативный логотип (Dark)', en: 'Alternative Logo (Dark)' },
  { az: 'Sosial Media Linkləri', ru: 'Ссылки соцсетей', en: 'Social Media Links' },
  { az: 'Sosial hesabları daxil edin və “Test et” ilə yoxlayın.', ru: 'Введите ссылки на соцсети и проверьте через «Проверить».', en: 'Enter social links and verify with “Test”.' },
  { az: 'Test et', ru: 'Проверить', en: 'Test' },
  { az: 'Domen ilə başlayan linklərdə (`instagram.com/...`) `https://` avtomatik əlavə ediləcək.', ru: 'Для ссылок, начинающихся с домена (`instagram.com/...`), `https://` добавляется автоматически.', en: '`https://` is automatically added for domain-starting links (`instagram.com/...`).' },
  { az: 'WhatsApp Integration', ru: 'Интеграция WhatsApp', en: 'WhatsApp Integration' },
  { az: 'Sürücü qeydiyyat müraciətlərində WhatsApp bildirişlərini HubMSG API ilə idarə edin.', ru: 'Управляйте WhatsApp-уведомлениями заявок на регистрацию пилотов через HubMSG API.', en: 'Manage WhatsApp notifications for driver registration applications via HubMSG API.' },
  { az: 'WhatsApp bildirişləri', ru: 'WhatsApp уведомления', en: 'WhatsApp notifications' },
  { az: 'API Endpoint', ru: 'API Endpoint', en: 'API Endpoint' },
  { az: 'API Key', ru: 'API Key', en: 'API Key' },
  { az: 'Təşkilatçı WhatsApp nömrələri', ru: 'WhatsApp номера организаторов', en: 'Organizer WhatsApp numbers' },
  { az: 'Bir neçə nömrə üçün vergül istifadə edin. Ölkə kodu ilə daxil edin.', ru: 'Для нескольких номеров используйте запятую. Вводите с кодом страны.', en: 'Use commas for multiple numbers. Enter with country code.' },
  { az: 'Marquee Ayarları', ru: 'Настройки Marquee', en: 'Marquee Settings' },
  { az: 'Ana səhifənin üst hissəsindəki hərəkətli elan xəttini idarə edin.', ru: 'Управляйте бегущей строкой объявлений в верхней части главной страницы.', en: 'Manage the moving announcement line at the top of the homepage.' },
  { az: 'Marquee aktivdir (səhifədə göstər)', ru: 'Marquee активен (показывать на странице)', en: 'Marquee is active (show on page)' },
  { az: 'Marquee mətni', ru: 'Текст Marquee', en: 'Marquee text' },
  { az: 'Məs: FORSAJ CLUB // OFFROAD MOTORSPORT HUB', ru: 'Например: FORSAJ CLUB // OFFROAD MOTORSPORT HUB', en: 'Example: FORSAJ CLUB // OFFROAD MOTORSPORT HUB' },
  { az: 'Məs: /events və ya https://forsaj.az/events', ru: 'Например: /events или https://forsaj.az/events', en: 'Example: /events or https://forsaj.az/events' },
  { az: 'Link aktivdir (aktiv/deaktiv)', ru: 'Ссылка активна (вкл/выкл)', en: 'Link is active (on/off)' },
  { az: 'Marquee arxa plan şəkli', ru: 'Фоновое изображение Marquee', en: 'Marquee background image' },
  { az: 'Arxa plan şəkli yoxdur', ru: 'Фоновое изображение отсутствует', en: 'No background image' },
  { az: 'Sayt Statistikaları', ru: 'Статистика сайта', en: 'Site Statistics' },
  { az: 'Ana səhifədə göstərilən qısa statistik göstəricilər.', ru: 'Краткие статистические показатели, отображаемые на главной странице.', en: 'Short statistical metrics shown on the homepage.' },
  { az: 'Pilot Sayı', ru: 'Количество пилотов', en: 'Pilot Count' },
  { az: 'Susmaya görə: 140+', ru: 'По умолчанию: 140+', en: 'Default: 140+' },
  { az: 'Yarış Sayı', ru: 'Количество гонок', en: 'Race Count' },
  { az: 'Susmaya görə: 50+', ru: 'По умолчанию: 50+', en: 'Default: 50+' },
  { az: 'Gənc İştirakçı', ru: 'Молодые участники', en: 'Young Participants' },
  { az: 'Susmaya görə: 20+', ru: 'По умолчанию: 20+', en: 'Default: 20+' },
  { az: 'Privacy Policy səhifəsində başlıq, maddələr və əlaqə məlumatları.', ru: 'Заголовок, пункты и контактные данные страницы Privacy Policy.', en: 'Title, sections and contact details of the Privacy Policy page.' },
  { az: 'Bölmə Maddələri', ru: 'Пункты раздела', en: 'Section Items' },
  { az: 'Bölmə Əlavə Et', ru: 'Добавить раздел', en: 'Add Section' },
  { az: 'Privacy Policy və Terms of Service səhifələrindəki kart bölmələrini buradan əlavə edin, redaktə edin və silin.', ru: 'Здесь можно добавлять, редактировать и удалять карточки разделов для Privacy Policy и Terms of Service.', en: 'Add, edit and delete section cards for Privacy Policy and Terms of Service here.' },
  { az: 'Bölmə', ru: 'Раздел', en: 'Section' },
  { az: 'Bölmə Başlığı', ru: 'Заголовок раздела', en: 'Section Title' },
  { az: 'İkon (opsional)', ru: 'Иконка (опционально)', en: 'Icon (optional)' },
  { az: 'İkon yoxdur', ru: 'Иконка отсутствует', en: 'No icon' },
  { az: 'Mətn', ru: 'Текст', en: 'Text' },
  { az: 'Bölmə mətni', ru: 'Текст раздела', en: 'Section text' },
  { az: 'Səhifə Başlığı', ru: 'Заголовок страницы', en: 'Page Title' },
  { az: 'Ümumi başlıq və tarix məlumatları', ru: 'Общий заголовок и информация о дате', en: 'General heading and date info' },
  { az: 'Səhifə Alt Başlığı', ru: 'Подзаголовок страницы', en: 'Page Subtitle' },
  { az: 'Başlığın altında görünən qısa izah mətni.', ru: 'Краткое пояснение под заголовком.', en: 'Short explanatory text shown below the heading.' },
  { az: 'Giriş Mətni', ru: 'Вступительный текст', en: 'Intro Text' },
  { az: 'Səhifə girişində görünən giriş mətni.', ru: 'Вступительный текст в начале страницы.', en: 'Introductory text shown at the beginning of the page.' },
  { az: 'Yenilənmə Tarixi Etiketi', ru: 'Метка даты обновления', en: 'Update Date Label' },
  { az: 'Yenilənmə tarixindən əvvəl görünən etiket.', ru: 'Метка, отображаемая перед датой обновления.', en: 'Label shown before the update date.' },
  { az: 'Yenilənmə Tarixi', ru: 'Дата обновления', en: 'Update Date' },
  { az: 'Səhifədə göstərilən son yenilənmə tarixi.', ru: 'Последняя дата обновления, отображаемая на странице.', en: 'Last update date shown on the page.' },
  { az: 'Əlaqə Bölməsi Başlığı', ru: 'Заголовок блока контактов', en: 'Contact Section Title' },
  { az: 'Səhifə sonundakı əlaqə bölməsi başlığı.', ru: 'Заголовок блока контактов внизу страницы.', en: 'Title of the contact section at the end of the page.' },
  { az: 'Səhifə sonundakı e-mail ünvanı.', ru: 'E-mail адрес внизу страницы.', en: 'Email address shown at the end of the page.' },
  { az: 'Əlaqə Vebsaytı', ru: 'Контактный веб-сайт', en: 'Contact Website' },
  { az: 'Səhifə sonundakı veb sayt linki.', ru: 'Ссылка на сайт внизу страницы.', en: 'Website link shown at the end of the page.' },
  { az: 'Digər Sahələr', ru: 'Другие поля', en: 'Other Fields' },
  { az: 'Avtomatik qruplaşdırıla bilməyən sahələr', ru: 'Поля, которые нельзя сгруппировать автоматически', en: 'Fields that cannot be grouped automatically' },
  { az: 'Avtomatik qruplaşdırıla bilməyən əlavə sahələr', ru: 'Дополнительные поля, которые нельзя сгруппировать автоматически', en: 'Additional fields that cannot be grouped automatically' },
  { az: 'Bölmədəki Şəkillər', ru: 'Изображения в разделе', en: 'Section Images' },
  { az: 'Yeni Şəkil Yeri', ru: 'Новое место для изображения', en: 'New Image Slot' },
  { az: 'Bu bölmədə redaktə ediləcək şəkil yoxdur.', ru: 'В этом разделе нет изображений для редактирования.', en: 'There are no editable images in this section.' },
  { az: 'Yeni Şəkil Yüklə', ru: 'Загрузить новое изображение', en: 'Upload New Image' },
  { az: 'Şəkil yükləmək üçün seçin', ru: 'Выберите для загрузки изображения', en: 'Select to upload an image' },
  { az: 'Cihazdan Yüklə', ru: 'Загрузить с устройства', en: 'Upload from Device' },
  { az: 'Kitabxanadan Seç', ru: 'Выбрать из библиотеки', en: 'Choose from Library' },
  { az: 'Komponent Daxili Önizləmə (Sıra ilə)', ru: 'Внутренний предпросмотр компонента (по порядку)', en: 'Component Internal Preview (ordered)' },
  { az: 'Şəkil yoxdur', ru: 'Нет изображения', en: 'No image' },
  { az: 'Yol yoxdur', ru: 'Путь отсутствует', en: 'No path' },
  { az: 'Resur yolu...', ru: 'Путь к ресурсу...', en: 'Resource path...' },
  { az: 'Alt mətni...', ru: 'Alt текст...', en: 'Alt text...' },
  { az: 'Sistemdən seç', ru: 'Выбрать из системы', en: 'Choose from system' },
  { az: 'Kompüterdən yüklə', ru: 'Загрузить с компьютера', en: 'Upload from computer' },
  { az: 'Bölmə aktivləşdirildi', ru: 'Раздел активирован', en: 'Section enabled' },
  { az: 'Bölmə deaktiv edildi', ru: 'Раздел деактивирован', en: 'Section disabled' },
  { az: 'Bölməni sil', ru: 'Удалить раздел', en: 'Delete section' },
  { az: 'Ən azı bir bölmə qalmalıdır', ru: 'Должен остаться как минимум один раздел', en: 'At least one section must remain' },
  { az: 'Bölmə başlığı', ru: 'Заголовок раздела', en: 'Section heading' },
  { az: 'Bölmə əlavə edildi', ru: 'Раздел добавлен', en: 'Section added' },
];

const buildLookup = (pairs: TranslationPair[], to: 'az' | 'ru' | 'en') => {
  const map = new Map<string, string>();
  pairs.forEach((pair) => {
    const enValue = pair.en || pair.az;
    const localized = to === 'ru' ? pair.ru : to === 'en' ? enValue : pair.az;
    map.set(pair.az, localized);
    map.set(pair.ru, localized);
    map.set(enValue, localized);
  });
  return map;
};

const TO_RU = buildLookup(ADMIN_TEXT_PAIRS, 'ru');
const TO_AZ = buildLookup(ADMIN_TEXT_PAIRS, 'az');
const TO_EN = buildLookup(ADMIN_TEXT_PAIRS, 'en');

export const getLocalizedText = (lang: AdminLanguage, azText: string, ruText: string) =>
  lang === 'ru' ? ruText : lang === 'en' ? translateAdminUiText('en', azText) : azText;

export const translateAdminUiText = (lang: AdminLanguage, value: string): string => {
  const input = String(value ?? '');
  if (!input) return input;
  const match = input.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!match) return input;
  const [, prefix, core, suffix] = match;
  const lookup = lang === 'ru' ? TO_RU : lang === 'en' ? TO_EN : TO_AZ;
  const translated = lookup.get(core);
  if (!translated) {
    if (lang === 'ru') {
      const sectionAddedMatch = core.match(/^Bölmə\s+(\d+)\s+əlavə edildi$/i);
      if (sectionAddedMatch) return `${prefix}Раздел ${sectionAddedMatch[1]} добавлен${suffix}`;
      const sectionMatch = core.match(/^Bölmə\s+(\d+)$/i);
      if (sectionMatch) return `${prefix}Раздел ${sectionMatch[1]}${suffix}`;
      const sectionTitleMatch = core.match(/^Bölmə\s+(\d+)\s+Başlıq$/i);
      if (sectionTitleMatch) return `${prefix}Раздел ${sectionTitleMatch[1]} Заголовок${suffix}`;
      const sectionIconMatch = core.match(/^Bölmə\s+(\d+)\s+İkon$/i);
      if (sectionIconMatch) return `${prefix}Раздел ${sectionIconMatch[1]} Иконка${suffix}`;
      const sectionTextMatch = core.match(/^Bölmə\s+(\d+)\s+Mətn$/i);
      if (sectionTextMatch) return `${prefix}Раздел ${sectionTextMatch[1]} Текст${suffix}`;
      const shownMatch = core.match(/^(\d+)\s+nəticə göstərilir$/i);
      if (shownMatch) return `${prefix}${shownMatch[1]} результатов${suffix}`;
      const optionMatch = core.match(/^Seçim\s+(\d+)$/i);
      if (optionMatch) return `${prefix}Вариант ${optionMatch[1]}${suffix}`;
      const orderMatch = core.match(/^Sıra:\s*(\d+)$/i);
      if (orderMatch) return `${prefix}Ряд: ${orderMatch[1]}${suffix}`;
      const optionFromEn = core.match(/^Option\s+(\d+)$/i);
      if (optionFromEn) return `${prefix}Вариант ${optionFromEn[1]}${suffix}`;
      const orderFromEn = core.match(/^Order:\s*(\d+)$/i);
      if (orderFromEn) return `${prefix}Ряд: ${orderFromEn[1]}${suffix}`;
      const shownFromEn = core.match(/^(\d+)\s+results shown$/i);
      if (shownFromEn) return `${prefix}${shownFromEn[1]} результатов${suffix}`;
    }

    if (lang === 'az') {
      const sectionAddedMatch = core.match(/^Раздел\s+(\d+)\s+добавлен$/i);
      if (sectionAddedMatch) return `${prefix}Bölmə ${sectionAddedMatch[1]} əlavə edildi${suffix}`;
      const sectionMatch = core.match(/^Раздел\s+(\d+)$/i);
      if (sectionMatch) return `${prefix}Bölmə ${sectionMatch[1]}${suffix}`;
      const sectionTitleMatch = core.match(/^Раздел\s+(\d+)\s+Заголовок$/i);
      if (sectionTitleMatch) return `${prefix}Bölmə ${sectionTitleMatch[1]} Başlıq${suffix}`;
      const sectionIconMatch = core.match(/^Раздел\s+(\d+)\s+Иконка$/i);
      if (sectionIconMatch) return `${prefix}Bölmə ${sectionIconMatch[1]} İkon${suffix}`;
      const sectionTextMatch = core.match(/^Раздел\s+(\d+)\s+Текст$/i);
      if (sectionTextMatch) return `${prefix}Bölmə ${sectionTextMatch[1]} Mətn${suffix}`;
      const shownMatch = core.match(/^(\d+)\s+результатов$/i);
      if (shownMatch) return `${prefix}${shownMatch[1]} nəticə göstərilir${suffix}`;
      const optionMatch = core.match(/^Вариант\s+(\d+)$/i);
      if (optionMatch) return `${prefix}Seçim ${optionMatch[1]}${suffix}`;
      const orderMatch = core.match(/^Ряд:\s*(\d+)$/i);
      if (orderMatch) return `${prefix}Sıra: ${orderMatch[1]}${suffix}`;
      const optionFromEn = core.match(/^Option\s+(\d+)$/i);
      if (optionFromEn) return `${prefix}Seçim ${optionFromEn[1]}${suffix}`;
      const orderFromEn = core.match(/^Order:\s*(\d+)$/i);
      if (orderFromEn) return `${prefix}Sıra: ${orderFromEn[1]}${suffix}`;
      const shownFromEn = core.match(/^(\d+)\s+results shown$/i);
      if (shownFromEn) return `${prefix}${shownFromEn[1]} nəticə göstərilir${suffix}`;
    }

    if (lang === 'en') {
      const sectionAddedFromAz = core.match(/^Bölmə\s+(\d+)\s+əlavə edildi$/i);
      if (sectionAddedFromAz) return `${prefix}Section ${sectionAddedFromAz[1]} added${suffix}`;
      const sectionAddedFromRu = core.match(/^Раздел\s+(\d+)\s+добавлен$/i);
      if (sectionAddedFromRu) return `${prefix}Section ${sectionAddedFromRu[1]} added${suffix}`;
      const sectionFromAz = core.match(/^Bölmə\s+(\d+)$/i);
      if (sectionFromAz) return `${prefix}Section ${sectionFromAz[1]}${suffix}`;
      const sectionFromRu = core.match(/^Раздел\s+(\d+)$/i);
      if (sectionFromRu) return `${prefix}Section ${sectionFromRu[1]}${suffix}`;
      const sectionTitleFromAz = core.match(/^Bölmə\s+(\d+)\s+Başlıq$/i);
      if (sectionTitleFromAz) return `${prefix}Section ${sectionTitleFromAz[1]} Title${suffix}`;
      const sectionTitleFromRu = core.match(/^Раздел\s+(\d+)\s+Заголовок$/i);
      if (sectionTitleFromRu) return `${prefix}Section ${sectionTitleFromRu[1]} Title${suffix}`;
      const sectionIconFromAz = core.match(/^Bölmə\s+(\d+)\s+İkon$/i);
      if (sectionIconFromAz) return `${prefix}Section ${sectionIconFromAz[1]} Icon${suffix}`;
      const sectionIconFromRu = core.match(/^Раздел\s+(\d+)\s+Иконка$/i);
      if (sectionIconFromRu) return `${prefix}Section ${sectionIconFromRu[1]} Icon${suffix}`;
      const sectionTextFromAz = core.match(/^Bölmə\s+(\d+)\s+Mətn$/i);
      if (sectionTextFromAz) return `${prefix}Section ${sectionTextFromAz[1]} Text${suffix}`;
      const sectionTextFromRu = core.match(/^Раздел\s+(\d+)\s+Текст$/i);
      if (sectionTextFromRu) return `${prefix}Section ${sectionTextFromRu[1]} Text${suffix}`;
      const shownFromAz = core.match(/^(\d+)\s+nəticə göstərilir$/i);
      if (shownFromAz) return `${prefix}${shownFromAz[1]} results shown${suffix}`;
      const shownFromRu = core.match(/^(\d+)\s+результатов$/i);
      if (shownFromRu) return `${prefix}${shownFromRu[1]} results shown${suffix}`;
      const optionFromAz = core.match(/^Seçim\s+(\d+)$/i);
      if (optionFromAz) return `${prefix}Option ${optionFromAz[1]}${suffix}`;
      const optionFromRu = core.match(/^Вариант\s+(\d+)$/i);
      if (optionFromRu) return `${prefix}Option ${optionFromRu[1]}${suffix}`;
      const orderFromAz = core.match(/^Sıra:\s*(\d+)$/i);
      if (orderFromAz) return `${prefix}Order: ${orderFromAz[1]}${suffix}`;
      const orderFromRu = core.match(/^Ряд:\s*(\d+)$/i);
      if (orderFromRu) return `${prefix}Order: ${orderFromRu[1]}${suffix}`;
    }

    return input;
  }
  return `${prefix}${translated}${suffix}`;
};

export const getAdminLanguageLabel = (lang: AdminLanguage) =>
  lang === 'ru' ? 'Русский' : (lang === 'en' ? 'English' : 'Azərbaycan');

export const getStoredAdminLanguage = (): AdminLanguage => {
  if (typeof window === 'undefined') return 'az';
  const saved = window.localStorage.getItem(ADMIN_LANGUAGE_STORAGE_KEY);
  if (saved === 'ru') return 'ru';
  if (saved === 'en') return 'en';
  return 'az';
};

export const setStoredAdminLanguage = (lang: AdminLanguage) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ADMIN_LANGUAGE_STORAGE_KEY, lang);
};

export const getSidebarUiLabel = (
  lang: AdminLanguage,
  key: keyof (typeof sidebarUiLabels)['az']
) => sidebarUiLabels[lang][key];

export const translateSidebarTitle = (title: string, path: string | undefined, lang: AdminLanguage) => {
  const normalizedTitle = normalizeText(title);
  const normalizedPath = normalizeSidebarPathKey(path);

  if (lang === 'ru') {
    const byPath = pathMapRu[normalizedPath];
    if (byPath) return byPath;
    const byTitle = titleMapRu[normalizedTitle];
    if (byTitle) return byTitle;
    return title;
  }

  if (lang === 'en') {
    const byPath = pathMapEn[normalizedPath];
    if (byPath) return byPath;
    const byTitle = titleMapEn[normalizedTitle];
    if (byTitle) return byTitle;
    return title;
  }

  const byPath = pathMapAz[normalizedPath];
  if (byPath) return byPath;
  const byTitle = titleMapAz[normalizedTitle];
  if (byTitle) return byTitle;
  return title;
};
