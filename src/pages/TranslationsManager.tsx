import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Clipboard, Globe2, Loader2, RefreshCw, Save, Search, Sparkles, Wand2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { AdminLanguage } from '../utils/adminLanguage';
import { getLocalizedText } from '../utils/adminLanguage';
import { clearAdminSession, getAuthToken } from '../utils/session';
import './TranslationsManager.css';

type SiteLanguage = 'AZ' | 'RU' | 'ENG';
type EditableSiteLanguage = Exclude<SiteLanguage, 'AZ'>;

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
    en?: string;
    descriptionAz: string;
    descriptionRu: string;
    descriptionEn?: string;
}

interface SiteContentPage {
    id: string;
    title: string;
    sortIndex: number;
    orderByKey: Record<string, number>;
}

interface DisplayPagesState {
    pages: Record<string, Record<string, LocalizationEntry>>;
    origins: Record<string, Record<string, string>>;
}

interface TranslationEntryGroup {
    key: string;
    keys: string[];
    entry: LocalizationEntry;
}

interface TranslationEntryBucket {
    signature: string;
    keys: string[];
}

const DEFAULT_PAYLOAD: LocalizationPayload = {
    schemaVersion: 1,
    generatedAt: '',
    languages: ['AZ', 'RU', 'ENG'],
    pages: {}
};
const EDITABLE_LANGUAGES: EditableSiteLanguage[] = ['RU', 'ENG'];
const CONTENT_VERSION_KEY = 'forsaj_site_content_version';
const TRANSLATION_TARGET_BY_LANG: Record<EditableSiteLanguage, 'ru' | 'en'> = {
    RU: 'ru',
    ENG: 'en'
};
const HOME_AGGREGATE_PAGE_IDS = ['home', 'navbar', 'hero', 'marquee', 'categoryleaders', 'nextrace', 'news', 'partners', 'videoarchive', 'footer'];
const PAGE_SORT_ORDER = [
    'home',
    'about',
    'admin_sidebar',
    'app',
    'categoryleaders',
    'contactpage',
    'driverspage',
    'eventspage',
    'footer',
    'gallerypage',
    'general',
    'hero',
    'marquee',
    'navbar',
    'news',
    'newspage',
    'nextrace',
    'partners',
    'privacypolicypage',
    'rulespage',
    'termsofservicepage',
    'videoarchive',
    'whatisoffroad'
] as const;
const PAGE_SORT_INDEX = PAGE_SORT_ORDER.reduce<Record<string, number>>((acc, pageId, index) => {
    acc[pageId] = index;
    return acc;
}, {});
const PAGE_META: Record<string, PageLabelMeta> = {
    about: {
        az: 'Haqqımızda',
        ru: 'О нас',
        descriptionAz: 'Klub və missiya məzmunu',
        descriptionRu: 'Контент о клубе и миссии'
    },
    home: {
        az: 'Ana Səhifə',
        ru: 'Главная',
        en: 'Home',
        descriptionAz: 'Ana səhifənin ümumi blokları',
        descriptionRu: 'Основные блоки главной страницы',
        descriptionEn: 'Main homepage sections'
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
        en: 'Privacy Policy',
        descriptionAz: 'Hüquqi mətnlər (privacy)',
        descriptionRu: 'Юридические тексты (privacy)',
        descriptionEn: 'Legal texts (privacy)'
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
        en: 'Terms of Service',
        descriptionAz: 'Hüquqi mətnlər (terms)',
        descriptionRu: 'Юридические тексты (terms)',
        descriptionEn: 'Legal texts (terms)'
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

const isLikelyLocalizationKey = (value: unknown) => {
    const text = String(value || '').trim();
    if (!text) return false;
    if (isBusinessTranslationKey(text) || isGeneratedTranslationKey(text)) return true;
    return /^[A-Z0-9]+(?:_[A-Z0-9]+)*$/.test(text);
};

const buildSiteContentOrderByKey = (rawSections: any[]) => {
    const orderByKey: Record<string, number> = {};

    rawSections.forEach((section, index) => {
        const candidates = [
            String(section?.id || '').trim(),
            String(section?.label || '').trim(),
            String(section?.value || '').trim()
        ]
            .flatMap((candidate) => {
                if (!candidate) return [];
                const unwrapped = candidate.replace(/^KEY:\s*/i, '').trim();
                return unwrapped && unwrapped !== candidate ? [candidate, unwrapped] : [candidate];
            })
            .filter(Boolean);

        candidates.forEach((candidate) => {
            if (!isLikelyLocalizationKey(candidate)) return;
            if (orderByKey[candidate] !== undefined) return;
            orderByKey[candidate] = index;
        });
    });

    return orderByKey;
};

const normalizeSiteContentPages = (raw: any): SiteContentPage[] => {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((page, index) => ({
            id: String(page?.id || page?.page_id || '').trim().toLowerCase(),
            title: String(page?.title || '').trim(),
            sortIndex: index,
            orderByKey: buildSiteContentOrderByKey(Array.isArray(page?.sections) ? page.sections : [])
        }))
        .filter((page) => page.id);
};

const getPageDisplayName = (
    pageId: string,
    language: AdminLanguage,
    siteContentPages: SiteContentPage[]
) => {
    const meta = PAGE_META[String(pageId || '').trim().toLowerCase()];
    if (meta) {
        if (language === 'ru') return meta.ru;
        if (language === 'en' && meta.en) return meta.en;
        return meta.az;
    }

    const dynamicPage = siteContentPages.find((page) => page.id === String(pageId || '').trim().toLowerCase());
    if (dynamicPage?.title) return dynamicPage.title;
    return prettyPageName(pageId);
};

const getPageDisplayDescription = (
    pageId: string,
    language: AdminLanguage,
    siteContentPages: SiteContentPage[]
) => {
    const meta = PAGE_META[String(pageId || '').trim().toLowerCase()];
    if (meta) {
        if (language === 'ru') return meta.descriptionRu;
        if (language === 'en' && meta.descriptionEn) return meta.descriptionEn;
        return meta.descriptionAz;
    }

    const dynamicPage = siteContentPages.find((page) => page.id === String(pageId || '').trim().toLowerCase());
    if (dynamicPage?.title) {
        return getLocalizedText(language, 'Dinamik səhifə məzmunu', 'Динамический контент страницы');
    }
    return String(pageId || '').trim();
};

const comparePageIds = (
    left: string,
    right: string,
    siteContentOrderById: Record<string, number>
) => {
    const leftIndex = PAGE_SORT_INDEX[left];
    const rightIndex = PAGE_SORT_INDEX[right];

    if (Number.isFinite(leftIndex) && Number.isFinite(rightIndex) && leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
    }
    if (Number.isFinite(leftIndex)) return -1;
    if (Number.isFinite(rightIndex)) return 1;

    const leftContentIndex = siteContentOrderById[left];
    const rightContentIndex = siteContentOrderById[right];

    if (Number.isFinite(leftContentIndex) && Number.isFinite(rightContentIndex) && leftContentIndex !== rightContentIndex) {
        return leftContentIndex - rightContentIndex;
    }
    if (Number.isFinite(leftContentIndex)) return -1;
    if (Number.isFinite(rightContentIndex)) return 1;

    return left.localeCompare(right, 'en');
};

const isUnderscorePlaceholder = (value: unknown) => {
    const text = String(value || '').trim();
    if (!text || !text.includes('_')) return false;
    return /^[A-Za-z0-9_]+$/.test(text);
};

const GENERATED_TRANSLATION_KEY_REGEX = /^(txt|lbl|attr)-/i;
const BUSINESS_KEY_REGEX = /\b[A-Z0-9]+(?:_[A-Z0-9]+)+\b/;

const normalizeComparableText = (value: unknown) =>
    String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLocaleLowerCase('az');

const normalizeSourceComparisonText = (value: unknown) =>
    normalizeComparableText(value)
        .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const collapseRepeatedSourceText = (value: unknown) => {
    const compact = String(value || '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!compact) return '';

    const sentences = compact.match(/[^.!?]+[.!?]?/g)
        ?.map((sentence) => sentence.trim())
        .filter(Boolean) || [];

    if (sentences.length < 2) return compact;

    const comparableSentences = sentences.map(normalizeComparableText);
    for (let blockSize = 1; blockSize <= Math.floor(comparableSentences.length / 2); blockSize += 1) {
        if (comparableSentences.length % blockSize !== 0) continue;

        const pattern = comparableSentences.slice(0, blockSize);
        let matches = true;
        for (let index = blockSize; index < comparableSentences.length; index += blockSize) {
            for (let offset = 0; offset < blockSize; offset += 1) {
                if (comparableSentences[index + offset] !== pattern[offset]) {
                    matches = false;
                    break;
                }
            }
            if (!matches) break;
        }

        if (matches) {
            return sentences.slice(0, blockSize).join(' ').trim();
        }
    }

    return compact;
};

const isGeneratedTranslationKey = (key: string) => GENERATED_TRANSLATION_KEY_REGEX.test(String(key || '').trim());
const isBusinessTranslationKey = (key: string) => BUSINESS_KEY_REGEX.test(String(key || '').trim()) && !isGeneratedTranslationKey(key);
const getEntrySourceSignature = (entry?: LocalizationEntry | null) =>
    normalizeSourceComparisonText(collapseRepeatedSourceText(entry?.AZ || ''));

const getNearDuplicateSourceSignatures = (signature: string) => {
    const variants = new Set<string>();
    let current = String(signature || '').trim();
    if (!current) return variants;
    variants.add(current);

    for (let index = 0; index < 2; index += 1) {
        const next = current.replace(/\s+\p{L}{1,8}$/u, '').trim();
        if (!next || next === current) break;
        if (current.length - next.length > 12) break;
        if (next.length < 18) break;
        variants.add(next);
        current = next;
    }

    return variants;
};

const areSourceSignaturesEquivalent = (left: string, right: string) => {
    const leftValue = String(left || '').trim();
    const rightValue = String(right || '').trim();
    if (!leftValue || !rightValue) return false;
    if (leftValue === rightValue) return true;

    const [shorter, longer] = leftValue.length <= rightValue.length
        ? [leftValue, rightValue]
        : [rightValue, leftValue];

    if (shorter.length < 18) return false;
    if (!longer.startsWith(shorter)) return false;

    const suffix = longer.slice(shorter.length).trim();
    if (!suffix) return true;
    if (suffix.length > 12) return false;
    return suffix.split(' ').filter(Boolean).length <= 2;
};

const getTranslationKeyPriority = (key: string) => {
    const normalizedKey = String(key || '').trim();
    if (!normalizedKey) return 99;
    if (isBusinessTranslationKey(normalizedKey)) return 0;
    if (/^(PAGE_|ABOUT_|NAV_|BTN_|FORM_|RULES_|SECTION_|TOPIC_|PARTNER_|DEPT_|FIELD_|CONTACT_|OFFICE_|ONLINE_|WORK_|LEADER_|EMPTY_|MODAL_|JOIN_|PILOT_|SPECTATOR_|CLUB_|DYNAMIC_|TOTAL_|TYPE_|TAB_|FOOTER_)/.test(normalizedKey)) {
        return 1;
    }
    if (/^(val-|label-stat-|value-stat-|RULE_TAB_|TOPIC_OPTION_)/i.test(normalizedKey)) return 2;
    if (/^txt-/i.test(normalizedKey)) return 3;
    if (/^attr-/i.test(normalizedKey)) return 4;
    if (/^lbl-/i.test(normalizedKey)) return 5;
    return 6;
};

const sortTranslationKeys = (keys: string[]) =>
    [...keys].sort((left, right) => {
        const priorityDiff = getTranslationKeyPriority(left) - getTranslationKeyPriority(right);
        if (priorityDiff !== 0) return priorityDiff;
        return left.localeCompare(right, 'en');
    });

const getBestSourceValue = (
    entries: Record<string, LocalizationEntry>,
    keys: string[]
) => {
    const candidates = keys
        .map((key) => ({
            key,
            value: collapseRepeatedSourceText(entries[key]?.AZ || '').trim()
        }))
        .filter((candidate) => candidate.value);

    if (!candidates.length) return '';

    candidates.sort((left, right) => {
        const lengthDiff = left.value.length - right.value.length;
        if (lengthDiff !== 0) return lengthDiff;
        const priorityDiff = getTranslationKeyPriority(left.key) - getTranslationKeyPriority(right.key);
        if (priorityDiff !== 0) return priorityDiff;
        return left.key.localeCompare(right.key, 'en');
    });

    return candidates[0]?.value || '';
};

const getLocalizedValueScore = (value: string, azValue: string) => {
    const normalizedValue = normalizeComparableText(value);
    if (!normalizedValue || isUnderscorePlaceholder(value)) return 0;
    const normalizedAz = normalizeComparableText(collapseRepeatedSourceText(azValue));
    if (normalizedAz && normalizedValue !== normalizedAz) return 3;
    return 2;
};

const getBestLocalizedValue = (
    entries: Record<string, LocalizationEntry>,
    keys: string[],
    language: EditableSiteLanguage,
    azValue: string
) => {
    const candidates = keys
        .map((key) => ({
            key,
            value: String(entries[key]?.[language] || '')
        }))
        .filter((candidate) => String(candidate.value || '').trim());

    if (!candidates.length) return '';

    candidates.sort((left, right) => {
        const scoreDiff = getLocalizedValueScore(right.value, azValue) - getLocalizedValueScore(left.value, azValue);
        if (scoreDiff !== 0) return scoreDiff;
        const lengthDiff = String(right.value || '').trim().length - String(left.value || '').trim().length;
        if (lengthDiff !== 0) return lengthDiff;
        const priorityDiff = getTranslationKeyPriority(left.key) - getTranslationKeyPriority(right.key);
        if (priorityDiff !== 0) return priorityDiff;
        return left.key.localeCompare(right.key, 'en');
    });

    return candidates[0]?.value || '';
};

const buildMergedLocalizationEntry = (
    entries: Record<string, LocalizationEntry>,
    keys: string[]
): LocalizationEntry => {
    const azValue = getBestSourceValue(entries, keys);
    return {
        AZ: azValue,
        RU: getBestLocalizedValue(entries, keys, 'RU', azValue),
        ENG: getBestLocalizedValue(entries, keys, 'ENG', azValue)
    };
};

const hasTranslatedValue = (entry: LocalizationEntry, language: EditableSiteLanguage) =>
    Boolean(String(entry?.[language] || '').trim());

const isMeaningfulTranslationValue = (value: unknown) => {
    const text = String(value || '').trim();
    if (!text) return false;
    return !isUnderscorePlaceholder(text);
};

const shouldHideTranslationEntry = (entry?: LocalizationEntry | null) => {
    if (!entry) return false;
    return ![entry.AZ, entry.RU, entry.ENG].some((value) => isMeaningfulTranslationValue(value));
};

const shouldHideTranslationKey = (key: string, entry?: LocalizationEntry | null) => {
    const normalizedKey = String(key || '').trim();
    if (!normalizedKey) return true;
    return shouldHideTranslationEntry(entry);
};

const isHtmlTranslationValue = (value: unknown) =>
    /<\/?[a-z][^>]*>/i.test(String(value || '').trim());

const isAutoTranslatableValue = (value: unknown) => {
    const text = String(value || '').trim();
    if (!text || text === '---') return false;
    if (/^https?:\/\//i.test(text)) return false;
    if (/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/i.test(text)) return false;
    if (/^[0-9]+([.,:\/-][0-9]+)*$/.test(text)) return false;
    if (/^(true|false|yes|no|on|off|null|undefined)$/i.test(text)) return false;
    if (isUnderscorePlaceholder(text) || isLikelyLocalizationKey(text)) return false;
    if (/^[A-Z0-9_.\/-]{2,40}$/.test(text)) return false;
    return /[A-Za-zƏəÖöÜüĞğŞşİıÇçА-Яа-я]/.test(text);
};

const buildExistingTranslationLookup = (
    pages: LocalizationPayload['pages'],
    language: EditableSiteLanguage
) => {
    const lookup = new Map<string, string>();

    Object.values(pages || {}).forEach((entries) => {
        Object.values(entries || {}).forEach((entry) => {
            const signature = getEntrySourceSignature(entry);
            const localizedValue = String(entry?.[language] || '').trim();
            if (!signature || !isMeaningfulTranslationValue(localizedValue)) return;

            const existing = lookup.get(signature);
            if (!existing) {
                lookup.set(signature, localizedValue);
                return;
            }

            const nextScore = getLocalizedValueScore(localizedValue, entry?.AZ || '');
            const currentScore = getLocalizedValueScore(existing, entry?.AZ || '');
            if (nextScore > currentScore || (nextScore === currentScore && localizedValue.length > existing.length)) {
                lookup.set(signature, localizedValue);
            }
        });
    });

    return lookup;
};

const getTranslationGroupSortMeta = (
    group: TranslationEntryGroup,
    selectedPage: string,
    origins: DisplayPagesState['origins'],
    siteContentById: Record<string, SiteContentPage>
) => {
    const fallbackPageOrder = HOME_AGGREGATE_PAGE_IDS.length + 1000;
    const best = group.keys.reduce<{
        pageOrder: number;
        keyOrder: number;
        keyPriority: number;
        key: string;
    } | null>((currentBest, key) => {
        const sourcePageId = origins[selectedPage]?.[key] || selectedPage;
        const sourcePage = siteContentById[sourcePageId];
        const aggregateIndex = selectedPage === 'home' ? HOME_AGGREGATE_PAGE_IDS.indexOf(sourcePageId) : -1;
        const pageOrder = aggregateIndex >= 0
            ? aggregateIndex
            : (sourcePageId === selectedPage
                ? 0
                : (Number.isFinite(sourcePage?.sortIndex) ? sourcePage.sortIndex + HOME_AGGREGATE_PAGE_IDS.length : fallbackPageOrder));
        const keyOrder = sourcePage?.orderByKey?.[key] ?? (10000 + getTranslationKeyPriority(key));
        const keyPriority = getTranslationKeyPriority(key);
        const nextValue = { pageOrder, keyOrder, keyPriority, key };

        if (!currentBest) return nextValue;
        if (nextValue.pageOrder !== currentBest.pageOrder) {
            return nextValue.pageOrder < currentBest.pageOrder ? nextValue : currentBest;
        }
        if (nextValue.keyOrder !== currentBest.keyOrder) {
            return nextValue.keyOrder < currentBest.keyOrder ? nextValue : currentBest;
        }
        if (nextValue.keyPriority !== currentBest.keyPriority) {
            return nextValue.keyPriority < currentBest.keyPriority ? nextValue : currentBest;
        }
        return nextValue.key.localeCompare(currentBest.key, 'en') < 0 ? nextValue : currentBest;
    }, null);

    return best || {
        pageOrder: fallbackPageOrder,
        keyOrder: 10000 + getTranslationKeyPriority(group.key),
        keyPriority: getTranslationKeyPriority(group.key),
        key: group.key
    };
};

const compareTranslationGroups = (
    left: TranslationEntryGroup,
    right: TranslationEntryGroup,
    selectedPage: string,
    origins: DisplayPagesState['origins'],
    siteContentById: Record<string, SiteContentPage>
) => {
    const leftMeta = getTranslationGroupSortMeta(left, selectedPage, origins, siteContentById);
    const rightMeta = getTranslationGroupSortMeta(right, selectedPage, origins, siteContentById);

    if (leftMeta.pageOrder !== rightMeta.pageOrder) return leftMeta.pageOrder - rightMeta.pageOrder;
    if (leftMeta.keyOrder !== rightMeta.keyOrder) return leftMeta.keyOrder - rightMeta.keyOrder;
    if (leftMeta.keyPriority !== rightMeta.keyPriority) return leftMeta.keyPriority - rightMeta.keyPriority;
    return leftMeta.key.localeCompare(rightMeta.key, 'en');
};

const getPageVisibleGroups = (
    entries: Record<string, LocalizationEntry>,
    pageId: string,
    usageMap: LocalizationUsageMap,
    activeOnly: boolean
): TranslationEntryGroup[] => {
    const buckets: TranslationEntryBucket[] = [];

    sortTranslationKeys(Object.keys(entries)).forEach((key) => {
        const entry = entries[key];
        if (!entry) return;
        if (shouldHideTranslationKey(key, entry)) return;

        const signature = getEntrySourceSignature(entry) || `key:${key}`;
        const signatureVariants = getNearDuplicateSourceSignatures(signature);
        const existingBucket = buckets.find((bucket) =>
            Array.from(signatureVariants).some((variant) => areSourceSignaturesEquivalent(bucket.signature, variant))
        );

        if (existingBucket) {
            existingBucket.keys.push(key);
            if (signature.length < existingBucket.signature.length) {
                existingBucket.signature = signature;
            }
            return;
        }

        buckets.push({
            signature,
            keys: [key]
        });
    });

    return buckets
        .map((bucket) => {
            const keys = bucket.keys;
            const sortedKeys = sortTranslationKeys(keys);
            const activeKeys = sortedKeys.filter((key) => isKeyActiveInPage(usageMap, pageId, key));
            if (activeOnly && !activeKeys.length) return null;

            const representativePool = activeKeys.length ? activeKeys : sortedKeys;
            const representativeKey = representativePool[0];

            return {
                key: representativeKey,
                keys: sortedKeys,
                entry: buildMergedLocalizationEntry(entries, sortedKeys)
            };
        })
        .filter((group): group is TranslationEntryGroup => Boolean(group));
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

const buildDisplayPagesState = (pages: LocalizationPayload['pages']): DisplayPagesState => {
    const displayPages: DisplayPagesState['pages'] = {};
    const origins: DisplayPagesState['origins'] = {};

    for (const [pageId, entries] of Object.entries(pages || {})) {
        displayPages[pageId] = { ...(entries || {}) };
        origins[pageId] = Object.keys(entries || {}).reduce<Record<string, string>>((acc, key) => {
            acc[key] = pageId;
            return acc;
        }, {});
    }

    const homeEntries: Record<string, LocalizationEntry> = {};
    const homeOrigins: Record<string, string> = {};
    HOME_AGGREGATE_PAGE_IDS.forEach((pageId) => {
        const entries = pages?.[pageId] || {};
        for (const [key, entry] of Object.entries(entries)) {
            if (!homeEntries[key]) {
                homeEntries[key] = entry;
                homeOrigins[key] = pageId;
            }
        }
    });

    displayPages.home = homeEntries;
    origins.home = homeOrigins;

    return { pages: displayPages, origins };
};

const TranslationsManager: React.FC<TranslationsManagerProps> = ({ language }) => {
    const [payload, setPayload] = useState<LocalizationPayload>(DEFAULT_PAYLOAD);
    const [usageMap, setUsageMap] = useState<LocalizationUsageMap>({});
    const [siteContentPages, setSiteContentPages] = useState<SiteContentPage[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [translating, setTranslating] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [selectedPage, setSelectedPage] = useState('');
    const [selectedLang, setSelectedLang] = useState<EditableSiteLanguage>(language === 'ru' ? 'RU' : 'ENG');
    const [search, setSearch] = useState('');
    const [pageSearch, setPageSearch] = useState('');
    const [showOnlyMissing, setShowOnlyMissing] = useState(false);
    const [showOnlyActiveKeys, setShowOnlyActiveKeys] = useState(false);
    const translationInputRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

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
        autoTranslateMissing: getLocalizedText(language, 'Boş xanaları avtomatik çevir', 'Автоперевести пустые значения'),
        autoTranslateDone: getLocalizedText(language, 'Boş tərcümələr tamamlandı', 'Пустые переводы заполнены'),
        autoTranslateError: getLocalizedText(language, 'Avtomatik tərcümə zamanı xəta baş verdi', 'Ошибка при автопереводе'),
        autoTranslateIdle: getLocalizedText(language, 'Boş tərcümə tapılmadı', 'Пустые переводы не найдены'),
        translating: getLocalizedText(language, 'Tərcümə olunur...', 'Выполняется перевод...'),
        selectedPageLabel: getLocalizedText(language, 'Seçilmiş səhifə', 'Выбранная страница'),
        visibleKeysLabel: getLocalizedText(language, 'Görünən açarlar', 'Видимые ключи'),
        translatedLabel: getLocalizedText(language, 'Dolu sahələr', 'Заполненные поля'),
        missingLabel: getLocalizedText(language, 'Boş sahələr', 'Пустые поля'),
        quickActions: getLocalizedText(language, 'Sürətli əməliyyatlar', 'Быстрые действия'),
        rowFillFromAz: getLocalizedText(language, 'AZ-dən doldur', 'Заполнить из AZ'),
        rowCopySource: getLocalizedText(language, 'Mənbəni kopyala', 'Скопировать источник'),
        sourceCopied: getLocalizedText(language, 'Mənbə mətn kopyalandı', 'Исходный текст скопирован'),
        nextMissing: getLocalizedText(language, 'Növbəti boş xana', 'Следующее пустое поле'),
        translationReady: getLocalizedText(language, 'Hazır', 'Готово'),
        translationMissing: getLocalizedText(language, 'Boşdur', 'Пусто'),
        mergedKeys: getLocalizedText(language, 'birləşmiş açar', 'объединенный ключ'),
        editorHint: getLocalizedText(language, 'Açarı redaktə etdikdə eyni mənbəyə bağlı dublikat açarlar birlikdə yenilənir.', 'При редактировании ключа все дубликаты с тем же источником обновляются вместе.'),
        countLabel: getLocalizedText(language, 'açar', 'ключей'),
        pageListInfo: getLocalizedText(language, 'səhifə', 'страниц'),
        completionShort: getLocalizedText(language, 'tamamlanma', 'заполнено'),
        idLabel: 'ID',
        sessionExpired: getLocalizedText(language, 'Sessiya bitib. Yenidən daxil olun.', 'Сессия истекла. Войдите снова.')
    };

    const displayPagesState = useMemo(
        () => buildDisplayPagesState(payload.pages || {}),
        [payload.pages]
    );

    const siteContentById = useMemo(
        () => siteContentPages.reduce<Record<string, SiteContentPage>>((acc, page) => {
            acc[page.id] = page;
            return acc;
        }, {}),
        [siteContentPages]
    );

    const siteContentOrderById = useMemo(
        () => siteContentPages.reduce<Record<string, number>>((acc, page) => {
            acc[page.id] = page.sortIndex;
            return acc;
        }, {}),
        [siteContentPages]
    );

    const allPageIds = useMemo(
        () => Object.keys(displayPagesState.pages || {}).sort((left, right) => comparePageIds(left, right, siteContentOrderById)),
        [displayPagesState, siteContentOrderById]
    );

    const currentEntries = useMemo(
        () => (selectedPage ? displayPagesState.pages[selectedPage] || {} : {}),
        [displayPagesState, selectedPage]
    );

    const currentGroups = useMemo(
        () => getPageVisibleGroups(currentEntries, selectedPage, usageMap, showOnlyActiveKeys),
        [currentEntries, selectedPage, showOnlyActiveKeys, usageMap]
    );

    const currentGroupsByKey = useMemo(
        () => currentGroups.reduce<Record<string, TranslationEntryGroup>>((acc, group) => {
            acc[group.key] = group;
            return acc;
        }, {}),
        [currentGroups]
    );

    const pageVisibleCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const pageId of allPageIds) {
            const entries = displayPagesState.pages[pageId] || {};
            counts[pageId] = getPageVisibleGroups(entries, pageId, usageMap, showOnlyActiveKeys).length;
        }
        return counts;
    }, [allPageIds, displayPagesState.pages, showOnlyActiveKeys, usageMap]);

    const pageCompletionById = useMemo(() => {
        const completionById: Record<string, number> = {};
        for (const pageId of allPageIds) {
            const entries = displayPagesState.pages[pageId] || {};
            const groups = getPageVisibleGroups(entries, pageId, usageMap, showOnlyActiveKeys);
            if (!groups.length) {
                completionById[pageId] = 0;
                continue;
            }
            const translated = groups.filter((group) => String(group.entry[selectedLang] || '').trim()).length;
            completionById[pageId] = Math.round((translated / groups.length) * 100);
        }
        return completionById;
    }, [allPageIds, displayPagesState.pages, selectedLang, showOnlyActiveKeys, usageMap]);

    const pageCards = useMemo(() => {
        const query = pageSearch.trim().toLowerCase();
        const cards = allPageIds
            .map((pageId) => {
                const name = getPageDisplayName(pageId, language, siteContentPages);
                const description = getPageDisplayDescription(pageId, language, siteContentPages);
                const count = pageVisibleCounts[pageId] ?? 0;
                const completionPercent = pageCompletionById[pageId] ?? 0;
                return { pageId, name, description, count, completionPercent };
            });

        if (!query) return cards;

        return cards.filter((card) =>
            `${card.pageId} ${card.name} ${card.description}`.toLowerCase().includes(query)
        );
    }, [allPageIds, language, pageCompletionById, pageSearch, pageVisibleCounts, siteContentPages]);

    const pageIds = useMemo(() => pageCards.map((card) => card.pageId), [pageCards]);
    const selectedPageCard = useMemo(
        () => pageCards.find((card) => card.pageId === selectedPage) || null,
        [pageCards, selectedPage]
    );
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

    const visibleGroups = useMemo(() => {
        const query = search.trim().toLowerCase();
        return [...currentGroups]
            .sort((left, right) =>
                compareTranslationGroups(left, right, selectedPage, displayPagesState.origins, siteContentById)
            )
            .filter((group) => {
                const currentValue = String(group.entry[selectedLang] || '').trim();
                if (showOnlyMissing && currentValue) return false;
                if (!query) return true;

                const haystack = [
                    group.key,
                    group.keys.join(' '),
                    group.entry.AZ,
                    group.entry.RU,
                    group.entry.ENG
                ]
                    .join(' ')
                    .toLowerCase();

                return haystack.includes(query);
            });
    }, [currentGroups, displayPagesState.origins, search, selectedLang, selectedPage, showOnlyMissing, siteContentById]);

    const completion = useMemo(() => {
        if (!currentGroups.length) return 0;
        const translated = currentGroups.filter((group) => hasTranslatedValue(group.entry, selectedLang)).length;
        return Math.round((translated / currentGroups.length) * 100);
    }, [currentGroups, selectedLang]);

    const visibleMissingCount = useMemo(
        () => visibleGroups.filter((group) => !hasTranslatedValue(group.entry, selectedLang)).length,
        [selectedLang, visibleGroups]
    );

    const visibleTranslatedCount = useMemo(
        () => visibleGroups.length - visibleMissingCount,
        [visibleGroups.length, visibleMissingCount]
    );

    const fetchLocalization = async () => {
        setLoading(true);
        try {
            const token = getAuthToken();
            let apiPayload = DEFAULT_PAYLOAD;
            let usage: LocalizationUsageMap = {};
            let nextSiteContentPages: SiteContentPage[] = [];
            const response = await fetch('/api/localization', {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined
            });
            if (!response.ok) throw new Error('load_failed');
            const data = await response.json();
            apiPayload = normalizePayload(data);

            try {
                const siteContentResponse = await fetch('/api/site-content', {
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined
                });
                if (siteContentResponse.ok) {
                    const siteContent = await siteContentResponse.json();
                    nextSiteContentPages = normalizeSiteContentPages(siteContent);
                }
            } catch {
                // optional source
            }

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
            setSiteContentPages(nextSiteContentPages);
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

    useEffect(() => {
        const handleContentRefresh = () => {
            void fetchLocalization();
        };

        const handleStorage = (event: StorageEvent) => {
            if (event.key !== CONTENT_VERSION_KEY) return;
            void fetchLocalization();
        };

        window.addEventListener('forsaj-site-content-ready', handleContentRefresh);
        window.addEventListener('forsaj-localization-ready', handleContentRefresh);
        window.addEventListener('storage', handleStorage);
        return () => {
            window.removeEventListener('forsaj-site-content-ready', handleContentRefresh);
            window.removeEventListener('forsaj-localization-ready', handleContentRefresh);
            window.removeEventListener('storage', handleStorage);
        };
    }, []);

    const updateEntry = (key: string, value: string) => {
        if (!selectedPage) return;
        const targetKeys = currentGroupsByKey[key]?.keys || [key];

        setPayload((prev) => {
            const nextPages = { ...prev.pages };

            targetKeys.forEach((targetKey) => {
                const sourcePageId = displayPagesState.origins[selectedPage]?.[targetKey] || selectedPage;
                const currentPage = nextPages[sourcePageId] || {};
                const currentEntry = currentPage[targetKey] || { AZ: '', RU: '', ENG: '' };
                nextPages[sourcePageId] = {
                    ...currentPage,
                    [targetKey]: {
                        ...currentEntry,
                        [selectedLang]: value
                    }
                };
            });

            return {
                ...prev,
                pages: nextPages
            };
        });
        setDirty(true);
    };

    const fillGroupWithSource = (groupKey: string) => {
        const group = currentGroupsByKey[groupKey];
        if (!group) return;
        updateEntry(groupKey, group.entry.AZ);
    };

    const copySourceText = async (groupKey: string) => {
        const group = currentGroupsByKey[groupKey];
        if (!group) return;

        try {
            await navigator.clipboard.writeText(group.entry.AZ || '');
            toast.success(t.sourceCopied);
        } catch (error) {
            console.error(error);
        }
    };

    const jumpToNextMissing = () => {
        const nextMissingGroup = visibleGroups.find((group) => !hasTranslatedValue(group.entry, selectedLang));
        if (!nextMissingGroup) {
            toast(t.autoTranslateIdle);
            return;
        }

        const target = translationInputRefs.current[nextMissingGroup.key];
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.focus();
    };

    const fillMissingWithAz = () => {
        if (!selectedPage) return;
        setPayload((prev) => {
            const nextPages = { ...prev.pages };
            for (const group of visibleGroups) {
                const fallbackValue = String(group.entry[selectedLang] || '').trim()
                    ? group.entry[selectedLang]
                    : group.entry.AZ;

                group.keys.forEach((key) => {
                    const sourcePageId = displayPagesState.origins[selectedPage]?.[key] || selectedPage;
                    const sourcePage = nextPages[sourcePageId] || {};
                    const sourceEntry = sourcePage[key] || { AZ: '', RU: '', ENG: '' };
                    const currentValue = String(sourceEntry[selectedLang] || '').trim();
                    nextPages[sourcePageId] = {
                        ...sourcePage,
                        [key]: {
                            ...sourceEntry,
                            [selectedLang]: currentValue ? sourceEntry[selectedLang] : fallbackValue
                        }
                    };
                });
            }

            return {
                ...prev,
                pages: nextPages
            };
        });
        setDirty(true);
    };

    const autoTranslateMissing = async () => {
        if (!selectedPage || translating) return;

        const existingTranslations = buildExistingTranslationLookup(payload.pages, selectedLang);
        const updates = new Map<string, { pageId: string; key: string; value: string }>();
        const queuedGroups = new Map<string, { keys: string[]; pageIds: string[]; sourceText: string; format: 'text' | 'html' }[]>();

        visibleGroups.forEach((group) => {
            const currentValue = String(group.entry[selectedLang] || '').trim();
            if (currentValue) return;

            const sourceText = collapseRepeatedSourceText(group.entry.AZ).trim();
            if (!sourceText) return;

            const signature = getEntrySourceSignature(group.entry);
            const existingValue = signature ? existingTranslations.get(signature) : '';

            if (existingValue) {
                group.keys.forEach((key) => {
                    const pageId = displayPagesState.origins[selectedPage]?.[key] || selectedPage;
                    updates.set(`${pageId}:${key}`, { pageId, key, value: existingValue });
                });
                return;
            }

            if (!isAutoTranslatableValue(sourceText)) {
                group.keys.forEach((key) => {
                    const pageId = displayPagesState.origins[selectedPage]?.[key] || selectedPage;
                    updates.set(`${pageId}:${key}`, { pageId, key, value: sourceText });
                });
                return;
            }

            const format = isHtmlTranslationValue(sourceText) ? 'html' : 'text';
            const queueKey = `${format}:${sourceText}`;
            const queued = queuedGroups.get(queueKey) || [];
            queued.push({
                keys: group.keys,
                pageIds: group.keys.map((key) => displayPagesState.origins[selectedPage]?.[key] || selectedPage),
                sourceText,
                format
            });
            queuedGroups.set(queueKey, queued);
        });

        if (!queuedGroups.size && !updates.size) {
            toast(t.autoTranslateIdle);
            return;
        }

        setTranslating(true);
        try {
            const token = getAuthToken();
            const translateChunk = async (texts: string[], format: 'text' | 'html') => {
                const response = await fetch('/api/translate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({
                        q: texts,
                        source: 'az',
                        target: TRANSLATION_TARGET_BY_LANG[selectedLang],
                        format
                    })
                });
                if (!response.ok) throw new Error('translate_failed');

                const result = await response.json();
                if (Array.isArray(result?.translatedText)) {
                    return result.translatedText.map((item: unknown) => String(item ?? ''));
                }
                return texts.map(() => String(result?.translatedText ?? ''));
            };

            for (const format of ['text', 'html'] as const) {
                const queueEntries = Array.from(queuedGroups.values()).filter((queueItems) => queueItems[0]?.format === format);

                for (let index = 0; index < queueEntries.length; index += 20) {
                    const chunk = queueEntries.slice(index, index + 20);
                    const sourceTexts = chunk.map((queueItems) => queueItems[0].sourceText);
                    const translatedList = await translateChunk(sourceTexts, format);

                    chunk.forEach((queueItems, chunkIndex) => {
                        const translatedValue = String(translatedList[chunkIndex] || queueItems[0].sourceText);
                        queueItems.forEach((queueItem) => {
                            queueItem.keys.forEach((key, keyIndex) => {
                                const pageId = queueItem.pageIds[keyIndex] || selectedPage;
                                updates.set(`${pageId}:${key}`, { pageId, key, value: translatedValue });
                            });
                        });
                    });
                }
            }

            if (!updates.size) {
                toast(t.autoTranslateIdle);
                return;
            }

            setPayload((prev) => {
                const nextPages = { ...prev.pages };
                updates.forEach(({ pageId, key, value }) => {
                    const sourcePage = nextPages[pageId] || {};
                    const sourceEntry = sourcePage[key] || { AZ: '', RU: '', ENG: '' };
                    nextPages[pageId] = {
                        ...sourcePage,
                        [key]: {
                            ...sourceEntry,
                            [selectedLang]: value
                        }
                    };
                });

                return {
                    ...prev,
                    pages: nextPages
                };
            });
            setDirty(true);
            toast.success(`${t.autoTranslateDone} (${updates.size})`);
        } catch (error) {
            console.error(error);
            toast.error(t.autoTranslateError);
        } finally {
            setTranslating(false);
        }
    };

    const saveLocalization = async () => {
        if (!dirty || translating) return;
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
                    <button type="button" className="btn-primary" onClick={saveLocalization} disabled={!dirty || saving || translating}>
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
                {translating && (
                    <span className="status-chip">
                        <Loader2 size={14} className="spin" />
                        {t.translating}
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
                            <div className="editor-overview">
                                <div className="editor-overview-main">
                                    <span className="editor-overview-label">{t.selectedPageLabel}</span>
                                    <h2>{selectedPageCard?.name || getPageDisplayName(selectedPage, language, siteContentPages)}</h2>
                                    <p>{selectedPageCard?.description || getPageDisplayDescription(selectedPage, language, siteContentPages)}</p>
                                    <span className="editor-overview-id">{t.idLabel}: {selectedPage}</span>
                                </div>
                                <div className="editor-stats">
                                    <div className="editor-stat">
                                        <span>{t.visibleKeysLabel}</span>
                                        <strong>{visibleGroups.length}</strong>
                                    </div>
                                    <div className="editor-stat">
                                        <span>{t.translatedLabel}</span>
                                        <strong>{visibleTranslatedCount}</strong>
                                    </div>
                                    <div className="editor-stat editor-stat-attention">
                                        <span>{t.missingLabel}</span>
                                        <strong>{visibleMissingCount}</strong>
                                    </div>
                                </div>
                            </div>

                            <div className="editor-toolbar">
                                <div className="editor-toolbar-row">
                                    <div className="lang-tabs">
                                        {EDITABLE_LANGUAGES.map((langTab) => (
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
                                </div>
                                <div className="editor-toolbar-row editor-toolbar-row-actions">
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
                                    <div className="toolbar-actions-group">
                                        <span className="toolbar-actions-label">{t.quickActions}</span>
                                        <button type="button" className="btn-secondary btn-inline-icon" onClick={jumpToNextMissing}>
                                            <Sparkles size={15} />
                                            <span>{t.nextMissing}</span>
                                        </button>
                                        <button type="button" className="btn-secondary btn-inline-icon" onClick={fillMissingWithAz}>
                                            <Wand2 size={15} />
                                            <span>{t.fillMissing}</span>
                                        </button>
                                        <button type="button" className="btn-secondary btn-inline-icon" onClick={autoTranslateMissing} disabled={translating}>
                                            {translating ? <Loader2 size={16} className="spin" /> : <Wand2 size={15} />}
                                            <span>{t.autoTranslateMissing}</span>
                                        </button>
                                    </div>
                                </div>
                                <div className="editor-hint">
                                    {t.editorHint}
                                </div>
                            </div>

                            <div className="translation-list">
                                {!visibleGroups.length ? (
                                    <div className="empty-state">{t.noData}</div>
                                ) : (
                                    visibleGroups.map((group) => {
                                        const entry = group.entry;
                                        const hasValue = hasTranslatedValue(entry, selectedLang);
                                        return (
                                            <div
                                                className={`translation-row ${hasValue ? 'is-ready' : 'is-missing'}`}
                                                key={group.key}
                                            >
                                                <div className="translation-meta">
                                                    <div className="translation-meta-top">
                                                        <div className="translation-key">{group.key}</div>
                                                        <span className={`translation-state ${hasValue ? 'is-ready' : 'is-missing'}`}>
                                                            {hasValue ? t.translationReady : t.translationMissing}
                                                        </span>
                                                    </div>
                                                    {group.keys.length > 1 && (
                                                        <div className="translation-merge-note">
                                                            {group.keys.length} {t.mergedKeys}
                                                        </div>
                                                    )}
                                                    <div className="translation-source">
                                                        <span>{t.sourceAz}</span>
                                                        <p>{collapseRepeatedSourceText(entry.AZ)}</p>
                                                    </div>
                                                    <div className="translation-row-actions">
                                                        <button type="button" className="row-action-btn" onClick={() => fillGroupWithSource(group.key)}>
                                                            <Wand2 size={14} />
                                                            <span>{t.rowFillFromAz}</span>
                                                        </button>
                                                        <button type="button" className="row-action-btn" onClick={() => void copySourceText(group.key)}>
                                                            <Clipboard size={14} />
                                                            <span>{t.rowCopySource}</span>
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="translation-input-wrap">
                                                    <label>{t.value}</label>
                                                    <textarea
                                                        ref={(node) => {
                                                            translationInputRefs.current[group.key] = node;
                                                        }}
                                                        value={entry[selectedLang]}
                                                        onChange={(event) => updateEntry(group.key, event.target.value)}
                                                        rows={3}
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
