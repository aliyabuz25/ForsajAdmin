import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Globe2, Loader2, RefreshCw, Save, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import type { AdminLanguage } from '../utils/adminLanguage';
import { getLocalizedText } from '../utils/adminLanguage';
import { clearAdminSession, getAuthToken } from '../utils/session';
import './TranslationsManager.css';

type SiteLanguage = 'AZ' | 'RU' | 'ENG';

interface LocalizationEntry {
    AZ: string;
    RU: string;
    ENG: string;
}

interface LocalizationPayload {
    schemaVersion: number;
    generatedAt: string;
    languages: SiteLanguage[];
    pages: Record<string, Record<string, LocalizationEntry>>;
}

interface LocalizationUsagePage {
    keys: string[];
    prefixes?: string[];
}

interface LocalizationUsageMap {
    [pageId: string]: {
        keys: Set<string>;
        prefixes: string[];
    };
}

interface TranslationsManagerProps {
    language: AdminLanguage;
}

interface PageLabelMeta {
    az: string;
    ru: string;
    descriptionAz: string;
    descriptionRu: string;
}

const DEFAULT_PAYLOAD: LocalizationPayload = {
    schemaVersion: 1,
    generatedAt: '',
    languages: ['AZ', 'RU', 'ENG'],
    pages: {}
};
const CONTENT_VERSION_KEY = 'forsaj_site_content_version';
const PAGE_META: Record<string, PageLabelMeta> = {
    about: {
        az: 'Haqqımızda',
        ru: 'О нас',
        descriptionAz: 'Klub və missiya məzmunu',
        descriptionRu: 'Контент о клубе и миссии'
    },
    admin_sidebar: {
        az: 'Admin Menyu',
        ru: 'Админ-меню',
        descriptionAz: 'Admin panel yan menyusu',
        descriptionRu: 'Боковое меню админ-панели'
    },
    app: {
        az: 'Tətbiq',
        ru: 'Приложение',
        descriptionAz: 'Ümumi tətbiq mətnləri',
        descriptionRu: 'Общие тексты приложения'
    },
    categoryleaders: {
        az: 'Kateqoriya liderləri',
        ru: 'Лидеры категорий',
        descriptionAz: 'Ana səhifə lider blokları',
        descriptionRu: 'Блок лидеров на главной'
    },
    contactpage: {
        az: 'Əlaqə səhifəsi',
        ru: 'Страница контактов',
        descriptionAz: 'Əlaqə məlumatları və forma',
        descriptionRu: 'Контакты и форма связи'
    },
    driverspage: {
        az: 'Sürücülər səhifəsi',
        ru: 'Страница пилотов',
        descriptionAz: 'Pilot reytinqi və siyahı',
        descriptionRu: 'Рейтинг и список пилотов'
    },
    eventspage: {
        az: 'Tədbirlər səhifəsi',
        ru: 'Страница событий',
        descriptionAz: 'Yarış təqvimi və qeydiyyat',
        descriptionRu: 'Календарь и регистрация'
    },
    footer: {
        az: 'Footer',
        ru: 'Футер',
        descriptionAz: 'Alt hissə mətnləri',
        descriptionRu: 'Тексты нижней части сайта'
    },
    gallerypage: {
        az: 'Qalereya səhifəsi',
        ru: 'Страница галереи',
        descriptionAz: 'Foto və video arxiv',
        descriptionRu: 'Фото и видео архив'
    },
    general: {
        az: 'Ümumi',
        ru: 'Общие',
        descriptionAz: 'Qlobal açarlar və SEO',
        descriptionRu: 'Глобальные ключи и SEO'
    },
    hero: {
        az: 'Hero bloku',
        ru: 'Hero-блок',
        descriptionAz: 'Ana banner mətnləri',
        descriptionRu: 'Тексты главного баннера'
    },
    marquee: {
        az: 'Marquee',
        ru: 'Бегущая строка',
        descriptionAz: 'Üst hərəkətli yazı',
        descriptionRu: 'Верхняя бегущая строка'
    },
    navbar: {
        az: 'Naviqasiya paneli',
        ru: 'Панель навигации',
        descriptionAz: 'Baş menyu və linklər',
        descriptionRu: 'Главное меню и ссылки'
    },
    news: {
        az: 'Xəbərlər bölməsi',
        ru: 'Блок новостей',
        descriptionAz: 'Ana səhifə xəbər bloku',
        descriptionRu: 'Новостной блок на главной'
    },
    newspage: {
        az: 'Xəbər səhifəsi',
        ru: 'Страница новости',
        descriptionAz: 'Xəbər detallar səhifəsi',
        descriptionRu: 'Страница деталей новости'
    },
    nextrace: {
        az: 'Növbəti yarış',
        ru: 'Следующая гонка',
        descriptionAz: 'Növbəti yarış kartı',
        descriptionRu: 'Карточка ближайшей гонки'
    },
    partners: {
        az: 'Partnyorlar',
        ru: 'Партнеры',
        descriptionAz: 'Partnyor loqoları və adlar',
        descriptionRu: 'Логотипы и названия партнеров'
    },
    privacypolicypage: {
        az: 'Məxfilik siyasəti',
        ru: 'Политика конфиденциальности',
        descriptionAz: 'Hüquqi mətnlər (privacy)',
        descriptionRu: 'Юридические тексты (privacy)'
    },
    rulespage: {
        az: 'Qaydalar səhifəsi',
        ru: 'Страница правил',
        descriptionAz: 'Pilot və texniki qaydalar',
        descriptionRu: 'Пилотные и технические правила'
    },
    termsofservicepage: {
        az: 'Xidmət şərtləri',
        ru: 'Условия использования',
        descriptionAz: 'Hüquqi mətnlər (terms)',
        descriptionRu: 'Юридические тексты (terms)'
    },
    videoarchive: {
        az: 'Video arxiv',
        ru: 'Видеоархив',
        descriptionAz: 'Yarış video bölməsi',
        descriptionRu: 'Раздел видеоматериалов'
    },
    whatisoffroad: {
        az: 'Offroad nədir',
        ru: 'Что такое offroad',
        descriptionAz: 'Offroad izah bölməsi',
        descriptionRu: 'Объяснение дисциплины offroad'
    }
};

const normalizePayload = (raw: any): LocalizationPayload => {
    if (!raw || typeof raw !== 'object') return DEFAULT_PAYLOAD;

    const rawPages = raw.pages && typeof raw.pages === 'object' ? raw.pages : {};
    const pages: Record<string, Record<string, LocalizationEntry>> = {};

    for (const [rawPageId, rawEntries] of Object.entries(rawPages as Record<string, any>)) {
        const pageId = String(rawPageId || '').trim().toLowerCase();
        if (!pageId || !rawEntries || typeof rawEntries !== 'object') continue;

        const normalizedEntries: Record<string, LocalizationEntry> = {};
        for (const [rawKey, rawEntry] of Object.entries(rawEntries as Record<string, any>)) {
            const key = String(rawKey || '').trim();
            if (!key) continue;

            const entry = rawEntry && typeof rawEntry === 'object'
                ? rawEntry
                : { AZ: String(rawEntry || '') };

            normalizedEntries[key] = {
                AZ: String(entry.AZ ?? entry.az ?? ''),
                RU: String(entry.RU ?? entry.ru ?? ''),
                ENG: String(entry.ENG ?? entry.EN ?? entry.en ?? '')
            };
        }

        pages[pageId] = normalizedEntries;
    }

    return {
        schemaVersion: Number(raw.schemaVersion) || 1,
        generatedAt: String(raw.generatedAt || ''),
        languages: ['AZ', 'RU', 'ENG'],
        pages
    };
};

const hasPayloadPages = (payload: LocalizationPayload) =>
    Object.values(payload.pages || {}).some((entries) => Object.keys(entries || {}).length > 0);

const mergePayload = (base: LocalizationPayload, override: LocalizationPayload): LocalizationPayload => {
    const mergedPages: LocalizationPayload['pages'] = { ...base.pages };

    for (const [pageId, overrideEntries] of Object.entries(override.pages || {})) {
        const baseEntries = mergedPages[pageId] || {};
        const nextEntries: Record<string, LocalizationEntry> = { ...baseEntries };

        for (const [key, overrideEntry] of Object.entries(overrideEntries || {})) {
            const baseEntry = baseEntries[key] || { AZ: '', RU: '', ENG: '' };
            nextEntries[key] = {
                AZ: String(overrideEntry.AZ ?? baseEntry.AZ ?? ''),
                RU: String(overrideEntry.RU ?? baseEntry.RU ?? ''),
                ENG: String(overrideEntry.ENG ?? baseEntry.ENG ?? '')
            };
        }

        mergedPages[pageId] = nextEntries;
    }

    return {
        schemaVersion: Number(override.schemaVersion) || Number(base.schemaVersion) || 1,
        generatedAt: String(override.generatedAt || base.generatedAt || ''),
        languages: ['AZ', 'RU', 'ENG'],
        pages: mergedPages
    };
};

const prettyPageName = (pageId: string) =>
    String(pageId || '')
        .replace(/[-_]+/g, ' ')
        .replace(/(page)$/i, ' page')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());

const getPageDisplayName = (pageId: string, language: AdminLanguage) => {
    const meta = PAGE_META[String(pageId || '').trim().toLowerCase()];
    if (!meta) return prettyPageName(pageId);
    return language === 'ru' ? meta.ru : meta.az;
};

const getPageDisplayDescription = (pageId: string, language: AdminLanguage) => {
    const meta = PAGE_META[String(pageId || '').trim().toLowerCase()];
    if (!meta) return String(pageId || '').trim();
    return language === 'ru' ? meta.descriptionRu : meta.descriptionAz;
};

const isUnderscorePlaceholder = (value: unknown) => {
    const text = String(value || '').trim();
    if (!text || !text.includes('_')) return false;
    return /^[A-Za-z0-9_]+$/.test(text);
};

const isHeaderLikeKey = (key: string) => /^[A-Z][A-Za-z0-9]*(?:-[A-Z][A-Za-z0-9]*)+$/.test(key);

const shouldHideTranslationEntry = (entry?: LocalizationEntry | null) => {
    if (!entry) return false;
    return [entry.AZ, entry.RU, entry.ENG].some((value) => isUnderscorePlaceholder(value));
};

const shouldHideTranslationKey = (key: string, entry?: LocalizationEntry | null) => {
    const normalizedKey = String(key || '').trim();
    if (!normalizedKey) return true;
    if (isHeaderLikeKey(normalizedKey)) return true;
    return shouldHideTranslationEntry(entry);
};

const normalizeUsagePayload = (raw: any): LocalizationUsageMap => {
    if (!raw || typeof raw !== 'object') return {};
    const pages = raw.pages && typeof raw.pages === 'object' ? raw.pages : {};
    const normalized: LocalizationUsageMap = {};

    for (const [rawPageId, rawPageUsage] of Object.entries(pages as Record<string, any>)) {
        const pageId = String(rawPageId || '').trim().toLowerCase();
        if (!pageId || !rawPageUsage || typeof rawPageUsage !== 'object') continue;

        const rawKeys = Array.isArray((rawPageUsage as LocalizationUsagePage).keys)
            ? (rawPageUsage as LocalizationUsagePage).keys
            : [];
        const rawPrefixes: string[] = Array.isArray((rawPageUsage as LocalizationUsagePage).prefixes)
            ? ((rawPageUsage as LocalizationUsagePage).prefixes as string[])
            : [];

        normalized[pageId] = {
            keys: new Set(
                rawKeys
                    .map((key) => String(key || '').trim())
                    .filter(Boolean)
            ),
            prefixes: rawPrefixes
                .map((prefix) => String(prefix || '').trim())
                .filter(Boolean)
        };
    }

    return normalized;
};

const isKeyActiveInPage = (usageMap: LocalizationUsageMap, pageId: string, key: string) => {
    const usage = usageMap[String(pageId || '').trim().toLowerCase()];
    if (!usage) return true;
    if (usage.keys.has(key)) return true;
    return usage.prefixes.some((prefix) => key.startsWith(prefix));
};

const TranslationsManager: React.FC<TranslationsManagerProps> = ({ language }) => {
    const [payload, setPayload] = useState<LocalizationPayload>(DEFAULT_PAYLOAD);
    const [usageMap, setUsageMap] = useState<LocalizationUsageMap>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [selectedPage, setSelectedPage] = useState('');
    const [selectedLang, setSelectedLang] = useState<SiteLanguage>(language === 'ru' ? 'RU' : 'AZ');
    const [search, setSearch] = useState('');
    const [pageSearch, setPageSearch] = useState('');
    const [showOnlyMissing, setShowOnlyMissing] = useState(false);
    const [showOnlyActiveKeys, setShowOnlyActiveKeys] = useState(false);

    const t = {
        title: getLocalizedText(language, 'Translations', 'Переводы'),
        subtitle: getLocalizedText(language, 'Bütün localization açarlarını dilə görə buradan redaktə edin', 'Редактируйте все ключи локализации по языкам'),
        loading: getLocalizedText(language, 'Yüklənir...', 'Загрузка...'),
        save: getLocalizedText(language, 'Yadda Saxla', 'Сохранить'),
        refresh: getLocalizedText(language, 'Yenilə', 'Обновить'),
        saved: getLocalizedText(language, 'Localization yadda saxlanıldı', 'Локализация сохранена'),
        saveError: getLocalizedText(language, 'Localization saxlanarkən xəta baş verdi', 'Ошибка сохранения локализации'),
        loadError: getLocalizedText(language, 'Localization yüklənərkən xəta baş verdi', 'Ошибка загрузки локализации'),
        page: getLocalizedText(language, 'Səhifələr', 'Страницы'),
        key: getLocalizedText(language, 'Açar', 'Ключ'),
        value: getLocalizedText(language, 'Dəyər', 'Значение'),
        sourceAz: getLocalizedText(language, 'AZ mənbə mətni', 'Исходный текст AZ'),
        pageSearch: getLocalizedText(language, 'Səhifə axtar...', 'Поиск страницы...'),
        search: getLocalizedText(language, 'Açar və ya mətn üzrə axtar...', 'Поиск по ключу или тексту...'),
        onlyMissing: getLocalizedText(language, 'Yalnız boş olanlar', 'Только пустые'),
        onlyActiveKeys: getLocalizedText(language, 'Yalnız aktiv açarlar', 'Только активные ключи'),
        noData: getLocalizedText(language, 'Məlumat tapılmadı', 'Данные не найдены'),
        noPageSelected: getLocalizedText(language, 'Səhifə seçin', 'Выберите страницу'),
        changed: getLocalizedText(language, 'Dəyişikliklər var', 'Есть несохраненные изменения'),
        upToDate: getLocalizedText(language, 'Hamısı aktualdır', 'Все изменения сохранены'),
        fillMissing: getLocalizedText(language, 'Boş xanaları AZ ilə doldur', 'Заполнить пустые значения из AZ'),
        countLabel: getLocalizedText(language, 'açar', 'ключей'),
        pageListInfo: getLocalizedText(language, 'səhifə', 'страниц'),
        completionShort: getLocalizedText(language, 'tamamlanma', 'заполнено'),
        idLabel: 'ID',
        sessionExpired: getLocalizedText(language, 'Sessiya bitib. Yenidən daxil olun.', 'Сессия истекла. Войдите снова.')
    };

    const allPageIds = useMemo(
        () => Object.keys(payload.pages || {}).sort((a, b) => a.localeCompare(b, 'en')),
        [payload]
    );

    const currentEntries = useMemo(
        () => (selectedPage ? payload.pages[selectedPage] || {} : {}),
        [payload, selectedPage]
    );

    const getPageVisibleKeys = (
        entries: Record<string, LocalizationEntry>,
        pageId: string,
        activeOnly: boolean
    ) =>
        Object.keys(entries).filter((key) => {
            const entry = entries[key];
            if (!entry) return false;
            if (shouldHideTranslationKey(key, entry)) return false;
            if (activeOnly && !isKeyActiveInPage(usageMap, pageId, key)) return false;
            return true;
        });

    const pageVisibleCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const pageId of allPageIds) {
            const entries = payload.pages[pageId] || {};
            counts[pageId] = getPageVisibleKeys(entries || {}, pageId, showOnlyActiveKeys).length;
        }
        return counts;
    }, [allPageIds, payload.pages, showOnlyActiveKeys, usageMap]);

    const pageCompletionById = useMemo(() => {
        const completionById: Record<string, number> = {};
        for (const pageId of allPageIds) {
            const entries = payload.pages[pageId] || {};
            const keys = getPageVisibleKeys(entries || {}, pageId, showOnlyActiveKeys);
            if (!keys.length) {
                completionById[pageId] = 0;
                continue;
            }
            const translated = keys.filter((key) => String(entries[key]?.[selectedLang] || '').trim()).length;
            completionById[pageId] = Math.round((translated / keys.length) * 100);
        }
        return completionById;
    }, [allPageIds, payload.pages, selectedLang, showOnlyActiveKeys, usageMap]);

    const pageCards = useMemo(() => {
        const query = pageSearch.trim().toLowerCase();
        const cards = allPageIds
            .map((pageId) => {
                const name = getPageDisplayName(pageId, language);
                const description = getPageDisplayDescription(pageId, language);
                const count = pageVisibleCounts[pageId] ?? 0;
                const completionPercent = pageCompletionById[pageId] ?? 0;
                return { pageId, name, description, count, completionPercent };
            })
            .filter((card) => card.count > 0);

        if (!query) return cards;

        return cards.filter((card) =>
            `${card.pageId} ${card.name} ${card.description}`.toLowerCase().includes(query)
        );
    }, [allPageIds, language, pageCompletionById, pageSearch, pageVisibleCounts]);

    const pageIds = useMemo(() => pageCards.map((card) => card.pageId), [pageCards]);
    const pageVisibleTotalKeys = useMemo(
        () => pageCards.reduce((sum, card) => sum + card.count, 0),
        [pageCards]
    );

    useEffect(() => {
        if (!pageIds.length) {
            if (selectedPage) setSelectedPage('');
            return;
        }
        if (!selectedPage || !pageIds.includes(selectedPage)) {
            setSelectedPage(pageIds[0]);
        }
    }, [pageIds, selectedPage]);

    const visibleKeys = useMemo(() => {
        const query = search.trim().toLowerCase();
        const keys = getPageVisibleKeys(currentEntries, selectedPage, showOnlyActiveKeys);
        return keys
            .sort((a, b) => a.localeCompare(b, 'en'))
            .filter((key) => {
                const entry = currentEntries[key];
                if (!entry) return false;
                const currentValue = String(entry[selectedLang] || '').trim();
                if (showOnlyMissing && currentValue) return false;
                if (!query) return true;

                const haystack = [
                    key,
                    entry.AZ,
                    entry.RU,
                    entry.ENG
                ]
                    .join(' ')
                    .toLowerCase();

                return haystack.includes(query);
            });
    }, [currentEntries, search, selectedLang, selectedPage, showOnlyActiveKeys, showOnlyMissing, usageMap]);

    const completion = useMemo(() => {
        const keys = getPageVisibleKeys(currentEntries, selectedPage, showOnlyActiveKeys);
        if (!keys.length) return 0;
        const translated = keys.filter((key) => String(currentEntries[key]?.[selectedLang] || '').trim()).length;
        return Math.round((translated / keys.length) * 100);
    }, [currentEntries, selectedLang, selectedPage, showOnlyActiveKeys, usageMap]);

    const fetchLocalization = async () => {
        setLoading(true);
        try {
            const token = getAuthToken();
            let apiPayload = DEFAULT_PAYLOAD;
            let usage: LocalizationUsageMap = {};
            const response = await fetch('/api/localization', {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined
            });
            if (!response.ok) throw new Error('load_failed');
            const data = await response.json();
            apiPayload = normalizePayload(data);

            try {
                const usageResponse = await fetch('/api/localization-usage');
                if (usageResponse.ok) {
                    const usagePayload = await usageResponse.json();
                    usage = normalizeUsagePayload(usagePayload);
                }
            } catch {
                // optional usage source
            }

            let staticPayload = DEFAULT_PAYLOAD;
            try {
                const staticResponse = await fetch('/localization.json');
                if (staticResponse.ok) {
                    const staticData = await staticResponse.json();
                    staticPayload = normalizePayload(staticData);
                }
            } catch {
                // optional fallback source
            }

            const merged = hasPayloadPages(staticPayload)
                ? mergePayload(staticPayload, apiPayload)
                : apiPayload;

            setPayload(merged);
            setUsageMap(usage);
            setDirty(false);
        } catch (error) {
            console.error(error);
            toast.error(t.loadError);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLocalization();
    }, []);

    const updateEntry = (key: string, value: string) => {
        if (!selectedPage) return;
        setPayload((prev) => {
            const currentPage = prev.pages[selectedPage] || {};
            const currentEntry = currentPage[key] || { AZ: '', RU: '', ENG: '' };
            return {
                ...prev,
                pages: {
                    ...prev.pages,
                    [selectedPage]: {
                        ...currentPage,
                        [key]: {
                            ...currentEntry,
                            [selectedLang]: value
                        }
                    }
                }
            };
        });
        setDirty(true);
    };

    const fillMissingWithAz = () => {
        if (!selectedPage || selectedLang === 'AZ') return;
        setPayload((prev) => {
            const currentPage = prev.pages[selectedPage] || {};
            const nextPage: Record<string, LocalizationEntry> = {};
            for (const [key, entry] of Object.entries(currentPage)) {
                const currentValue = String(entry[selectedLang] || '').trim();
                nextPage[key] = {
                    ...entry,
                    [selectedLang]: currentValue ? entry[selectedLang] : entry.AZ
                };
            }
            return {
                ...prev,
                pages: {
                    ...prev.pages,
                    [selectedPage]: nextPage
                }
            };
        });
        setDirty(true);
    };

    const saveLocalization = async () => {
        if (!dirty) return;
        setSaving(true);
        try {
            const token = getAuthToken();
            const response = await fetch('/api/localization', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    clearAdminSession();
                    throw new Error('session_expired');
                }
                const details = await response.text().catch(() => '');
                throw new Error(details || 'save_failed');
            }

            const result = await response.json();
            if (result?.data) {
                setPayload(normalizePayload(result.data));
            }
            setDirty(false);
            const saveVersion = Date.now().toString();
            localStorage.setItem(CONTENT_VERSION_KEY, saveVersion);
            window.dispatchEvent(new CustomEvent('forsaj-localization-ready'));
            toast.success(t.saved);
        } catch (error) {
            console.error(error);
            if (error instanceof Error && error.message === 'session_expired') {
                toast.error(t.sessionExpired);
            } else {
                toast.error(t.saveError);
            }
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="translations-loading fade-in">
                <Loader2 size={22} className="spin" />
                <span>{t.loading}</span>
            </div>
        );
    }

    return (
        <div className="translations-manager fade-in">
            <div className="translations-header">
                <div>
                    <h1>{t.title}</h1>
                    <p>{t.subtitle}</p>
                </div>
                <div className="translations-header-actions">
                    <button type="button" className="btn-secondary" onClick={fetchLocalization}>
                        <RefreshCw size={16} />
                        <span>{t.refresh}</span>
                    </button>
                    <button type="button" className="btn-primary" onClick={saveLocalization} disabled={!dirty || saving}>
                        {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                        <span>{t.save}</span>
                    </button>
                </div>
            </div>

            <div className="translations-status">
                {dirty ? (
                    <span className="status-chip status-dirty">{t.changed}</span>
                ) : (
                    <span className="status-chip status-clean">
                        <CheckCircle2 size={14} />
                        {t.upToDate}
                    </span>
                )}
                <span className="status-chip">
                    <Globe2 size={14} />
                    {selectedLang}: {completion}%
                </span>
            </div>

            <div className="translations-body">
                <aside className="translations-pages">
                    <div className="panel-title-row">
                        <div className="panel-title">{t.page}</div>
                        <span className="panel-pill">{pageCards.length}/{allPageIds.length} {t.pageListInfo}</span>
                    </div>
                    <div className="panel-subtitle">{pageVisibleTotalKeys} {t.countLabel}</div>
                    <div className="page-search">
                        <Search size={15} />
                        <input
                            value={pageSearch}
                            onChange={(event) => setPageSearch(event.target.value)}
                            placeholder={t.pageSearch}
                        />
                    </div>
                    <div className="page-list">
                        {pageCards.map((card) => {
                            return (
                                <button
                                    key={card.pageId}
                                    type="button"
                                    className={`page-item ${selectedPage === card.pageId ? 'active' : ''}`}
                                    onClick={() => setSelectedPage(card.pageId)}
                                >
                                    <span className="page-item-head">
                                        <span className="page-item-name">{card.name}</span>
                                        <span className="page-item-count">{card.count} {t.countLabel}</span>
                                    </span>
                                    <span className="page-item-meta">{card.description}</span>
                                    <span className="page-item-id">{t.idLabel}: {card.pageId}</span>
                                    <span className="page-item-progress" aria-hidden="true">
                                        <span style={{ width: `${card.completionPercent}%` }} />
                                    </span>
                                    <span className="page-item-progress-text">{selectedLang}: {card.completionPercent}% {t.completionShort}</span>
                                </button>
                            );
                        })}
                        {!pageCards.length && <div className="empty-state">{t.noData}</div>}
                    </div>
                </aside>

                <section className="translations-editor">
                    {!selectedPage ? (
                        <div className="empty-state">{t.noPageSelected}</div>
                    ) : (
                        <>
                            <div className="editor-toolbar">
                                <div className="lang-tabs">
                                    {(['AZ', 'RU', 'ENG'] as SiteLanguage[]).map((langTab) => (
                                        <button
                                            key={langTab}
                                            type="button"
                                            className={`lang-tab ${selectedLang === langTab ? 'active' : ''}`}
                                            onClick={() => setSelectedLang(langTab)}
                                        >
                                            {langTab}
                                        </button>
                                    ))}
                                </div>
                                <div className="toolbar-search">
                                    <Search size={16} />
                                    <input
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        placeholder={t.search}
                                    />
                                </div>
                                <label className="missing-toggle">
                                    <input
                                        type="checkbox"
                                        checked={showOnlyMissing}
                                        onChange={(event) => setShowOnlyMissing(event.target.checked)}
                                    />
                                    <span>{t.onlyMissing}</span>
                                </label>
                                <label className="missing-toggle">
                                    <input
                                        type="checkbox"
                                        checked={showOnlyActiveKeys}
                                        onChange={(event) => setShowOnlyActiveKeys(event.target.checked)}
                                    />
                                    <span>{t.onlyActiveKeys}</span>
                                </label>
                                {selectedLang !== 'AZ' && (
                                    <button type="button" className="btn-secondary" onClick={fillMissingWithAz}>
                                        {t.fillMissing}
                                    </button>
                                )}
                            </div>

                            <div className="translation-list">
                                {!visibleKeys.length ? (
                                    <div className="empty-state">{t.noData}</div>
                                ) : (
                                    visibleKeys.map((key) => {
                                        const entry = currentEntries[key];
                                        return (
                                            <div className="translation-row" key={key}>
                                                <div className="translation-meta">
                                                    <div className="translation-key">{key}</div>
                                                    {selectedLang !== 'AZ' && (
                                                        <div className="translation-source">
                                                            <span>{t.sourceAz}</span>
                                                            <p>{entry.AZ}</p>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="translation-input-wrap">
                                                    <label>{t.value}</label>
                                                    <textarea
                                                        value={entry[selectedLang]}
                                                        onChange={(event) => updateEntry(key, event.target.value)}
                                                        rows={selectedLang === 'AZ' ? 2 : 3}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </>
                    )}
                </section>
            </div>
        </div>
    );
};

export default TranslationsManager;
