import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Save, Type, Image as ImageIcon, Layout, Globe, Plus, Trash2, X, Search, Calendar, FileText, Trophy, Video, Play, ChevronUp, ChevronDown, Shield, Users, Leaf, ShieldCheck, Truck, Zap, List } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/session';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import './VisualEditor.css';

interface Section {
    id: string;
    type: 'text' | 'image';
    label: string;
    value: string;
    url?: string;
    order?: number;
}

interface PageImage {
    id: string;
    path: string;
    alt: string;
    type: 'local' | 'remote';
    order?: number;
}

interface PageContent {
    id: string;
    title: string;
    active?: boolean;
    sections: Section[];
    images: PageImage[];
}

type EventLanguageCode = 'AZ' | 'RU' | 'ENG';
type EventLocalizedField = 'title' | 'location' | 'category' | 'description' | 'rules';
type EventLocalizedFields = Record<EventLocalizedField, string>;
type EventTranslations = Record<EventLanguageCode, EventLocalizedFields>;
type NewsLocalizedField = 'title' | 'category' | 'description';
type NewsLocalizedFields = Record<NewsLocalizedField, string>;
type NewsTranslations = Record<EventLanguageCode, NewsLocalizedFields>;

interface EventItem {
    id: number;
    title: string;
    date: string;
    location: string;
    category: string;
    img: string;
    description: string;
    rules: string;
    youtubeUrl?: string;
    pdfUrl?: string;
    status: 'planned' | 'past';
    registrationEnabled?: boolean;
    translations?: EventTranslations;
}

interface NewsItem {
    id: number;
    title: string;
    date: string;
    img: string;
    description: string;
    category?: string;
    status: 'published' | 'draft';
    translations?: NewsTranslations;
}

interface DriverItem {
    id: number;
    rank: number;
    name: string;
    license: string;
    team: string;
    wins: number;
    points: number;
    img: string;
}

interface VideoItem {
    id: number;
    title: string;
    youtubeUrl: string;
    videoId: string;
    duration: string;
    thumbnail: string;
    created_at?: string;
}

interface GalleryPhotoItem {
    id: number;
    title: string;
    url: string;
    album?: string;
    eventId?: number | null;
}

interface DriverCategory {
    id: string;
    name: string;
    drivers: DriverItem[];
}

type CoreValueField = 'icon' | 'title' | 'desc';
interface CoreValueRow {
    suffix: string;
    icon: string;
    title: string;
    desc: string;
}

const DEFAULT_PHOTO_ALBUM = 'Ümumi Arxiv';
const GALLERY_VERSION_KEY = 'forsaj_gallery_version';
const RESERVED_PHOTO_ALBUM_KEYS = new Set([
    '',
    'umumi arxiv',
    'ümumi arxiv',
    'general archive',
    'default',
    'archive',
    'arxiv'
]);

const normalizePhotoAlbum = (value?: string) => {
    const cleaned = (value || '').trim();
    return cleaned || DEFAULT_PHOTO_ALBUM;
};

const normalizeEventStatus = (rawStatus: unknown, rawDate?: string): 'planned' | 'past' => {
    const normalized = String(rawStatus || '').trim().toLocaleLowerCase('az');
    if (normalized === 'past' || normalized === 'kecmis' || normalized === 'keçmiş') return 'past';
    if (normalized === 'planned' || normalized === 'gelecek' || normalized === 'gələcək') return 'planned';

    const date = new Date(String(rawDate || '').trim());
    if (!Number.isNaN(date.getTime())) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (date.getTime() < today.getTime()) return 'past';
    }
    return 'planned';
};

const normalizeEventRegistrationEnabled = (rawValue: unknown) => {
    if (typeof rawValue === 'boolean') return rawValue;
    const normalized = String(rawValue || '').trim().toLocaleLowerCase('az');
    if (!normalized) return true;
    if (['false', '0', 'no', 'off', 'disabled', 'deactive', 'inactive', 'bagli', 'bağlı'].includes(normalized)) {
        return false;
    }
    return true;
};

const EVENT_LANGUAGE_CODES: EventLanguageCode[] = ['AZ', 'RU', 'ENG'];
const EVENT_LANGUAGE_TABS: Array<{ code: EventLanguageCode; label: string }> = [
    { code: 'AZ', label: 'AZ' },
    { code: 'RU', label: 'RU' },
    { code: 'ENG', label: 'ENG' }
];
const EVENT_LOCALIZED_FIELDS: EventLocalizedField[] = ['title', 'location', 'category', 'description', 'rules'];
const EVENT_AUTO_TRANSLATE_TEXT_FIELDS: EventLocalizedField[] = ['title', 'location', 'category'];
const EVENT_AUTO_TRANSLATE_HTML_FIELDS: EventLocalizedField[] = ['description', 'rules'];

const isObjectRecord = (value: unknown): value is Record<string, any> =>
    !!value && typeof value === 'object' && !Array.isArray(value);

const toEventFieldString = (value: unknown) => (value === undefined || value === null ? '' : String(value));

const createEmptyEventLocalizedFields = (): EventLocalizedFields => ({
    title: '',
    location: '',
    category: '',
    description: '',
    rules: ''
});

const getLegacyEventFieldByLanguage = (
    rawEvent: Record<string, any>,
    field: EventLocalizedField,
    lang: EventLanguageCode
) => {
    if (lang === 'AZ') return '';

    const suffixes = lang === 'RU'
        ? ['Ru', 'RU', 'Rus', 'RUS', '_ru', '_RU', '_rus', '_RUS']
        : ['En', 'EN', 'Eng', 'ENG', '_en', '_EN', '_eng', '_ENG'];

    for (const suffix of suffixes) {
        const key = suffix.startsWith('_') ? `${field}${suffix}` : `${field}${suffix}`;
        const value = rawEvent[key];
        if (value !== undefined && value !== null && String(value) !== '') {
            return String(value);
        }
    }

    return '';
};

const normalizeEventTranslations = (rawEvent: Partial<EventItem> & Record<string, any>): EventTranslations => {
    const source = isObjectRecord(rawEvent) ? rawEvent : {};
    const rawTranslations: Record<string, any> = isObjectRecord(source.translations)
        ? (source.translations as Record<string, any>)
        : (isObjectRecord(source.i18n) ? (source.i18n as Record<string, any>) : {});

    const langSources: Partial<Record<EventLanguageCode, Record<string, any>>> = {
        AZ: isObjectRecord(rawTranslations.AZ)
            ? rawTranslations.AZ
            : (isObjectRecord(rawTranslations.az) ? rawTranslations.az : undefined),
        RU: isObjectRecord(rawTranslations.RU)
            ? rawTranslations.RU
            : (isObjectRecord(rawTranslations.ru)
                ? rawTranslations.ru
                : (isObjectRecord(rawTranslations.RUS) ? rawTranslations.RUS : undefined)),
        ENG: isObjectRecord(rawTranslations.ENG)
            ? rawTranslations.ENG
            : (isObjectRecord(rawTranslations.EN)
                ? rawTranslations.EN
                : (isObjectRecord(rawTranslations.en) ? rawTranslations.en : undefined))
    };

    const normalized = EVENT_LANGUAGE_CODES.reduce((acc, lang) => {
        const langSource = langSources[lang];
        const base = createEmptyEventLocalizedFields();

        EVENT_LOCALIZED_FIELDS.forEach((field) => {
            const fromLangMap = langSource ? toEventFieldString(langSource[field]) : '';
            const fromLegacy = getLegacyEventFieldByLanguage(source, field, lang);
            const azBase = toEventFieldString(source[field]);

            if (lang === 'AZ') {
                base[field] = fromLangMap || azBase;
                return;
            }

            base[field] = fromLangMap || fromLegacy;
        });

        acc[lang] = base;
        return acc;
    }, {} as EventTranslations);

    return normalized;
};

const syncEventWithAzTranslations = (rawEvent: Partial<EventItem> & Record<string, any>): EventItem => {
    const source = isObjectRecord(rawEvent) ? rawEvent : {};
    const translations = normalizeEventTranslations(source);
    const az = translations.AZ;

    return {
        ...(source as EventItem),
        title: az.title || toEventFieldString(source.title),
        location: az.location || toEventFieldString(source.location),
        category: az.category || toEventFieldString(source.category),
        description: az.description || toEventFieldString(source.description),
        rules: az.rules || toEventFieldString(source.rules),
        translations
    };
};

const getEventLocalizedFieldValue = (
    rawEvent: Partial<EventItem> | null | undefined,
    field: EventLocalizedField,
    lang: EventLanguageCode,
    fallbackToAz = true
) => {
    if (!rawEvent) return '';
    const normalizedEvent = syncEventWithAzTranslations(rawEvent as Partial<EventItem> & Record<string, any>);
    const directValue = toEventFieldString(normalizedEvent.translations?.[lang]?.[field]);
    if (directValue) return directValue;
    if (!fallbackToAz && lang !== 'AZ') return '';
    if (fallbackToAz && lang !== 'AZ') {
        return toEventFieldString(normalizedEvent.translations?.AZ?.[field]) || toEventFieldString(normalizedEvent[field]);
    }
    return toEventFieldString(normalizedEvent[field]);
};

const applyEventLocalizedFieldUpdate = (
    rawEvent: Partial<EventItem> & Record<string, any>,
    field: EventLocalizedField,
    lang: EventLanguageCode,
    value: string
): EventItem => {
    const normalizedEvent = syncEventWithAzTranslations(rawEvent);
    const currentTranslations = normalizedEvent.translations || normalizeEventTranslations(normalizedEvent);
    const nextTranslations: EventTranslations = {
        ...currentTranslations,
        [lang]: {
            ...currentTranslations[lang],
            [field]: value
        }
    };

    const nextEvent: EventItem = {
        ...normalizedEvent,
        translations: nextTranslations
    };

    if (lang === 'AZ') {
        nextEvent[field] = value;
    }

    return syncEventWithAzTranslations(nextEvent);
};

const NEWS_LOCALIZED_FIELDS: NewsLocalizedField[] = ['title', 'category', 'description'];
const NEWS_AUTO_TRANSLATE_TEXT_FIELDS: NewsLocalizedField[] = ['title', 'category'];
const NEWS_AUTO_TRANSLATE_HTML_FIELDS: NewsLocalizedField[] = ['description'];
const NEWS_TRANSLATION_SOURCE_KEYS = ['translations', 'i18n', 'localized', 'localization', 'langs', 'languages'];
const NEWS_LANGUAGE_SOURCE_KEYS: Record<EventLanguageCode, string[]> = {
    AZ: ['AZ', 'az', 'aze', 'azerbaijani', 'azerbaycanca', 'azerbaycan'],
    RU: ['RU', 'ru', 'rus', 'russian', 'russkiy'],
    ENG: ['ENG', 'EN', 'en', 'eng', 'english']
};
const NEWS_FIELD_ALIASES: Record<NewsLocalizedField, string[]> = {
    title: ['title', 'name', 'headline'],
    category: ['category', 'cat', 'type', 'tag'],
    description: ['description', 'desc', 'content', 'body', 'text', 'details']
};

const LANGUAGE_TO_TRANSLATE_CODE: Record<EventLanguageCode, string> = {
    AZ: 'az',
    RU: 'ru',
    ENG: 'en'
};

const translateWithoutApiKey = async (
    sourceLang: EventLanguageCode,
    targetLang: EventLanguageCode,
    values: string[],
    format: 'text' | 'html'
): Promise<{ values: string[]; usedFallback: boolean }> => {
    const normalizedInput = values.map((value) => String(value ?? ''));
    if (sourceLang === targetLang) {
        return { values: normalizedInput, usedFallback: false };
    }
    if (!normalizedInput.some((value) => value.trim())) {
        return { values: normalizedInput, usedFallback: false };
    }

    try {
        const response = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                q: normalizedInput,
                source: LANGUAGE_TO_TRANSLATE_CODE[sourceLang],
                target: LANGUAGE_TO_TRANSLATE_CODE[targetLang],
                format
            })
        });

        if (!response.ok) {
            return { values: normalizedInput, usedFallback: true };
        }

        const payload = await response.json().catch(() => ({}));
        const translatedRaw = payload?.translatedText;
        const translatedList = Array.isArray(translatedRaw)
            ? translatedRaw.map((item: unknown) => String(item ?? ''))
            : (typeof translatedRaw === 'string' ? [translatedRaw] : normalizedInput);

        const translated = normalizedInput.map((original, index) => {
            const nextValue = translatedList[index];
            return typeof nextValue === 'string' ? nextValue : original;
        });

        return {
            values: translated,
            usedFallback: Boolean(payload?.fallback)
        };
    } catch {
        return { values: normalizedInput, usedFallback: true };
    }
};

const createEmptyNewsLocalizedFields = (): NewsLocalizedFields => ({
    title: '',
    category: '',
    description: ''
});

const normalizeNewsKeyToken = (value: unknown) =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');

const readNewsObjectByKeys = (source: Record<string, any>, keys: string[]) => {
    const wanted = new Set((keys || []).map(normalizeNewsKeyToken));
    for (const [rawKey, rawValue] of Object.entries(source || {})) {
        if (!isObjectRecord(rawValue)) continue;
        if (!wanted.has(normalizeNewsKeyToken(rawKey))) continue;
        return rawValue as Record<string, any>;
    }
    return undefined;
};

const readNewsStringByKeys = (source: Record<string, any>, keys: string[]) => {
    const wanted = new Set((keys || []).map(normalizeNewsKeyToken));
    for (const [rawKey, rawValue] of Object.entries(source || {})) {
        if (!wanted.has(normalizeNewsKeyToken(rawKey))) continue;
        const next = toEventFieldString(rawValue);
        if (next) return next;
    }
    return '';
};

const getLegacyNewsFieldByLanguage = (
    rawNews: Record<string, any>,
    field: NewsLocalizedField,
    lang: EventLanguageCode
) => {
    if (lang === 'AZ') return '';

    const suffixes = lang === 'RU'
        ? ['Ru', 'RU', 'Rus', 'RUS', '_ru', '_RU', '_rus', '_RUS']
        : ['En', 'EN', 'Eng', 'ENG', '_en', '_EN', '_eng', '_ENG'];
    const fieldAliases = NEWS_FIELD_ALIASES[field] || [field];

    for (const fieldAlias of fieldAliases) {
        for (const suffix of suffixes) {
            const key = `${fieldAlias}${suffix}`;
            const value = rawNews[key];
            if (value !== undefined && value !== null && String(value) !== '') {
                return String(value);
            }
        }
    }

    return '';
};

const normalizeNewsTranslations = (rawNews: Partial<NewsItem> & Record<string, any>): NewsTranslations => {
    const source = isObjectRecord(rawNews) ? rawNews : {};
    const rawTranslations: Record<string, any> =
        readNewsObjectByKeys(source, NEWS_TRANSLATION_SOURCE_KEYS) ||
        (isObjectRecord(source.translations) ? (source.translations as Record<string, any>) : {}) ||
        (isObjectRecord(source.i18n) ? (source.i18n as Record<string, any>) : {});

    const langSources: Partial<Record<EventLanguageCode, Record<string, any>>> = {
        AZ: readNewsObjectByKeys(rawTranslations, NEWS_LANGUAGE_SOURCE_KEYS.AZ),
        RU: readNewsObjectByKeys(rawTranslations, NEWS_LANGUAGE_SOURCE_KEYS.RU),
        ENG: readNewsObjectByKeys(rawTranslations, NEWS_LANGUAGE_SOURCE_KEYS.ENG)
    };
    const fieldSources: Partial<Record<NewsLocalizedField, Record<string, any>>> = NEWS_LOCALIZED_FIELDS.reduce((acc, field) => {
        const fieldSource = readNewsObjectByKeys(rawTranslations, NEWS_FIELD_ALIASES[field]);
        if (fieldSource) acc[field] = fieldSource;
        return acc;
    }, {} as Partial<Record<NewsLocalizedField, Record<string, any>>>);

    const normalized = EVENT_LANGUAGE_CODES.reduce((acc, lang) => {
        const base = createEmptyNewsLocalizedFields();
        const langSource = langSources[lang];

        NEWS_LOCALIZED_FIELDS.forEach((field) => {
            const fromLangMap = langSource ? readNewsStringByKeys(langSource, NEWS_FIELD_ALIASES[field]) : '';
            const fromFieldMap = fieldSources[field] ? readNewsStringByKeys(fieldSources[field] as Record<string, any>, NEWS_LANGUAGE_SOURCE_KEYS[lang]) : '';
            const azBase = readNewsStringByKeys(source, NEWS_FIELD_ALIASES[field]);

            if (lang === 'AZ') {
                base[field] = fromLangMap || fromFieldMap || azBase;
                return;
            }

            base[field] = fromLangMap || fromFieldMap || getLegacyNewsFieldByLanguage(source, field, lang);
        });

        acc[lang] = base;
        return acc;
    }, {} as NewsTranslations);

    return normalized;
};

const syncNewsWithAzTranslations = (rawNews: Partial<NewsItem> & Record<string, any>): NewsItem => {
    const source = isObjectRecord(rawNews) ? rawNews : {};
    const translations = normalizeNewsTranslations(source);
    const az = translations.AZ;

    return {
        ...(source as NewsItem),
        title: az.title || toEventFieldString(source.title),
        category: az.category || toEventFieldString(source.category),
        description: az.description || toEventFieldString(source.description),
        translations
    };
};

const getNewsLocalizedFieldValue = (
    rawNews: Partial<NewsItem> | null | undefined,
    field: NewsLocalizedField,
    lang: EventLanguageCode,
    fallbackToAz = true
) => {
    if (!rawNews) return '';
    const normalizedNews = syncNewsWithAzTranslations(rawNews as Partial<NewsItem> & Record<string, any>);
    const directValue = toEventFieldString(normalizedNews.translations?.[lang]?.[field]);
    if (directValue) return directValue;
    if (!fallbackToAz && lang !== 'AZ') return '';
    if (fallbackToAz && lang !== 'AZ') {
        return toEventFieldString(normalizedNews.translations?.AZ?.[field]) || toEventFieldString(normalizedNews[field]);
    }
    return toEventFieldString(normalizedNews[field]);
};

const applyNewsLocalizedFieldUpdate = (
    rawNews: Partial<NewsItem> & Record<string, any>,
    field: NewsLocalizedField,
    lang: EventLanguageCode,
    value: string
): NewsItem => {
    const normalizedNews = syncNewsWithAzTranslations(rawNews);
    const currentTranslations = normalizedNews.translations || normalizeNewsTranslations(normalizedNews);
    const nextTranslations: NewsTranslations = {
        ...currentTranslations,
        [lang]: {
            ...currentTranslations[lang],
            [field]: value
        }
    };

    const nextNews: NewsItem = {
        ...normalizedNews,
        translations: nextTranslations
    };

    if (lang === 'AZ') {
        nextNews[field] = value;
    }

    return syncNewsWithAzTranslations(nextNews);
};

const normalizeRichEditorValue = (value: string) => {
    const normalized = String(value ?? '').trim();
    if (!normalized) return '';
    if (normalized === '<p><br></p>' || normalized === '<p></p>') return '';
    return value;
};

const isReservedPhotoAlbum = (value?: string) => {
    const normalized = normalizePhotoAlbum(value)
        .toLocaleLowerCase('az')
        .normalize('NFC')
        .trim();
    return RESERVED_PHOTO_ALBUM_KEYS.has(normalized);
};

const toSafePhotoId = (rawId: unknown, fallback: number) => {
    const numeric = Number(rawId);
    return Number.isFinite(numeric) ? numeric : fallback;
};

const normalizeGalleryPhotoItem = (item: any, index: number): GalleryPhotoItem => {
    const safeId = toSafePhotoId(item?.id, Date.now() + index + 1);
    const safeTitle = String(item?.title || item?.alt || `Şəkil ${index + 1}`).trim();
    const safeUrl = String(item?.url || item?.path || '').trim();
    const eventIdRaw = Number(item?.eventId ?? item?.event_id);
    const safeEventId = Number.isFinite(eventIdRaw) ? eventIdRaw : null;
    const safeAlbum = normalizePhotoAlbum(
        typeof item?.album === 'string'
            ? item.album
            : (typeof item?.event === 'string' ? item.event : '')
    );

    return {
        id: safeId,
        title: safeTitle || `Şəkil ${index + 1}`,
        url: safeUrl,
        album: safeAlbum,
        eventId: safeEventId
    };
};

const QUILL_MODULES = {
    toolbar: [
        [{ 'header': [2, 3, false] }],
        ['bold', 'italic', 'underline'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        ['link'],
        ['clean']
    ],
};

const CORE_VALUE_ICON_PRESETS = ['Shield', 'Users', 'Leaf', 'Zap'] as const;
const CORE_VALUE_ICON_COMPONENTS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
    Shield,
    Users,
    Leaf,
    Zap
};
const LEGAL_SECTION_ICON_PRESETS = ['', 'FileText', 'Shield', 'ShieldCheck', 'Users', 'Globe', 'Leaf', 'Zap'] as const;
const LEGAL_SECTION_ICON_COMPONENTS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
    FileText,
    Shield,
    ShieldCheck,
    Users,
    Globe,
    Leaf,
    Zap
};
const PARTNER_ICON_PRESETS = ['ShieldCheck', 'Truck', 'Globe', 'Zap'];
const PARTNER_ICON_COMPONENTS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
    ShieldCheck,
    Truck,
    Globe,
    Zap
};
const RULE_TAB_ICON_PRESETS = ['Info', 'Settings', 'ShieldAlert', 'Leaf', 'FileText'];
const CONTACT_SECTION_GROUPS: Array<{ title: string; subtitle: string; ids: string[] }> = [
    {
        title: 'Səhifə və Sistem',
        subtitle: 'Səhifə başlığı, status və sistem mesajları',
        ids: ['PAGE_TITLE', 'PAGE_SUBTITLE', 'ONLINE_STATUS_LABEL', 'FORM_TOAST_REQUIRED', 'FORM_TOAST_SUCCESS', 'FORM_TOAST_ERROR']
    },
    {
        title: 'Baş Ofis',
        subtitle: 'Ofis məlumatları və əsas əlaqə sahələri',
        ids: ['OFFICE_LABEL', 'ADDRESS_LINE_1', 'ADDRESS_LINE_2', 'WORK_HOURS', 'PHONE_LABEL', 'PHONE_NUMBER', 'EMAIL_LABEL', 'EMAIL_Address']
    },
    {
        title: 'Departamentlər',
        subtitle: 'Departament kartları və e-poçt məlumatları',
        ids: ['DEPT_HQ_TITLE', 'DEPT_HQ_DESC', 'DEPT_HQ_EMAIL', 'DEPT_PR_TITLE', 'DEPT_PR_DESC', 'DEPT_PR_EMAIL', 'DEPT_TECH_TITLE', 'DEPT_TECH_DESC', 'DEPT_TECH_EMAIL']
    },
    {
        title: 'Form',
        subtitle: 'Müraciət formu sahələri və seçimlər',
        ids: [
            'FORM_TITLE',
            'FORM_STATUS_LABEL',
            'FORM_METHOD',
            'FORM_CONTENT_TYPE',
            'FIELD_NAME_LABEL',
            'FIELD_NAME_PLACEHOLDER',
            'FIELD_CONTACT_LABEL',
            'FIELD_CONTACT_PLACEHOLDER',
            'FIELD_TOPIC_LABEL',
            'TOPIC_GENERAL',
            'TOPIC_PILOT',
            'TOPIC_TECH',
            'FIELD_MESSAGE_LABEL',
            'FIELD_MESSAGE_PLACEHOLDER',
            'BTN_SEND'
        ]
    }
];
const CONTACT_LEGACY_TOPIC_FIELDS = [
    { id: 'TOPIC_GENERAL', fallback: 'ÜMUMİ SORĞU' },
    { id: 'TOPIC_PILOT', fallback: 'PİLOT QEYDİYYATI' },
    { id: 'TOPIC_TECH', fallback: 'TEXNİKİ YARDIM' }
] as const;

const LEGAL_SECTION_GROUPS: Record<string, Array<{ title: string; subtitle: string; ids: string[] }>> = {
    privacypolicypage: [
        {
            title: 'Səhifə Başlığı',
            subtitle: 'Ümumi başlıq və tarix məlumatları',
            ids: ['PAGE_TITLE', 'PAGE_SUBTITLE', 'INTRO_TEXT', 'UPDATED_LABEL', 'UPDATED_DATE']
        },
        {
            title: 'Mətn Bölmələri',
            subtitle: 'Məxfilik siyasətinin əsas maddələri',
            ids: [
                'SECTION_1_TITLE', 'SECTION_1_BODY',
                'SECTION_2_TITLE', 'SECTION_2_BODY',
                'SECTION_3_TITLE', 'SECTION_3_BODY',
                'SECTION_4_TITLE', 'SECTION_4_BODY',
                'SECTION_5_TITLE', 'SECTION_5_BODY',
                'SECTION_6_TITLE', 'SECTION_6_BODY',
                'SECTION_7_TITLE', 'SECTION_7_BODY',
                'SECTION_8_TITLE', 'SECTION_8_BODY',
                'SECTION_9_TITLE', 'SECTION_9_BODY'
            ]
        },
        {
            title: 'Əlaqə',
            subtitle: 'Səhifənin sonunda görünən əlaqə məlumatları',
            ids: ['CONTACT_TITLE', 'CONTACT_EMAIL', 'CONTACT_WEBSITE']
        }
    ],
    termsofservicepage: [
        {
            title: 'Səhifə Başlığı',
            subtitle: 'Ümumi başlıq və tarix məlumatları',
            ids: ['PAGE_TITLE', 'PAGE_SUBTITLE', 'INTRO_TEXT', 'UPDATED_LABEL', 'UPDATED_DATE']
        },
        {
            title: 'Mətn Bölmələri',
            subtitle: 'Xidmət şərtlərinin əsas maddələri',
            ids: [
                'SECTION_1_TITLE', 'SECTION_1_BODY',
                'SECTION_2_TITLE', 'SECTION_2_BODY',
                'SECTION_3_TITLE', 'SECTION_3_BODY',
                'SECTION_4_TITLE', 'SECTION_4_BODY',
                'SECTION_5_TITLE', 'SECTION_5_BODY',
                'SECTION_6_TITLE', 'SECTION_6_BODY',
                'SECTION_7_TITLE', 'SECTION_7_BODY',
                'SECTION_8_TITLE', 'SECTION_8_BODY'
            ]
        },
        {
            title: 'Əlaqə',
            subtitle: 'Səhifənin sonunda görünən əlaqə məlumatları',
            ids: ['CONTACT_TITLE', 'CONTACT_EMAIL', 'CONTACT_WEBSITE']
        }
    ]
};

const CORE_VALUE_FIELD_REGEX = /^val-(icon|title|desc)-(.+)$/i;
const parseCoreValueField = (id: string): { field: CoreValueField; suffix: string } | null => {
    const match = String(id || '').trim().match(CORE_VALUE_FIELD_REGEX);
    if (!match) return null;
    return { field: match[1].toLowerCase() as CoreValueField, suffix: match[2] };
};

const PAGE_EDIT_HINTS: Record<string, string> = {
    navbar: 'Üst menudakı düymə adları və keçidlərini buradan yeniləyin.',
    hero: 'Ana səhifənin ilk ekranında görünən başlıq, alt başlıq və düymələr.',
    marquee: 'Ana səhifədə sürüşən məlumat zolağının məzmunu.',
    categoryleaders: 'Ana səhifə liderlər bölməsi başlıq və məlumatları.',
    nextrace: 'Ana səhifədəki "NÖVBƏTİ YARIŞ" bölməsinin başlıq və CTA mətnləri.',
    videoarchive: 'Ana səhifədəki "VİDEO ARXİVİ" bölməsinin başlıq və izah mətnləri.',
    news: 'Ana səhifədəki "SON XƏBƏRLƏR" bölməsinin başlıq və izah mətnləri.',
    partners: 'Ana səhifənin alt hissəsindəki "RƏSMİ TƏRƏFDAŞLARIMIZ" kartları.',
    footer: 'Saytın alt hissəsi (footer) mətnləri, linkləri və əlaqə məlumatları.',
    about: 'Haqqımızda səhifəsindəki əsas başlıqlar, mətnlər və dəyərlər.',
    newspage: 'Xəbərlər səhifəsi başlıq və üst mətn sahələri.',
    eventspage: 'Tədbirlər səhifəsi başlıq və forma ilə bağlı mətnlər.',
    drivers: 'Sürücülər bölməsinin kateqoriya və cədvəl başlıqları.',
    gallerypage: 'Qalereya səhifəsi tab və başlıq məzmunları.',
    contactpage: 'Əlaqə səhifəsində ofis, departament və form mətnləri.',
    rulespage: 'Qaydalar səhifəsi tablar, sənəd düymələri və maddələr.',
    privacypolicypage: 'Privacy Policy səhifəsində başlıq, maddələr və əlaqə məlumatları.',
    termsofservicepage: 'Terms of Service səhifəsində başlıq, maddələr və əlaqə məlumatları.',
};

const FIELD_HINTS: Record<string, string> = {
    PAGE_TITLE: 'Səhifənin ən üstündə görünən əsas başlıq.',
    PAGE_SUBTITLE: 'Başlığın altında görünən qısa izah mətni.',
    SECTION_TITLE: 'Bu blokun üstündə görünən etiket mətnidir.',
    INTRO_TEXT: 'Səhifə girişində görünən giriş mətni.',
    UPDATED_LABEL: 'Yenilənmə tarixindən əvvəl görünən etiket.',
    UPDATED_DATE: 'Səhifədə göstərilən son yenilənmə tarixi.',
    CONTACT_TITLE: 'Səhifə sonundakı əlaqə bölməsi başlığı.',
    CONTACT_EMAIL: 'Səhifə sonundakı e-mail ünvanı.',
    CONTACT_WEBSITE: 'Səhifə sonundakı veb sayt linki.',
};

const bbcodeToHtmlForEditor = (raw: string) => {
    if (!raw) return '';

    const value = raw.replace(/\\+\[/g, '[').replace(/\\+\]/g, ']');
    const hasBbcode = /\[(\/?)(B|I|U|S|CENTER|FONT|URL|IMG|COLOR|SIZE|QUOTE|CODE|LIST|\*)[\]=\s\w"':#.,+-]*\]/i.test(value);
    if (!hasBbcode) return value;

    let html = value;
    html = html.replace(/\[CENTER\]([\s\S]*?)\[\/CENTER\]/gi, '<div style="text-align:center;">$1</div>');
    html = html.replace(/\[FONT=([^\]]+)\]([\s\S]*?)\[\/FONT\]/gi, '<span style="font-family:$1;">$2</span>');
    html = html.replace(/\[B\]([\s\S]*?)\[\/B\]/gi, '<strong>$1</strong>');
    html = html.replace(/\[I\]([\s\S]*?)\[\/I\]/gi, '<em>$1</em>');
    html = html.replace(/\[U\]([\s\S]*?)\[\/U\]/gi, '<span style="text-decoration:underline;">$1</span>');
    html = html.replace(/\[S\]([\s\S]*?)\[\/S\]/gi, '<strike>$1</strike>');
    html = html.replace(/\[URL=([^\]]+)\]([\s\S]*?)\[\/URL\]/gi, '<a href="$1" target="_blank" rel="noopener noreferrer">$2</a>');
    html = html.replace(/\[IMG\]([\s\S]*?)\[\/IMG\]/gi, '<img src="$1" style="max-width:100%;" />');
    html = html.replace(/\[COLOR=([^\]]+)\]([\s\S]*?)\[\/COLOR\]/gi, '<span style="color:$1;">$2</span>');
    html = html.replace(/\[SIZE=([^\]]+)\]([\s\S]*?)\[\/SIZE\]/gi, '<span style="font-size:$1px;">$2</span>');
    html = html.replace(/\[QUOTE\]([\s\S]*?)\[\/QUOTE\]/gi, '<blockquote>$1</blockquote>');
    html = html.replace(/\[CODE\]([\s\S]*?)\[\/CODE\]/gi, '<pre><code>$1</code></pre>');
    html = html.replace(/\r?\n/g, '<br />');
    return html;
};

const QuillEditor: React.FC<{ value: string, onChange: (val: string) => void, id: string, readOnly?: boolean }> = ({ value, onChange, id, readOnly = false }) => {
    return (
        <div className="quill-editor-wrapper" id={id}>
            <ReactQuill
                theme="snow"
                value={value || ''}
                onChange={(nextValue: string, _delta: unknown, source: string) => {
                    // Ignore non-user updates triggered by controlled re-renders/tab switches.
                    if (source !== 'user') return;
                    onChange(nextValue);
                }}
                modules={readOnly ? { toolbar: false } : QUILL_MODULES}
                readOnly={readOnly}
                placeholder="Məzmunu daxil edin..."
            />
        </div>
    );
};

const extractSectionKey = (section: Section) => {
    if (/^[A-Z0-9_]+$/.test(section.id)) return section.id.trim();

    const label = (section.label || '').trim();
    if (label.startsWith('KEY:')) {
        return label.replace(/^KEY:\s*/i, '').trim();
    }

    return '';
};

const KEY_TOKEN_REGEX = /\b[A-Z0-9]+(?:_[A-Z0-9]+)+\b/;
const looksLikeKeyToken = (value?: string) => KEY_TOKEN_REGEX.test((value || '').trim());
const humanizeKey = (value: string) => value.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
const normalizePlainText = (value: string) => {
    if (!value) return '';
    let current = value;

    for (let i = 0; i < 4; i++) {
        const doc = new DOMParser().parseFromString(current, 'text/html');
        const decoded = (doc.body.textContent || '').trim();
        if (!decoded || decoded === current) break;
        current = decoded;
    }

    const finalDoc = new DOMParser().parseFromString(current, 'text/html');
    return (finalDoc.body.textContent || '')
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

const normalizeMultilinePlainText = (
    value: string,
    options: { decodeEntities?: boolean } = {}
) => {
    if (!value) return '';
    const decodeEntities = options.decodeEntities !== false;
    let current = value;

    if (decodeEntities) {
        for (let i = 0; i < 4; i++) {
            const doc = new DOMParser().parseFromString(current, 'text/html');
            const decoded = doc.body.textContent || '';
            if (!decoded || decoded === current) break;
            current = decoded;
        }

        const finalDoc = new DOMParser().parseFromString(current, 'text/html');
        current = finalDoc.body.textContent || '';
    }

    return current
        .replace(/\u00a0/g, ' ')
        .replace(/\r\n?/g, '\n');
};

const toAbsoluteUrl = (rawValue: unknown) => {
    const value = String(rawValue ?? '').trim();
    if (!value) return '';
    if (/^(https?:)?\/\//i.test(value)) return value;
    const normalizedPath = value.startsWith('/') ? value : `/${value}`;
    return `${window.location.origin}${normalizedPath}`;
};

const toStoredUrl = (rawValue: unknown) => {
    const value = String(rawValue ?? '').trim();
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) {
        try {
            const parsed = new URL(value);
            if (parsed.pathname.startsWith('/uploads/')) {
                return `${parsed.pathname}${parsed.search}${parsed.hash}`;
            }
        } catch {
            // Keep as-is if URL parsing fails.
        }
        return value;
    }
    return value.startsWith('/') ? value : `/${value}`;
};

const containsHtmlNoise = (value: string) =>
    /&(?:lt|gt|nbsp|quot|amp);|<\/?[a-z][^>]*>/i.test(value || '');

const hasRichContentMarkers = (value: string) =>
    /<(ul|ol|li|a|img|iframe|video|table|h[1-6])\b|\[(b|i|u|url|img|center)\]/i.test(value || '');

const shouldForcePlainText = (section: Section) => {
    const key = extractSectionKey(section);
    if (key) return true;
    if (isStatSectionId(section.id)) return true;
    if (section.id.startsWith('txt-') || section.id.startsWith('val-')) return true;
    if (section.id.startsWith('RULES_') || section.id.startsWith('PAGE_') || section.id.startsWith('BTN_') || section.id.startsWith('DOC_')) return true;
    if (containsHtmlNoise(section.value || '') && !hasRichContentMarkers(section.value || '')) return true;
    return false;
};

const STAT_LABEL_PREFIX = 'label-stat-';
const STAT_VALUE_PREFIX = 'value-stat-';
const isStatSectionId = (id: string) => id.startsWith(STAT_LABEL_PREFIX) || id.startsWith(STAT_VALUE_PREFIX);
const getStatSuffix = (id: string) => id.startsWith(STAT_LABEL_PREFIX)
    ? id.slice(STAT_LABEL_PREFIX.length)
    : id.startsWith(STAT_VALUE_PREFIX)
        ? id.slice(STAT_VALUE_PREFIX.length)
        : '';

const isSectionBusinessEditable = (_section: Section) => {
    return true;
};

const canEditSectionField = (section: Section, field: 'value' | 'label' | 'url') => {
    if (!isSectionBusinessEditable(section)) return false;

    const key = extractSectionKey(section);
    if (key) return field !== 'label';

    return true;
};

const canDeleteSection = (section: Section) => {
    if (!isSectionBusinessEditable(section)) return false;
    return !extractSectionKey(section);
};

const isSectionVisibleInAdmin = (_section: Section) => {
    return true;
};

const shouldSkipSectionInEditor = (section: Section) => {
    const key = extractSectionKey(section);
    const normalizedValue = normalizePlainText(section.value || '');
    const normalizedLabel = normalizePlainText(section.label || '');
    // Keep real business keys editable, but hide token-only placeholders.
    if (key && looksLikeKeyToken(normalizedValue)) {
        const upperValue = normalizedValue.toUpperCase();
        if (upperValue === key.toUpperCase()) return true;
        if (normalizedLabel && upperValue === normalizedLabel.toUpperCase()) return true;
    }
    if (!key && looksLikeKeyToken(normalizedValue)) return true;
    return false;
};

const getPageEditHint = (pageId?: string) => {
    if (!pageId) return '';
    return PAGE_EDIT_HINTS[pageId] || '';
};

const getSectionDisplayTitle = (section: Section) => {
    const label = normalizePlainText(section.label || '');
    if (label && !looksLikeKeyToken(label)) return label;

    const key = extractSectionKey(section);
    if (key) return humanizeKey(key);

    if (label) return humanizeKey(label);
    return humanizeKey((section.id || '').replace(/-/g, ' '));
};

const getSectionHint = (section: Section, pageId?: string) => {
    const key = extractSectionKey(section) || section.id;
    const normalizedKey = (key || '').trim();
    if (FIELD_HINTS[normalizedKey]) return FIELD_HINTS[normalizedKey];

    const sectionTitleMatch = normalizedKey.match(/^SECTION_(\d+)_TITLE$/);
    if (sectionTitleMatch) return `${sectionTitleMatch[1]}. maddənin başlıq mətni.`;
    const sectionIconMatch = normalizedKey.match(/^SECTION_(\d+)_ICON$/);
    if (sectionIconMatch) return `${sectionIconMatch[1]}. maddə üçün ikon seçimi (opsional).`;
    const sectionBodyMatch = normalizedKey.match(/^SECTION_(\d+)_BODY$/);
    if (sectionBodyMatch) return `${sectionBodyMatch[1]}. maddənin izah mətni.`;

    if (pageId === 'partners' && /^PARTNER_\d+_NAME$/.test(normalizedKey)) return 'Partner kartında görünən ad.';
    if (pageId === 'partners' && /^PARTNER_\d+_TAG$/.test(normalizedKey)) return 'Partner kartında hover zamanı görünən etiket.';
    if (pageId === 'partners' && /^PARTNER_\d+_ICON$/.test(normalizedKey)) return 'Partner kartında istifadə olunan ikon adı.';
    if (pageId === 'partners' && /^PARTNER_\d+_USE_IMAGE$/.test(normalizedKey)) return 'Kartın ikon yoxsa görsəl ilə göstərilməsini təyin edir.';
    if (pageId === 'partners' && /^PARTNER_\d+_IMAGE_ID$/.test(normalizedKey)) return 'Bu partner üçün bağlı şəkil ID-si.';
    if (pageId === 'partners' && /^PARTNER_\d+_LINK_URL$/.test(normalizedKey)) return 'Partner kliklənəndə açılacaq link ünvanı (opsional).';

    return 'Bu mətn saytda olduğu kimi göstərilir.';
};

const PARTNER_KEY_REGEX = /^PARTNER_(\d+)_(NAME|TAG|ICON|USE_IMAGE|IMAGE_ID|LINK_URL)$/;
const RULE_TAB_FIELD_REGEX = /^RULE_TAB_(\d+)_(ID|TITLE|ICON)$/;
const RULE_TAB_ITEM_FIELD_REGEX = /^RULE_TAB_(\d+)_ITEM_(\d+)_(TITLE|DESC)$/;
const RULE_TAB_SECTION_REGEX = /^RULE_TAB_\d+_(?:ID|TITLE|ICON|DOC_NAME|DOC_BUTTON|DOC_URL|ITEM_\d+_(?:TITLE|DESC))$/;
const CONTACT_TOPIC_OPTION_REGEX = /^TOPIC_OPTION_(\d+)$/i;
const LEGAL_DYNAMIC_SECTION_REGEX = /^SECTION_(\d+)_(TITLE|ICON|BODY)$/i;
const LEGAL_PAGE_IDS = new Set(['privacypolicypage', 'termsofservicepage']);
type PartnerField = 'name' | 'tag' | 'icon' | 'useImage' | 'imageId' | 'linkUrl';
type PartnerRow = {
    index: number;
    name: string;
    tag: string;
    icon: string;
    useImage: string;
    imageId: string;
    linkUrl: string;
};
type RuleTabItemRow = {
    index: number;
    title: string;
    desc: string;
};
type RuleTabRow = {
    index: number;
    id: string;
    title: string;
    icon: string;
    items: RuleTabItemRow[];
};

const toPartnerField = (token: string): PartnerField | null => {
    if (token === 'NAME') return 'name';
    if (token === 'TAG') return 'tag';
    if (token === 'ICON') return 'icon';
    if (token === 'USE_IMAGE') return 'useImage';
    if (token === 'IMAGE_ID') return 'imageId';
    if (token === 'LINK_URL') return 'linkUrl';
    return null;
};

const componentLabels: Record<string, string> = {
    'hero': 'Hero Bölməsi',
    'marquee': 'Marquee Yazısı',
    'navbar': 'Menyu və Naviqasiya',
    'about': 'HAQQIMIZDA',
    'mission_vision': 'Missiya və Vizyon',
    'values': 'Dəyərlərimiz',
    'eventspage': 'Tədbirlər Səhifəsi',
    'newspage': 'Xəbər Səhifəsi',
    'gallerypage': 'Qalereya Səhifəsi',
    'contactpage': 'Əlaqə Səhifəsi',
    'rulespage': 'Qaydalar Səhifəsi',
    'news': 'Xəbərlər',
    'drivers': 'Sürücülər',
    'categoryleaders': 'Kateqoriya Liderləri',
    'gallery': 'Qalereya',
    'videos': 'Videolar',
    'videoarchive': 'Video Arxiv',
    'privacypolicypage': 'Məxfilik Siyasəti',
    'termsofservicepage': 'Xidmət Şərtləri',
    'footer': 'Footer',
    'partners': 'Tərəfdaşlar',
    'offroadinfo': 'Offroad Nədir?',
    'whatisoffroad': 'Offroad Nədir?',
    'nextrace': 'Növbəti Yarış',
    'site': 'Sayt Ayarları',
    'settings': 'Ümumi Parametrlər',
    'general': 'SİSTEM AYARLARI',
    'app': 'Tətbiq Ayarları'
};

const TAB_PAGE_GROUPS: Record<string, string[]> = {
    home: ['navbar', 'hero', 'marquee', 'categoryleaders', 'nextrace', 'videoarchive', 'news', 'partners', 'footer'],
    // About page in frontend reads all content from "about" page id.
    abouttab: ['about'],
    newstab: ['newspage'],
    eventstab: ['eventspage'],
    driverstab: ['drivers'],
    gallerytab: ['gallerypage', 'gallery', 'videos', 'videoarchive'],
    rulestab: ['rulespage', 'privacypolicypage', 'termsofservicepage'],
    contacttab: ['contactpage']
};

const PAGE_TO_TAB_GROUP: Record<string, string> = Object.entries(TAB_PAGE_GROUPS).reduce((acc, [tabKey, pageIds]) => {
    pageIds.forEach((id) => {
        acc[id] = tabKey;
    });
    return acc;
}, {} as Record<string, string>);

const FORCE_SINGLE_PAGE_PARAMS = new Set(['privacypolicypage', 'termsofservicepage']);
type HomeEditTab = 'all' | 'navbar' | 'footer';
const HOME_EDIT_TABS: Array<{ id: HomeEditTab; label: string }> = [
    { id: 'all', label: 'Hamısı' },
    { id: 'navbar', label: 'Naviqasiya' },
    { id: 'footer', label: 'Footer' }
];
const HOME_TAB_PAGE_IDS: Record<HomeEditTab, string[]> = {
    all: TAB_PAGE_GROUPS.home,
    navbar: ['navbar'],
    footer: ['footer']
};

const resolvePageGroup = (pageParam?: string | null) => {
    if (!pageParam) return [];
    if (FORCE_SINGLE_PAGE_PARAMS.has(pageParam)) return [pageParam];
    if (TAB_PAGE_GROUPS[pageParam]) return TAB_PAGE_GROUPS[pageParam];
    const tabKey = PAGE_TO_TAB_GROUP[pageParam];
    if (tabKey && TAB_PAGE_GROUPS[tabKey]) return TAB_PAGE_GROUPS[tabKey];
    return [pageParam];
};

const CONTENT_VERSION_KEY = 'forsaj_site_content_version';
const SITE_CONTENT_READY_EVENT = 'forsaj-site-content-ready';
const GROUPED_PAGE_COLLAPSE_KEY = 'forsaj_grouped_page_collapsed_v1';
const SECTION_COLLAPSE_KEY = 'forsaj_section_collapsed_v1';
const normalizeOrder = (value: number | undefined, fallback: number) =>
    Number.isFinite(value as number) ? (value as number) : fallback;

const VisualEditor: React.FC = () => {
    const [pages, setPages] = useState<PageContent[]>([]);
    const [selectedPageIndex, setSelectedPageIndex] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [isExtracting, setIsExtracting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [extractStep, setExtractStep] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImageSelectorOpen, setIsImageSelectorOpen] = useState(false);
    const [isAddingNewFromSystem, setIsAddingNewFromSystem] = useState(false);
    const [allAvailableImages, setAllAvailableImages] = useState<string[]>([]);
    const [activeImageField, setActiveImageField] = useState<{ pageIdx: number, imgId: string } | null>(null);
    const [newSectionTitle, setNewSectionTitle] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const showAdvancedEditor = true;
    const [groupedPageCollapsed, setGroupedPageCollapsed] = useState<Record<string, boolean>>(() => {
        try {
            const raw = localStorage.getItem(GROUPED_PAGE_COLLAPSE_KEY);
            const parsed = raw ? JSON.parse(raw) : {};
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    });
    const [sectionCollapsed, setSectionCollapsed] = useState<Record<string, boolean>>(() => {
        try {
            const raw = localStorage.getItem(SECTION_COLLAPSE_KEY);
            const parsed = raw ? JSON.parse(raw) : {};
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    });

    const [events, setEvents] = useState<EventItem[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
    const [eventForm, setEventForm] = useState<Partial<EventItem>>({});
    const [eventFormLanguage, setEventFormLanguage] = useState<EventLanguageCode>('AZ');
    const [isAutoTranslatingEvent, setIsAutoTranslatingEvent] = useState(false);

    // News Mode State
    const [news, setNews] = useState<NewsItem[]>([]);
    const [selectedNewsId, setSelectedNewsId] = useState<number | null>(null);
    const [newsForm, setNewsForm] = useState<Partial<NewsItem>>({});
    const [newsFormLanguage, setNewsFormLanguage] = useState<EventLanguageCode>('AZ');
    const [isAutoTranslatingNews, setIsAutoTranslatingNews] = useState(false);

    // Video Mode State
    const [videos, setVideos] = useState<VideoItem[]>([]);
    const [selectedVideoId, setSelectedVideoId] = useState<number | null>(null);
    const [videoForm, setVideoForm] = useState<Partial<VideoItem>>({});

    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const mode = queryParams.get('mode'); // 'extract', 'events', 'event-management', 'news', 'drivers', 'videos', 'photos'
    const pageParam = queryParams.get('page');

    const [editorMode, setEditorMode] = useState<'extract' | 'events' | 'event-management' | 'news' | 'drivers' | 'videos' | 'photos'>('extract');
    const [eventManagementTab, setEventManagementTab] = useState<'modal' | 'pilot' | 'clubs'>('modal');
    const [pendingClubFocusId, setPendingClubFocusId] = useState<string | null>(null);
    const clubOptionInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const [pendingLegalSectionScrollNo, setPendingLegalSectionScrollNo] = useState<number | null>(null);
    const legalSectionCardRefs = useRef<Record<number, HTMLDivElement | null>>({});
    const rulesPdfInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    const [galleryPhotos, setGalleryPhotos] = useState<GalleryPhotoItem[]>([]);
    const autoSyncTriggeredRef = useRef(false);
    const [selectedPhotoId, setSelectedPhotoId] = useState<number | null>(null);
    const [photoForm, setPhotoForm] = useState<Partial<GalleryPhotoItem>>({});
    const [selectedPhotoAlbum, setSelectedPhotoAlbum] = useState<string>(DEFAULT_PHOTO_ALBUM);
    const [selectedPhotoEventId, setSelectedPhotoEventId] = useState<string>('');
    const [photoAlbumFilter, setPhotoAlbumFilter] = useState<string>('all');
    const [newPhotoAlbumName, setNewPhotoAlbumName] = useState<string>('');
    const [renamePhotoAlbumName, setRenamePhotoAlbumName] = useState<string>('');
    const galleryMultiUploadInputRef = useRef<HTMLInputElement | null>(null);
    const [homeEditTab, setHomeEditTab] = useState<HomeEditTab>('all');

    useEffect(() => {
        if (photoAlbumFilter === 'all') {
            setRenamePhotoAlbumName('');
            return;
        }
        setRenamePhotoAlbumName(normalizePhotoAlbum(photoAlbumFilter));
    }, [photoAlbumFilter]);

    useEffect(() => {
        if (mode) {
            setEditorMode(mode as any);
        } else if (pageParam) {
            setEditorMode('extract');
        } else {
            setEditorMode('extract');
        }
    }, [mode, pageParam]);

    useEffect(() => {
        // Keep search scoped to the currently visible workspace to avoid stale cross-mode filtering.
        setSearchTerm('');
    }, [editorMode, eventManagementTab]);

    useEffect(() => {
        if (editorMode !== 'extract') return;
        const homeGroupKey = pageParam ? PAGE_TO_TAB_GROUP[pageParam] : null;
        if (pageParam && (pageParam === 'home' || homeGroupKey === 'home')) {
            if (pageParam === 'navbar') {
                setHomeEditTab('navbar');
                return;
            }
            if (pageParam === 'footer') {
                setHomeEditTab('footer');
                return;
            }
            setHomeEditTab('all');
            return;
        }
        setHomeEditTab('all');
    }, [editorMode, pageParam]);

    useEffect(() => {
        localStorage.setItem(GROUPED_PAGE_COLLAPSE_KEY, JSON.stringify(groupedPageCollapsed));
    }, [groupedPageCollapsed]);

    useEffect(() => {
        localStorage.setItem(SECTION_COLLAPSE_KEY, JSON.stringify(sectionCollapsed));
    }, [sectionCollapsed]);

    useEffect(() => {
        if (!pendingClubFocusId) return;
        if (editorMode !== 'event-management' || eventManagementTab !== 'clubs') return;

        const targetInput = clubOptionInputRefs.current[pendingClubFocusId];
        if (!targetInput) return;

        const rafId = window.requestAnimationFrame(() => {
            targetInput.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            targetInput.focus({ preventScroll: true });
            targetInput.select();
            setPendingClubFocusId(null);
        });

        return () => window.cancelAnimationFrame(rafId);
    }, [pendingClubFocusId, editorMode, eventManagementTab, pages]);

    useEffect(() => {
        if (pendingLegalSectionScrollNo === null) return;

        const page = pages[selectedPageIndex];
        if (!page || !LEGAL_PAGE_IDS.has(page.id)) return;

        const targetCard = legalSectionCardRefs.current[pendingLegalSectionScrollNo];
        if (!targetCard) return;

        const rafId = window.requestAnimationFrame(() => {
            targetCard.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            const titleInput = targetCard.querySelector('input') as HTMLInputElement | null;
            if (titleInput) {
                titleInput.focus({ preventScroll: true });
                titleInput.select();
            }
            setPendingLegalSectionScrollNo(null);
        });

        return () => window.cancelAnimationFrame(rafId);
    }, [pendingLegalSectionScrollNo, pages, selectedPageIndex]);
    const [driverCategories, setDriverCategories] = useState<DriverCategory[]>([]);
    const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
    const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);
    const [driverForm, setDriverForm] = useState<Partial<DriverItem>>({});
    const [isSendingRankingNotice, setIsSendingRankingNotice] = useState(false);

    useEffect(() => {
        if (driverCategories.length === 0) {
            if (selectedCatId !== null) setSelectedCatId(null);
            if (selectedDriverId !== null) setSelectedDriverId(null);
            if (Object.keys(driverForm).length > 0) setDriverForm({});
            return;
        }

        const hasSelectedCategory = !!selectedCatId && driverCategories.some((cat) => cat.id === selectedCatId);
        if (!hasSelectedCategory) {
            setSelectedCatId(driverCategories[0].id);
            setSelectedDriverId(null);
            setDriverForm({});
            return;
        }

        if (selectedDriverId !== null) {
            const currentCategory = driverCategories.find((cat) => cat.id === selectedCatId);
            const hasSelectedDriver = !!currentCategory?.drivers?.some((driver) => driver.id === selectedDriverId);
            if (!hasSelectedDriver) {
                setSelectedDriverId(null);
                setDriverForm({});
            }
        }
    }, [driverCategories, selectedCatId, selectedDriverId, driverForm]);

    const loadContent = async () => {
        try {
            // 1. Load Site Content
            const resContent = await fetch('/api/site-content');
            const contentData = await resContent.json();
            if (Array.isArray(contentData)) {
                // Ensure default sections exist
                const defaultIds = [
                    'hero', 'marquee', 'navbar', 'about', 'mission_vision', 'values',
                    'rulespage', 'eventspage', 'newspage', 'gallerypage', 'contactpage',
                    'privacypolicypage', 'termsofservicepage',
                    'news', 'drivers', 'driverspage', 'categoryleaders', 'gallery', 'videos', 'videoarchive',
                    'footer', 'partners', 'offroadinfo', 'whatisoffroad', 'nextrace',
                    'site', 'settings', 'general', 'app'
                ];
                const updatedContent = [...contentData];
                const ensureAboutDefaults = (aboutPage: PageContent) => {
                    const sections = aboutPage.sections || [];
                    const images = aboutPage.images || [];

                    const ensureSection = (id: string, label: string, value: string) => {
                        if (sections.some(s => s.id === id)) return;
                        sections.push({ id, type: 'text', label, value });
                    };
                    const ensureImage = (id: string, path: string, alt: string) => {
                        if (images.some(i => i.id === id)) return;
                        images.push({
                            id,
                            path,
                            alt,
                            type: 'remote',
                            order: images.length
                        });
                    };
                    const normalizeAboutLookup = (value: string) =>
                        (value || '')
                            .toLocaleLowerCase('az')
                            .normalize('NFD')
                            .replace(/[\u0300-\u036f]/g, '')
                            .replace(/[^a-z0-9]+/g, '');
                    const isMeaningfulAboutValue = (value: string) => {
                        const trimmed = String(value || '').trim();
                        if (!trimmed) return false;
                        if (/^[A-Z0-9_]+$/.test(trimmed)) return false;
                        return true;
                    };
                    const resolveAboutSeedValue = (idHints: string[], tokenHints: string[], fallback: string) => {
                        const byId = sections.find((s) => idHints.includes(s.id));
                        if (byId && isMeaningfulAboutValue(byId.value || '')) return byId.value || fallback;

                        const normalizedHints = tokenHints.map(normalizeAboutLookup).filter(Boolean);
                        if (normalizedHints.length > 0) {
                            const byIdOrLabel = sections.find((s) => {
                                const haystack = normalizeAboutLookup(`${s.id || ''} ${s.label || ''}`);
                                return normalizedHints.some((hint) => haystack.includes(hint));
                            });
                            if (byIdOrLabel && isMeaningfulAboutValue(byIdOrLabel.value || '')) return byIdOrLabel.value || fallback;

                            const byValue = sections.find((s) => {
                                const haystack = normalizeAboutLookup(s.value || '');
                                return normalizedHints.some((hint) => haystack.includes(hint));
                            });
                            if (byValue && isMeaningfulAboutValue(byValue.value || '')) return byValue.value || fallback;
                        }

                        return fallback;
                    };
                    const aboutKickerSeed = resolveAboutSeedValue(
                        ['ABOUT_KICKER', 'txt-est-2018-motorsp-949'],
                        ['about ust basliq', 'est 2018', 'motorsport merkezi'],
                        'EST. 2018 // MOTORSPORT MƏRKƏZİ'
                    );
                    const aboutHeadlineSeed = resolveAboutSeedValue(
                        ['ABOUT_HEADLINE', 'txt-forsaj-club-az-rba-66'],
                        ['about ana basliq', 'forsaj club', 'offroad medeniyyetini'],
                        '"FORSAJ CLUB" AZƏRBAYCANIN OFFROAD MƏDƏNİYYƏTİNİ PEŞƏKAR SƏVİYYƏYƏ ÇATDIRMAQ ÜÇÜN YARADILMIŞDIR.'
                    );
                    const aboutDescriptionSeed = resolveAboutSeedValue(
                        ['ABOUT_DESCRIPTION', 'txt-klubumuz-sad-c-bir-552'],
                        ['about tesviri', 'klubumuz sadece bir', 'ralli xeritesi', 'platformadir'],
                        'Klubumuz sadəcə bir həvəskar qrupu deyil, ölkəmizi beynəlxalq ralli xəritəsinə daxil etməyi hədəfləyən rəsmi və peşəkar bir platformadır. 2018-ci ildən bəri biz 50-dən çox rəsmi yarış, 100-dən çox ekspedisiya və saysız-hesabsız adrenalin dolu anlar yaşamışıq.'
                    );
                    const aboutReadMoreSeed = resolveAboutSeedValue(
                        ['ABOUT_READ_MORE_BTN'],
                        ['etrafli oxu', 'hamsina bax', 'hamisina bax'],
                        'ƏTRAFLI OXU'
                    );

                    ensureSection('PAGE_TITLE', 'Səhifə Başlığı', 'HAQQIMIZDA');
                    ensureSection('PAGE_SUBTITLE', 'Səhifə Alt Başlığı', 'BİZİM HEKAYƏMİZ // MİSSİYAMIZ VƏ GƏLƏCƏYİMİZ');
                    ensureSection('ABOUT_KICKER', 'KEY: ABOUT_KICKER', aboutKickerSeed);
                    ensureSection('ABOUT_HEADLINE', 'KEY: ABOUT_HEADLINE', aboutHeadlineSeed);
                    ensureSection('ABOUT_DESCRIPTION', 'KEY: ABOUT_DESCRIPTION', aboutDescriptionSeed);
                    ensureSection('ABOUT_READ_MORE_BTN', 'KEY: ABOUT_READ_MORE_BTN', aboutReadMoreSeed);

                    // Ensure key "about" title fields always exist in panel
                    ensureSection(
                        'txt-est-2018-motorsp-949',
                        'About Üst Başlıq',
                        'EST. 2018 // MOTORSPORT MƏRKƏZİ'
                    );
                    ensureSection(
                        'txt-forsaj-club-az-rba-66',
                        'About Ana Başlıq',
                        '"FORSAJ CLUB" AZƏRBAYCANIN OFFROAD MƏDƏNİYYƏTİNİ PEŞƏKAR SƏVİYYƏYƏ ÇATDIRMAQ ÜÇÜN YARADILMIŞDIR.'
                    );
                    ensureSection(
                        'txt-bi-zi-m-mi-ssi-yamiz-424',
                        'Missiya Başlığı',
                        'BİZİM MİSSİYAMIZ'
                    );
                    ensureSection(
                        'txt-az-rbaycan-n-h-r-bir-45',
                        'Missiya Təsviri',
                        'Azərbaycanın hər bir guşəsində offroad idmanını təbliğ etmək, yerli pilotları beynəlxalq standartlara uyğun yetişdirmək və təbiəti qoruyaraq ekstremal adrenalin təcrübəsi bəxş etmək.'
                    );
                    ensureSection(
                        'txt-h-d-fi-mi-z-dakar-ral-50',
                        'Missiya Hədəf Mətni',
                        'HƏDƏFİMİZ: DAKAR RALLİ 2026'
                    );
                    ensureSection(
                        'txt-bi-zi-m-baxi-imiz-944',
                        'Vizyon Başlığı',
                        'BİZİM BAXIŞIMIZ'
                    );
                    ensureSection(
                        'txt-regionun-n-b-y-k-mo-901',
                        'Vizyon Təsviri',
                        'Regionun ən böyük motorsport hubuna çevrilmək, rəqəmsal və fiziki infrastrukturlarla pilotlarımızı dəstəkləmək və motorsportu hər kəs üçün əlçatan bir ehtirasa çevirmək.'
                    );
                    ensureSection(
                        'txt-qafqazin-li-der-klubu-758',
                        'Vizyon Şüarı',
                        'QAFQAZIN LİDER KLUBUNA ÇEVRİLMƏK'
                    );
                    ensureSection(
                        'txt-fundamental-pri-nsi-pl-219',
                        'Dəyərlər Alt Başlıq',
                        'FUNDAMENTAL PRİNSİPLƏR'
                    );
                    ensureSection(
                        'txt-sas-d-y-rl-ri-mi-z-482',
                        'Dəyərlər Başlığı',
                        'ƏSAS DƏYƏRLƏRİMİZ'
                    );
                    const hasValueSections = sections.some((section) => /^val-(icon|title|desc)-/i.test(section.id));
                    if (!hasValueSections) {
                        ensureSection('val-icon-1', 'Dəyər 1 İkonu', 'Shield');
                        ensureSection('val-title-1', 'Dəyər 1 Başlıq', 'TƏHLÜKƏSİZLİK');
                        ensureSection('val-desc-1', 'Dəyər 1 Təsvir', 'EKSTREMAL İDMANDA CAN SAĞLIĞI BİZİM BİR NÖMRƏLİ QAYDAMIZDIR. BÜTÜN TEXNİKALARIMIZ FIA STANDARTLARINA UYĞUN YOXLANILIR.');
                        ensureSection('val-icon-2', 'Dəyər 2 İkonu', 'Users');
                        ensureSection('val-title-2', 'Dəyər 2 Başlıq', 'İCMA RUHU');
                        ensureSection('val-desc-2', 'Dəyər 2 Təsvir', 'FORSAJ BİR KLUBDAN DAHA ÇOX, SADİQ VƏ BÖYÜK BİR AİLƏDİR. BİRİMİZ HAMIMIZ, HAMIMIZ BİRİMİZ ÜÇÜN!');
                        ensureSection('val-icon-3', 'Dəyər 3 İkonu', 'Leaf');
                        ensureSection('val-title-3', 'Dəyər 3 Başlıq', 'TƏBİƏTİ QORU');
                        ensureSection('val-desc-3', 'Dəyər 3 Təsvir', 'BİZ OFFROAD EDƏRKƏN TƏBİƏTƏ ZƏRƏR VERMƏMƏYİ ÖZÜMÜZƏ BORC BİLİRİK. EKOLOJİ BALANS BİZİM ÜÇÜN MÜQƏDDƏSDİR.');
                        ensureSection('val-icon-4', 'Dəyər 4 İkonu', 'Zap');
                        ensureSection('val-title-4', 'Dəyər 4 Başlıq', 'MÜKƏMMƏLLİK');
                        ensureSection('val-desc-4', 'Dəyər 4 Təsvir', 'HƏR YARIŞDA, HƏR DÖNGƏDƏ DAHA YAXŞI OLMAĞA ÇALIŞIRIQ. TƏLİMLƏRİMİZ PEŞƏKAR İNSTRUKTORLAR TƏRƏFİNDƏN İDARƏ OLUNUR.');
                    }

                    const hasStatPairs = sections.some(s => s.id.includes('label-stat')) && sections.some(s => s.id.includes('value-stat'));
                    if (hasStatPairs) {
                        aboutPage.sections = sections;
                        prioritizeSectionOrder(aboutPage, [
                            'PAGE_TITLE',
                            'PAGE_SUBTITLE',
                            'ABOUT_KICKER',
                            'ABOUT_HEADLINE',
                            'ABOUT_DESCRIPTION',
                            'ABOUT_READ_MORE_BTN',
                            'txt-est-2018-motorsp-949'
                        ]);
                        ensureImage(
                            'img-992',
                            'https://images.unsplash.com/photo-1541447271487-09612b3f49f7?q=80&w=1974&auto=format&fit=crop',
                            'Forsaj Club Detail'
                        );
                        aboutPage.images = images;
                        return;
                    }

                    const defaults = [
                        { label: 'PİLOTLAR', value: '140+' },
                        { label: 'YARIŞLAR', value: '50+' },
                        { label: 'GƏNCLƏR', value: '20+' }
                    ];

                    defaults.forEach((item, index) => {
                        const suffix = `${index + 1}`;
                        sections.push({
                            id: `label-stat-${suffix}`,
                            type: 'text',
                            label: `Statistika Etiketi ${index + 1}`,
                            value: item.label
                        });
                        sections.push({
                            id: `value-stat-${suffix}`,
                            type: 'text',
                            label: `Statistika Dəyəri ${index + 1}`,
                            value: item.value
                        });
                    });

                    aboutPage.sections = sections;
                    prioritizeSectionOrder(aboutPage, [
                        'PAGE_TITLE',
                        'PAGE_SUBTITLE',
                        'ABOUT_KICKER',
                        'ABOUT_HEADLINE',
                        'ABOUT_DESCRIPTION',
                        'ABOUT_READ_MORE_BTN',
                        'txt-est-2018-motorsp-949'
                    ]);
                    ensureImage(
                        'img-992',
                        'https://images.unsplash.com/photo-1541447271487-09612b3f49f7?q=80&w=1974&auto=format&fit=crop',
                        'Forsaj Club Detail'
                    );
                    aboutPage.images = images;
                };
                const ensurePartnersDefaults = (partnersPage: PageContent) => {
                    const sections = partnersPage.sections || [];
                    const images = partnersPage.images || [];

                    const ensureSection = (id: string, label: string, value: string) => {
                        if (sections.some(s => s.id === id)) return;
                        sections.push({ id, type: 'text', label, value });
                    };
                    const ensureImage = (id: string) => {
                        if (images.some(i => i.id === id)) return;
                        images.push({ id, path: '', alt: id, type: 'local', order: images.length });
                    };

                    ensureSection('SECTION_TITLE', 'Bölmə Başlığı', 'RƏSMİ TƏRƏFDAŞLARIMIZ');

                    const defaults = [
                        { name: 'AZMF', tag: 'OFFICIAL PARTNER', icon: 'ShieldCheck' },
                        { name: 'OFFROAD AZ', tag: 'OFFICIAL PARTNER', icon: 'Truck' },
                        { name: 'GLOBAL 4X4', tag: 'OFFICIAL PARTNER', icon: 'Globe' },
                        { name: 'RACE TECH', tag: 'OFFICIAL PARTNER', icon: 'Zap' }
                    ];

                    const existingPartnerIndexes = Array.from(new Set(
                        sections
                            .map((section) => section.id.match(PARTNER_KEY_REGEX))
                            .filter(Boolean)
                            .map((match) => Number((match as RegExpMatchArray)[1]))
                            .filter((idx) => Number.isFinite(idx) && idx > 0)
                    )).sort((a, b) => a - b);

                    if (existingPartnerIndexes.length === 0) {
                        defaults.forEach((item, i) => {
                            const idx = i + 1;
                            ensureSection(`PARTNER_${idx}_NAME`, `Tərəfdaş ${idx} Ad`, item.name);
                            ensureSection(`PARTNER_${idx}_TAG`, `Tərəfdaş ${idx} Etiket`, item.tag);
                            ensureSection(`PARTNER_${idx}_ICON`, `Tərəfdaş ${idx} İkon`, item.icon);
                            ensureSection(`PARTNER_${idx}_USE_IMAGE`, `Tərəfdaş ${idx} Görsel İstifadə`, 'false');
                            ensureSection(`PARTNER_${idx}_IMAGE_ID`, `Tərəfdaş ${idx} Görsel ID`, `partner-image-${idx}`);
                            ensureSection(`PARTNER_${idx}_LINK_URL`, `Tərəfdaş ${idx} Link`, '');
                            ensureImage(`partner-image-${idx}`);
                        });
                    } else {
                        existingPartnerIndexes.forEach((idx) => {
                            const fallback = defaults[idx - 1] || defaults[0];
                            ensureSection(`PARTNER_${idx}_NAME`, `Tərəfdaş ${idx} Ad`, fallback.name);
                            ensureSection(`PARTNER_${idx}_TAG`, `Tərəfdaş ${idx} Etiket`, fallback.tag);
                            ensureSection(`PARTNER_${idx}_ICON`, `Tərəfdaş ${idx} İkon`, fallback.icon);
                            ensureSection(`PARTNER_${idx}_USE_IMAGE`, `Tərəfdaş ${idx} Görsel İstifadə`, 'false');
                            ensureSection(`PARTNER_${idx}_IMAGE_ID`, `Tərəfdaş ${idx} Görsel ID`, `partner-image-${idx}`);
                            ensureSection(`PARTNER_${idx}_LINK_URL`, `Tərəfdaş ${idx} Link`, '');
                            ensureImage(`partner-image-${idx}`);
                        });
                    }

                    partnersPage.sections = sections;
                    partnersPage.images = images;
                };
                const ensureHeroDefaults = (heroPage: PageContent) => {
                    const sections = heroPage.sections || [];
                    const pickSection = (ids: string[]) =>
                        ids
                            .map((id) => sections.find((section) => section.id === id))
                            .find((section) => !!section);
                    const ensureSection = (
                        id: string,
                        label: string,
                        value: string,
                        url?: string,
                        aliasIds: string[] = []
                    ) => {
                        const idx = sections.findIndex(s => s.id === id);
                        const sourceSection = pickSection([id, ...aliasIds]);
                        const nextValue = String(sourceSection?.value || value || '').trim() || value;
                        const nextUrl = String(sourceSection?.url || url || '').trim();
                        if (idx === -1) {
                            sections.push({ id, type: 'text', label, value: nextValue, ...(nextUrl ? { url: nextUrl } : {}) });
                            return;
                        }
                        const currentValue = String(sections[idx].value || '').trim();
                        if ((!currentValue || currentValue.toUpperCase() === id.toUpperCase()) && nextValue) {
                            sections[idx].value = nextValue;
                        }
                        if (nextUrl && !sections[idx].url) sections[idx].url = nextUrl;
                    };

                    ensureSection('HERO_KICKER', 'Hero Üst Başlıq', 'AZERBAIJAN OFFROAD MOTORSPORT HUB', undefined, ['text-0']);
                    ensureSection('HERO_TITLE', 'Hero Başlıq', 'SƏRHƏDSİZ OFFROAD HƏYƏCANI', undefined, ['text-1']);
                    ensureSection('HERO_DESCRIPTION', 'Hero Təsvir', 'Azərbaycanın ən çətin yollarında peşəkar yarışlar və adrenalin dolu anlar.', undefined, ['text-2']);
                    ensureSection('HERO_PRIMARY_CTA', 'Hero Düymə 1', 'YARIŞLARA BAX', 'events', ['text-3']);
                    ensureSection('HERO_SECONDARY_CTA', 'Hero Düymə 2', 'HAQQIMIZDA', '/?view=about', ['text-4']);

                    ensureSection('text-0', 'KEY: text-0', 'AZERBAIJAN OFFROAD MOTORSPORT HUB', undefined, ['HERO_KICKER']);
                    ensureSection('text-1', 'KEY: text-1', 'SƏRHƏDSİZ OFFROAD HƏYƏCANI', undefined, ['HERO_TITLE']);
                    ensureSection('text-2', 'KEY: text-2', 'Azərbaycanın ən çətin yollarında peşəkar yarışlar və adrenalin dolu anlar.', undefined, ['HERO_DESCRIPTION']);
                    ensureSection('text-3', 'Hero Düymə 1', 'YARIŞLARA BAX', 'events', ['HERO_PRIMARY_CTA']);
                    ensureSection('text-4', 'Hero Düymə 2', 'HAQQIMIZDA', '/?view=about', ['HERO_SECONDARY_CTA']);

                    heroPage.sections = sections;
                    prioritizeSectionOrder(heroPage, [
                        'HERO_KICKER',
                        'HERO_TITLE',
                        'HERO_DESCRIPTION',
                        'HERO_PRIMARY_CTA',
                        'HERO_SECONDARY_CTA',
                        'text-0',
                        'text-1',
                        'text-2',
                        'text-3',
                        'text-4'
                    ]);
                };
                const ensurePageSectionDefaults = (
                    page: PageContent,
                    defaults: Array<{ id: string; label: string; value: string; url?: string }>
                ) => {
                    const sections = page.sections || [];
                    defaults.forEach((item) => {
                        const idx = sections.findIndex((s) => s.id === item.id);
                        if (idx === -1) {
                            sections.push({
                                id: item.id,
                                type: 'text',
                                label: item.label,
                                value: item.value,
                                ...(item.url ? { url: item.url } : {})
                            });
                            return;
                        }
                        if (item.url && !sections[idx].url) sections[idx].url = item.url;
                    });
                    page.sections = sections;
                };
                const prioritizeSectionOrder = (page: PageContent, priorityIds: string[]) => {
                    const sections = page.sections || [];
                    if (sections.length === 0 || priorityIds.length === 0) return;

                    const rank = new Map(priorityIds.map((id, idx) => [id, idx]));
                    const prioritized = sections
                        .filter((section) => rank.has(section.id))
                        .sort((a, b) => (rank.get(a.id) as number) - (rank.get(b.id) as number));
                    const rest = sections.filter((section) => !rank.has(section.id));

                    page.sections = [...prioritized, ...rest].map((section, idx) => ({
                        ...section,
                        order: idx
                    }));
                };
                const ensureContactDefaults = (page: PageContent) => {
                    ensurePageSectionDefaults(page, [
                        { id: 'PAGE_TITLE', label: 'Səhifə Başlığı', value: 'ƏLAQƏ' },
                        { id: 'PAGE_SUBTITLE', label: 'Səhifə Alt Başlığı', value: 'GET IN TOUCH // CONTACT CENTER' },
                        { id: 'OFFICE_LABEL', label: 'Ofis Bölmə Başlığı', value: 'BAŞ OFİS' },
                        { id: 'ADDRESS_LINE_1', label: 'Ünvan Sətir 1', value: 'AZADLIQ 102, BAKI' },
                        { id: 'ADDRESS_LINE_2', label: 'Ünvan Sətir 2', value: 'AZƏRBAYCAN // SECTOR_01' },
                        { id: 'WORK_HOURS', label: 'İş Saatı', value: '09:00 - 18:00' },
                        { id: 'ONLINE_STATUS_LABEL', label: 'Onlayn Status Mətni', value: 'ONLINE' },
                        { id: 'PHONE_LABEL', label: 'Telefon Başlığı', value: 'ƏLAQƏ NÖMRƏSİ' },
                        { id: 'PHONE_NUMBER', label: 'Telefon Nömrəsi', value: '+994 50 123 45 67' },
                        { id: 'EMAIL_LABEL', label: 'E-poçt Başlığı', value: 'E-POÇT ÜNVANI' },
                        { id: 'EMAIL_Address', label: 'Əsas E-poçt Ünvanı', value: 'PROTOCOL@FORSAJ.AZ' },
                        { id: 'DEPT_HQ_TITLE', label: 'Departament 1 Başlıq', value: 'BAŞ OFİS' },
                        { id: 'DEPT_HQ_DESC', label: 'Departament 1 Təsvir', value: 'ÜMUMİ SORĞULAR VƏ İDARƏETMƏ' },
                        { id: 'DEPT_HQ_EMAIL', label: 'Departament 1 E-poçt', value: 'HQ@FORSAJ.AZ' },
                        { id: 'DEPT_PR_TITLE', label: 'Departament 2 Başlıq', value: 'MEDİA VƏ PR' },
                        { id: 'DEPT_PR_DESC', label: 'Departament 2 Təsvir', value: 'MƏTBUAT VƏ ƏMƏKDAŞLIQ' },
                        { id: 'DEPT_PR_EMAIL', label: 'Departament 2 E-poçt', value: 'PR@FORSAJ.AZ' },
                        { id: 'DEPT_TECH_TITLE', label: 'Departament 3 Başlıq', value: 'TEXNİKİ DƏSTƏK' },
                        { id: 'DEPT_TECH_DESC', label: 'Departament 3 Təsvir', value: 'PİLOTLAR ÜÇÜN TEXNİKİ YARDIM' },
                        { id: 'DEPT_TECH_EMAIL', label: 'Departament 3 E-poçt', value: 'TECH@FORSAJ.AZ' },
                        { id: 'FORM_TITLE', label: 'Form Başlığı', value: 'MÜRACİƏT FORMU' },
                        { id: 'FORM_STATUS_LABEL', label: 'Form Status Mətni', value: 'STATUS: ONLINE' },
                        { id: 'FORM_METHOD', label: 'Form Method', value: 'POST' },
                        { id: 'FORM_CONTENT_TYPE', label: 'Form Content-Type', value: 'application/json' },
                        { id: 'FIELD_NAME_LABEL', label: 'Ad Soyad Label', value: 'AD VƏ SOYAD' },
                        { id: 'FIELD_NAME_PLACEHOLDER', label: 'Ad Soyad Placeholder', value: 'AD SOYAD DAXİL EDİN' },
                        { id: 'FIELD_CONTACT_LABEL', label: 'Əlaqə Label', value: 'ƏLAQƏ VASİTƏSİ' },
                        { id: 'FIELD_CONTACT_PLACEHOLDER', label: 'Əlaqə Placeholder', value: 'TELEFON VƏ YA EMAIL' },
                        { id: 'FIELD_TOPIC_LABEL', label: 'Müraciət İstiqaməti Label', value: 'MÜRACİƏT İSTİQAMƏTİ' },
                        { id: 'TOPIC_GENERAL', label: 'Mövzu Seçimi 1', value: 'ÜMUMİ SORĞU' },
                        { id: 'TOPIC_PILOT', label: 'Mövzu Seçimi 2', value: 'PİLOT QEYDİYYATI' },
                        { id: 'TOPIC_TECH', label: 'Mövzu Seçimi 3', value: 'TEXNİKİ YARDIM' },
                        { id: 'FIELD_MESSAGE_LABEL', label: 'Mesaj Label', value: 'MESAJINIZ' },
                        { id: 'FIELD_MESSAGE_PLACEHOLDER', label: 'Mesaj Placeholder', value: 'BURADA YAZIN...' },
                        { id: 'BTN_SEND', label: 'Form Göndər Düyməsi', value: 'MESAJI GÖNDƏR' },
                        { id: 'FORM_TOAST_REQUIRED', label: 'Form Boş Sahə Xəbərdarlığı', value: 'Zəhmət olmasa bütün sahələri doldurun.' },
                        { id: 'FORM_TOAST_SUCCESS', label: 'Form Uğurlu Göndəriş Mesajı', value: 'Müraciətiniz uğurla göndərildi!' },
                        { id: 'FORM_TOAST_ERROR', label: 'Form Xəta Mesajı', value: 'Gondərilmə zamanı xəta baş verdi.' },
                        { id: 'FOOTER_NEWSLETTER_TITLE', label: 'Abunə Başlığı', value: 'XƏBƏRDAR OL' },
                        { id: 'FOOTER_NEWSLETTER_DESC', label: 'Abunə Təsviri', value: 'Yarış təqvimi və xəbərlərdən anında xəbərdar olmaq üçün abunə olun.' }
                    ]);
                };
                const ensureEventsDefaults = (page: PageContent) => {
                    ensurePageSectionDefaults(page, [
                        { id: 'PAGE_TITLE', label: 'Səhifə Başlığı', value: 'TƏDBİRLƏR' },
                        { id: 'PAGE_SUBTITLE', label: 'Səhifə Alt Başlığı', value: 'OFFICIAL EVENT CALENDAR // FORSAJ CLUB' },
                        { id: 'BTN_JOIN_EVENT', label: 'Tədbirə Qoşul Düyməsi', value: 'TƏDBİRƏ QOŞUL' },
                        { id: 'BTN_JOIN_EVENT_UNAVAILABLE', label: 'Qeydiyyat Bağlı Düyməsi', value: 'Qeydiyyat aktiv deyil' },
                        { id: 'SIDEBAR_QUESTION_TITLE', label: 'Sual Kartı Başlığı', value: 'SUALINIZ VAR?' },
                        { id: 'SIDEBAR_QUESTION_DESC', label: 'Sual Kartı Təsviri', value: 'YARIŞLA BAĞLI ƏLAVƏ SUALLARINIZ ÜÇÜN BİZİMLƏ ƏLAQƏ SAXLAYIN.' },
                        { id: 'BTN_CONTACT', label: 'Sual Kartı Əlaqə Düyməsi', value: 'ƏLAQƏ' },
                        { id: 'MODAL_TITLE', label: 'İştirak Modal Başlığı', value: 'YARIŞDA İŞTİRAK' },
                        { id: 'JOIN_AS_PILOT', label: 'Pilot Kart Başlığı', value: 'PİLOT KİMİ QATIL' },
                        { id: 'JOIN_PILOT_DESC', label: 'Pilot Kart Təsviri', value: 'TEXNİKİ REQLAMENTƏ UYĞUN OLARAQ' },
                        { id: 'JOIN_AS_SPECTATOR', label: 'İzləyici Kart Başlığı', value: 'İZLƏYİCİ KİMİ QATIL' },
                        { id: 'JOIN_SPECTATOR_DESC', label: 'İzləyici Kart Təsviri', value: 'YARIŞI TRİBUNADAN İZLƏ' },
                        { id: 'BTN_BACK', label: 'Geri Düyməsi', value: 'GERİ QAYIT' },
                        { id: 'PILOT_REG_TITLE', label: 'Pilot Qeydiyyatı Başlığı', value: 'PİLOT QEYDİYYATI' },
                        { id: 'FIELD_NAME', label: 'Ad Soyad Label', value: 'AD VƏ SOYAD' },
                        { id: 'PLACEHOLDER_NAME', label: 'Ad Soyad Placeholder', value: 'Tam ad daxil edin' },
                        { id: 'FIELD_WHATSAPP', label: 'WhatsApp Label', value: 'WHATSAPP NÖMRƏSİ' },
                        { id: 'FIELD_PHONE', label: 'Telefon Label (Legacy)', value: 'WHATSAPP NÖMRƏSİ' },
                        { id: 'FIELD_CAR_MODEL', label: 'Avtomobil Label', value: 'AVTOMOBİLİN MARKA/MODELİ' },
                        { id: 'PLACEHOLDER_CAR', label: 'Avtomobil Placeholder', value: 'Məs: Toyota LC 105' },
                        { id: 'FIELD_TIRE_SIZE', label: 'Təkər Label', value: 'TƏKƏR ÖLÇÜSÜ' },
                        { id: 'PLACEHOLDER_TIRE', label: 'Təkər Placeholder', value: 'Məs: 35 DÜYM' },
                        { id: 'FIELD_ENGINE', label: 'Mühərrik Label', value: 'MÜHƏRRİK HƏCMİ' },
                        { id: 'PLACEHOLDER_ENGINE', label: 'Mühərrik Placeholder', value: 'Məs: 4.4L' },
                        { id: 'FIELD_CLUB', label: 'Klub Label', value: 'TƏMSİL ETDİYİ KLUB' },
                        { id: 'BTN_COMPLETE_REG', label: 'Qeydiyyatı Tamamla Düyməsi', value: 'QEYDİYYATI TAMAMLA' },
                        { id: 'PILOT_FORM_TOAST_REQUIRED', label: 'Pilot Form Boş Sahə Xəbərdarlığı', value: 'Zəhmət olmasa bütün sahələri doldurun.' },
                        { id: 'PILOT_FORM_TOAST_SUCCESS', label: 'Pilot Form Uğurlu Göndəriş Mesajı', value: 'Qeydiyyat müraciətiniz uğurla göndərildi!' },
                        { id: 'PILOT_FORM_TOAST_ERROR', label: 'Pilot Form Xəta Mesajı', value: 'Gondərilmə zamanı xəta baş verdi.' },
                        { id: 'PLACEHOLDER_WHATSAPP', label: 'WhatsApp Placeholder', value: '+994 50 123 45 67' },
                        { id: 'PLACEHOLDER_PHONE', label: 'Telefon Placeholder (Legacy)', value: '+994 50 123 45 67' },
                        { id: 'SPECTATOR_TICKET_URL', label: 'İzləyici Bilet Linki', value: 'https://iticket.az', url: 'https://iticket.az' },
                        { id: 'CLUB_OPTION_1', label: 'Klub Seçimi 1', value: 'Fərdi İştirakçı' },
                        { id: 'CLUB_OPTION_2', label: 'Klub Seçimi 2', value: 'Club 4X4' },
                        { id: 'CLUB_OPTION_3', label: 'Klub Seçimi 3', value: 'Extreme 4X4' },
                        { id: 'CLUB_OPTION_4', label: 'Klub Seçimi 4', value: 'Forsaj Club' },
                        { id: 'CLUB_OPTION_5', label: 'Klub Seçimi 5', value: 'Offroad.az' },
                        { id: 'CLUB_OPTION_6', label: 'Klub Seçimi 6', value: 'Overland 4X4' },
                        { id: 'CLUB_OPTION_7', label: 'Klub Seçimi 7', value: 'PatrolClub.az' },
                        { id: 'CLUB_OPTION_8', label: 'Klub Seçimi 8', value: 'Victory Club' },
                        { id: 'CLUB_OPTION_9', label: 'Klub Seçimi 9', value: 'Zəfər 4X4 Club' }
                    ]);
                };
                const ensureNewsPageDefaults = (page: PageContent) => {
                    ensurePageSectionDefaults(page, [
                        { id: 'PAGE_TITLE', label: 'Səhifə Başlığı', value: 'XƏBƏRLƏR' },
                        { id: 'PAGE_SUBTITLE', label: 'Səhifə Alt Başlığı', value: 'MOTORSPORT MAGAZINE // SEASON 2024' }
                    ]);
                    prioritizeSectionOrder(page, ['PAGE_TITLE', 'PAGE_SUBTITLE']);
                };
                const ensureGalleryPageDefaults = (page: PageContent) => {
                    ensurePageSectionDefaults(page, [
                        { id: 'PAGE_TITLE', label: 'Səhifə Başlığı', value: 'QALEREYA' },
                        { id: 'PAGE_SUBTITLE', label: 'Səhifə Alt Başlığı', value: 'XRONOLOJİ MOTORSPORT ARXİVİ // FORSAJ CLUB' },
                        { id: 'TAB_PHOTOS', label: 'Tab Foto', value: 'FOTOLAR' },
                        { id: 'TAB_VIDEOS', label: 'Tab Video', value: 'VİDEOLAR' },
                        { id: 'DYNAMIC_COLLECTION', label: 'Dinamik Kolleksiya Alt Başlıq', value: 'CANLI ARXİV // YENİLƏNƏN MƏZMUN' },
                        { id: 'TOTAL_LABEL', label: 'Toplam Etiketi', value: 'TOPLAM' },
                        { id: 'TYPE_PHOTO', label: 'Foto Tipi', value: 'FOTO' },
                        { id: 'TYPE_VIDEO', label: 'Video Tipi', value: 'VİDEO' }
                    ]);
                };
                const ensureDriversPageDefaults = (page: PageContent) => {
                    ensurePageSectionDefaults(page, [
                        { id: 'PAGE_TITLE', label: 'Səhifə Başlığı', value: 'SÜRÜCÜLƏR' },
                        { id: 'PAGE_SUBTITLE', label: 'Səhifə Alt Başlığı', value: 'OFFICIAL PILOT STANDINGS // SEASON 2024' }
                    ]);
                };
                const ensureFooterDefaults = (page: PageContent) => {
                    ensurePageSectionDefaults(page, [
                        { id: 'FOOTER_LOGO_ALT', label: 'Footer Logo Alt', value: 'Forsaj Logo' },
                        { id: 'FOOTER_ABOUT_TEXT', label: 'Footer Haqqında Mətn', value: 'Azərbaycanın ən prestijli motorsport mərkəzi. Sərhədsiz offroad həyəcanını bizimlə yaşayın.' },
                        { id: 'FOOTER_ADDRESS_LABEL', label: 'Footer Ünvan Başlığı', value: 'ÜNVAN' },
                        { id: 'FOOTER_CONTACT_LABEL', label: 'Footer Əlaqə Başlığı', value: 'ƏLAQƏ' },
                        { id: 'FOOTER_NAV_TITLE', label: 'Footer Naviqasiya Başlığı', value: 'NAVİQASİYA' },
                        { id: 'FOOTER_MOTORSPORT_TITLE', label: 'Footer Motorsport Başlığı', value: 'MOTORSPORT' },
                        { id: 'FOOTER_NEWSLETTER_TITLE', label: 'Footer Abunə Başlığı', value: 'XƏBƏRDAR OL' },
                        { id: 'FOOTER_NEWSLETTER_DESC', label: 'Footer Abunə Təsviri', value: 'Yarış təqvimi və xəbərlərdən anında xəbərdar olmaq üçün abunə olun.' },
                        { id: 'FOOTER_NEWSLETTER_PLACEHOLDER', label: 'Footer Abunə Placeholder', value: 'EMAIL DAXİL EDİN' },
                        { id: 'FOOTER_COPYRIGHT', label: 'Footer Copyright', value: '© 2024 FORSAJ CLUB. ALL RIGHTS RESERVED.' },
                        { id: 'FOOTER_PRIVACY_LABEL', label: 'Footer Privacy Link Mətni', value: 'Privacy Policy', url: 'privacy' },
                        { id: 'FOOTER_TERMS_LABEL', label: 'Footer Terms Link Mətni', value: 'Terms of Service', url: 'terms' }
                    ]);

                    const sections = page.sections || [];
                    const ensureUrl = (id: string, url: string) => {
                        const idx = sections.findIndex((s) => s.id === id);
                        if (idx === -1) return;
                        const currentUrl = String(sections[idx].url || '').trim();
                        if (!currentUrl || currentUrl === '#') {
                            sections[idx].url = url;
                        }
                    };
                    ensureUrl('FOOTER_PRIVACY_LABEL', 'privacy');
                    ensureUrl('FOOTER_TERMS_LABEL', 'terms');
                    page.sections = sections;
                };
                const ensureCategoryLeaderDefaults = (page: PageContent) => {
                    ensurePageSectionDefaults(page, [
                        { id: 'LEADER_TITLE_SUFFIX', label: 'Lider Başlıq Suffix', value: 'LİDERİ' },
                        { id: 'EMPTY_DRIVER_NAME', label: 'Boş Sürücü Adı', value: '---' },
                        { id: 'EMPTY_DRIVER_TEAM', label: 'Boş Komanda Adı', value: '---' }
                    ]);
                };
                const ensureNextRaceDefaults = (page: PageContent) => {
                    ensurePageSectionDefaults(page, [
                        { id: 'RACE_IMAGE_ALT', label: 'Növbəti Yarış Görsel Alt', value: 'Next Race' }
                    ]);
                };
                const ensureRulesDefaults = (page: PageContent) => {
                    ensurePageSectionDefaults(page, [
                        { id: 'PAGE_TITLE', label: 'Səhifə Başlığı', value: 'QAYDALAR' },
                        { id: 'PAGE_SUBTITLE', label: 'Səhifə Alt Başlığı', value: 'FORSAJ MOTORSPORT OFFICIAL RULES' }
                    ]);
                    const sections = page.sections || [];

                    const pickLegacyValue = (key: string, fallback: string) =>
                        (sections.find((s) => s.id === key)?.value || fallback).trim() || fallback;

                    const defaultRows: RuleTabRow[] = [
                        {
                            index: 1,
                            id: 'pilot',
                            title: pickLegacyValue('RULES_PILOT_TITLE', 'PİLOT PROTOKOLU'),
                            icon: 'Info',
                            items: [
                                { index: 1, title: pickLegacyValue('RULES_PILOT_SUB1', 'İSTİFADƏÇİ ÖHDƏLİKLƏRİ'), desc: pickLegacyValue('RULES_PILOT_DESC1', 'HƏR BİR İŞTİRAKÇI FEDERASİYANIN MÜƏYYƏN ETDİYİ BÜTÜN TEXNİKİ VƏ ETİK NORMALARI QEYD-ŞƏRTSİZ QƏBUL EDİR.') },
                                { index: 2, title: pickLegacyValue('RULES_PILOT_SUB2', 'DİSKVALİFİKASİYA'), desc: pickLegacyValue('RULES_PILOT_DESC2', 'PROTOKOLDAN KƏNARA ÇIXMAQ VƏ YA HAKİM QƏRARLARINA ETİRAZ ETMƏK DƏRHAL DİSKVALİFİKASİYA İLƏ NƏTİCƏLƏNƏ BİLƏR.') },
                                { index: 3, title: pickLegacyValue('RULES_PILOT_SUB3', 'TEXNİKİ TƏLƏBLƏR'), desc: pickLegacyValue('RULES_PILOT_DESC3', 'BÜTÜN AVADANLIQLAR YARIŞDAN 24 SAAT ƏVVƏL TEXNİKİ KOMİSSİYA TƏRƏFİNDƏN YOXLANILMALI VƏ TƏHLÜKƏSİZLİK SERTİFİKATI İLƏ TƏMİN EDİLMƏLİDİR.') }
                            ]
                        },
                        {
                            index: 2,
                            id: 'technical',
                            title: pickLegacyValue('RULES_TECH_TITLE', 'TEXNİKİ NORMARTİVLƏR'),
                            icon: 'Settings',
                            items: [
                                { index: 1, title: pickLegacyValue('RULES_TECH_SUB1', 'TƏKƏR ÖLÇÜLƏRİ'), desc: pickLegacyValue('RULES_TECH_DESC1', 'PRO CLASS ÜÇÜN MAKSİMUM TƏKƏR ÖLÇÜSÜ 37 DÜYM, AMATEUR CLASS ÜÇÜN İSƏ 33 DÜYM OLARAQ MÜƏYYƏN EDİLMİŞDİR.') },
                                { index: 2, title: pickLegacyValue('RULES_TECH_SUB2', 'MÜHƏRRİK GÜCÜ'), desc: pickLegacyValue('RULES_TECH_DESC2', 'MÜHƏRRİK ÜZƏRİNDƏ APARILAN MODİFİKASİYALAR KATEQORİYA ÜZRƏ LİMİTLƏRİ AŞMAMALIDIR. TURBO SİSTEMLƏRİ YALNIZ XÜSUSİ KLASLARDA İCAZƏLİDİR.') },
                                { index: 3, title: pickLegacyValue('RULES_TECH_SUB3', 'ASQI SİSTEMİ'), desc: pickLegacyValue('RULES_TECH_DESC3', 'AVTOMOBİLİN KLİRENSİ (YERDƏN HÜNDÜRLÜYÜ) VƏ ASQI ARTIKULYASİYASI TƏHLÜKƏSİZLİK STANDARTLARINA UYĞUN OLMALIDIR.') }
                            ]
                        },
                        {
                            index: 3,
                            id: 'safety',
                            title: pickLegacyValue('RULES_SAFETY_TITLE', 'TƏHLÜKƏSİZLİK QAYDALARI'),
                            icon: 'ShieldAlert',
                            items: [
                                { index: 1, title: pickLegacyValue('RULES_SAFETY_SUB1', 'KARKAS TƏLƏBİ'), desc: pickLegacyValue('RULES_SAFETY_DESC1', 'BÜTÜN AÇIQ VƏ YA MODİFİKASİYA OLUNMUŞ AVTOMOBİLLƏRDƏ FIA STANDARTLARINA UYĞUN TƏHLÜKƏSİZLİK KARKASI (ROLL CAGE) MƏCBURİDİR.') },
                                { index: 2, title: pickLegacyValue('RULES_SAFETY_SUB2', 'YANĞIN SÖNDÜRMƏ'), desc: pickLegacyValue('RULES_SAFETY_DESC2', 'HƏR BİR AVTOMOBİLDƏ ƏN AZI 2 KİLOQRAMLIQ, ASAN ƏLÇATAN YERDƏ YERLƏŞƏN YANĞINSÖNDÜRƏN BALON OLMALIDIR.') },
                                { index: 3, title: pickLegacyValue('RULES_SAFETY_SUB3', 'KƏMƏR VƏ DƏBİLQƏ'), desc: pickLegacyValue('RULES_SAFETY_DESC3', '5 NÖQTƏLİ TƏHLÜKƏSİZLİK KƏMƏRLƏRİ VƏ SERTİFİKATLI KASKALARIN (DƏBİLQƏLƏRİN) İSTİFADƏSİ BÜTÜN MƏRHƏLƏLƏRDƏ MƏCBURİDİR.') }
                            ]
                        },
                        {
                            index: 4,
                            id: 'eco',
                            title: pickLegacyValue('RULES_ECO_TITLE', 'EKOLOJİ MƏSULİYYƏT'),
                            icon: 'Leaf',
                            items: [
                                { index: 1, title: pickLegacyValue('RULES_ECO_SUB1', 'TULLANTILARIN İDARƏ EDİLMƏSİ'), desc: pickLegacyValue('RULES_ECO_DESC1', 'YARIŞ ƏRAZİSİNDƏ VƏ TRASDA HƏR HANSI BİR TULLANTININ ATILMASI QƏTİ QADAĞANDIR. İŞTİRAKÇILAR \"LEAVE NO TRACE\" PRİNSİPİNƏ ƏMƏL ETMƏLİDİR.') },
                                { index: 2, title: pickLegacyValue('RULES_ECO_SUB2', 'MAYE SIZMALARI'), desc: pickLegacyValue('RULES_ECO_DESC2', 'AVTOMOBİLDƏN YAĞ VƏ YA SOYUDUCU MAYE SIZMASI OLDUĞU TƏQDİRDƏ PİLOT DƏRHAL DAYANMALI VƏ ƏRAZİNİN ÇİRKLƏNMƏSİNİN QARŞISINI ALMALIDIR.') },
                                { index: 3, title: pickLegacyValue('RULES_ECO_SUB3', 'MARŞRUTDAN KƏNARA ÇIXMAMAQ'), desc: pickLegacyValue('RULES_ECO_DESC3', 'TƏBİİ ÖRTÜYÜ QORUMAQ MƏQSƏDİ İLƏ MÜƏYYƏN OLUNMUŞ TRASDANKƏNAR SÜRÜŞLƏR VƏ YA YAŞIL SAHƏLƏRƏ ZƏRƏR VERMƏK QADAĞANDIR.') }
                            ]
                        }
                    ];

                    const dynamicSections: Section[] = [];
                    defaultRows.forEach((row, rowIndex) => {
                        const tabNo = rowIndex + 1;
                        dynamicSections.push(
                            { id: `RULE_TAB_${tabNo}_ID`, type: 'text', label: `Qayda Sekməsi ${tabNo} ID`, value: row.id },
                            { id: `RULE_TAB_${tabNo}_TITLE`, type: 'text', label: `Qayda Sekməsi ${tabNo} Başlıq`, value: row.title },
                            { id: `RULE_TAB_${tabNo}_ICON`, type: 'text', label: `Qayda Sekməsi ${tabNo} İkon`, value: row.icon }
                        );
                        row.items.forEach((item, itemIndex) => {
                            const itemNo = itemIndex + 1;
                            dynamicSections.push(
                                { id: `RULE_TAB_${tabNo}_ITEM_${itemNo}_TITLE`, type: 'text', label: `Sekmə ${tabNo} Maddə ${itemNo} Başlıq`, value: item.title },
                                { id: `RULE_TAB_${tabNo}_ITEM_${itemNo}_DESC`, type: 'text', label: `Sekmə ${tabNo} Maddə ${itemNo} Təsvir`, value: item.desc }
                            );
                        });
                    });

                    const existingIds = new Set(sections.map((section) => section.id));
                    const missingDynamicSections = dynamicSections.filter((section) => !existingIds.has(section.id));
                    page.sections = [...sections, ...missingDynamicSections];
                };
                const ensurePrivacyPolicyDefaults = (page: PageContent) => {
                    ensurePageSectionDefaults(page, [
                        { id: 'PAGE_TITLE', label: 'Səhifə Başlığı', value: 'MƏXFİLİK SİYASƏTİ (PRIVACY POLICY)' },
                        { id: 'PAGE_SUBTITLE', label: 'Səhifə Alt Başlığı', value: 'MƏLUMATLARIN QORUNMASI VƏ İSTİFADƏ ŞƏRTLƏRİ' },
                        { id: 'INTRO_TEXT', label: 'Giriş Mətni', value: 'Bu Məxfilik Siyasəti forsaj.az (“Sayt”, “biz”, “bizim”) tərəfindən istifadəçilərdən toplanan məlumatların növlərini, istifadə qaydasını və qorunmasını izah edir.' },
                        { id: 'UPDATED_LABEL', label: 'Yenilənmə Tarixi Etiketi', value: 'Son yenilənmə tarixi' },
                        { id: 'UPDATED_DATE', label: 'Yenilənmə Tarixi', value: '18 Fevral 2026' },

                        { id: 'SECTION_1_TITLE', label: 'Bölmə 1 Başlıq', value: '1. Ümumi Məlumat' },
                        { id: 'SECTION_1_BODY', label: 'Bölmə 1 Mətn', value: 'Bu Məxfilik Siyasəti forsaj.az (“Sayt”, “biz”, “bizim”) tərəfindən istifadəçilərdən toplanan məlumatların növlərini, istifadə qaydasını və qorunmasını izah edir. Saytdan istifadə etməklə bu siyasətin şərtlərini qəbul etmiş olursunuz.' },

                        { id: 'SECTION_2_TITLE', label: 'Bölmə 2 Başlıq', value: '2. Toplanan Məlumatlar' },
                        { id: 'SECTION_2_BODY', label: 'Bölmə 2 Mətn', value: 'Şəxsi məlumatlar:\n- Ad və soyad\n- Elektron poçt ünvanı\n- Telefon nömrəsi (təqdim edildiyi halda)\n\nTexniki məlumatlar:\n- IP ünvan\n- Brauzer növü və cihaz məlumatları\n- Saytda fəaliyyət məlumatları (baxışlar, kliklər və s.)' },

                        { id: 'SECTION_3_TITLE', label: 'Bölmə 3 Başlıq', value: '3. Məlumatların İstifadə Məqsədi' },
                        { id: 'SECTION_3_BODY', label: 'Bölmə 3 Mətn', value: 'Toplanan məlumatlar aşağıdakı məqsədlərlə istifadə olunur:\n- Xidmətlərin təqdim edilməsi və inkişaf etdirilməsi\n- İstifadəçi sorğularına cavab verilməsi\n- Təhlükəsizliyin təmin olunması\n- Statistik və analitik təhlillər aparılması' },

                        { id: 'SECTION_4_TITLE', label: 'Bölmə 4 Başlıq', value: '4. Cookies (Kukilər)' },
                        { id: 'SECTION_4_BODY', label: 'Bölmə 4 Mətn', value: 'Sayt istifadəçi təcrübəsini yaxşılaşdırmaq üçün kukilərdən istifadə edə bilər. İstifadəçi brauzer vasitəsilə kukiləri deaktiv edə bilər.' },

                        { id: 'SECTION_5_TITLE', label: 'Bölmə 5 Başlıq', value: '5. Məlumatların Üçüncü Tərəflərlə Paylaşılması' },
                        { id: 'SECTION_5_BODY', label: 'Bölmə 5 Mətn', value: 'Şəxsi məlumatlar yalnız aşağı hallarda üçüncü tərəflərlə paylaşıla bilər:\n- Qanunvericiliyin tələbi olduqda\n- Texniki və xidmət tərəfdaşları ilə əməkdaşlıq çərçivəsində\n- İstifadəçinin razılığı ilə' },

                        { id: 'SECTION_6_TITLE', label: 'Bölmə 6 Başlıq', value: '6. Məlumat Təhlükəsizliyi' },
                        { id: 'SECTION_6_BODY', label: 'Bölmə 6 Mətn', value: 'Biz şəxsi məlumatların qorunması üçün müvafiq texniki və inzibati təhlükəsizlik tədbirləri tətbiq edirik.' },

                        { id: 'SECTION_7_TITLE', label: 'Bölmə 7 Başlıq', value: '7. İstifadəçi Hüquqları' },
                        { id: 'SECTION_7_BODY', label: 'Bölmə 7 Mətn', value: 'İstifadəçilər:\n- Öz məlumatlarına çıxış tələb edə bilər\n- Düzəliş və ya silinmə tələb edə bilər\n- Məlumatların işlənməsinə etiraz edə bilər' },

                        { id: 'SECTION_8_TITLE', label: 'Bölmə 8 Başlıq', value: '8. Siyasətdə Dəyişikliklər' },
                        { id: 'SECTION_8_BODY', label: 'Bölmə 8 Mətn', value: 'Bu siyasət zaman-zaman yenilənə bilər. Yenilənmiş versiya saytda dərc edildiyi tarixdən qüvvəyə minir.' },

                        { id: 'SECTION_9_TITLE', label: 'Bölmə 9 Başlıq', value: '9. Əlaqə' },
                        { id: 'SECTION_9_BODY', label: 'Bölmə 9 Mətn', value: 'Email: info@forsaj.az\nVeb sayt: https://forsaj.az' },

                        { id: 'CONTACT_TITLE', label: 'Əlaqə Bölməsi Başlığı', value: 'Əlaqə' },
                        { id: 'CONTACT_EMAIL', label: 'Əlaqə E-poçtu', value: 'info@forsaj.az' },
                        { id: 'CONTACT_WEBSITE', label: 'Əlaqə Vebsaytı', value: 'https://forsaj.az' }
                    ]);
                };
                const ensureTermsOfServiceDefaults = (page: PageContent) => {
                    ensurePageSectionDefaults(page, [
                        { id: 'PAGE_TITLE', label: 'Səhifə Başlığı', value: 'XİDMƏT ŞƏRTLƏRİ (TERMS OF SERVICE)' },
                        { id: 'PAGE_SUBTITLE', label: 'Səhifə Alt Başlığı', value: 'İSTİFADƏ QAYDALARI VƏ HÜQUQİ ŞƏRTLƏR' },
                        { id: 'INTRO_TEXT', label: 'Giriş Mətni', value: 'forsaj.az saytından istifadə etməklə siz bu Xidmət Şərtlərini qəbul etmiş olursunuz.' },
                        { id: 'UPDATED_LABEL', label: 'Yenilənmə Tarixi Etiketi', value: 'Son yenilənmə tarixi' },
                        { id: 'UPDATED_DATE', label: 'Yenilənmə Tarixi', value: '18 Fevral 2026' },

                        { id: 'SECTION_1_TITLE', label: 'Bölmə 1 Başlıq', value: '1. Qəbul' },
                        { id: 'SECTION_1_BODY', label: 'Bölmə 1 Mətn', value: 'forsaj.az saytından istifadə etməklə siz bu Xidmət Şərtlərini qəbul etmiş olursunuz.' },

                        { id: 'SECTION_2_TITLE', label: 'Bölmə 2 Başlıq', value: '2. Xidmətin Təsviri' },
                        { id: 'SECTION_2_BODY', label: 'Bölmə 2 Mətn', value: 'forsaj.az avtomobil, motorsport, off-road və Forsaj icması ilə bağlı məlumat, tədbir və digər rəqəmsal xidmətlər təqdim edir.' },

                        { id: 'SECTION_3_TITLE', label: 'Bölmə 3 Başlıq', value: '3. İstifadə Qaydaları' },
                        { id: 'SECTION_3_BODY', label: 'Bölmə 3 Mətn', value: 'İstifadəçi:\n- Saytdan yalnız qanuni məqsədlərlə istifadə etməlidir\n- Digər istifadəçilərin hüquqlarını pozmamalıdır\n- Saytın texniki sisteminə zərər verə biləcək hərəkətlər etməməlidir' },

                        { id: 'SECTION_4_TITLE', label: 'Bölmə 4 Başlıq', value: '4. Əqli Mülkiyyət Hüquqları' },
                        { id: 'SECTION_4_BODY', label: 'Bölmə 4 Mətn', value: 'Saytda yerləşdirilən bütün məzmun (mətnlər, şəkillər, videolar, loqo və s.) müəllif hüquqları ilə qorunur və icazəsiz istifadə edilə bilməz.' },

                        { id: 'SECTION_5_TITLE', label: 'Bölmə 5 Başlıq', value: '5. Məsuliyyətin Məhdudlaşdırılması' },
                        { id: 'SECTION_5_BODY', label: 'Bölmə 5 Mətn', value: 'Sayt və xidmətlər “olduğu kimi” təqdim olunur. Texniki nasazlıq və ya fasilələrə görə sayt rəhbərliyi məsuliyyət daşımır.' },

                        { id: 'SECTION_6_TITLE', label: 'Bölmə 6 Başlıq', value: '6. Dəyişiklik Hüququ' },
                        { id: 'SECTION_6_BODY', label: 'Bölmə 6 Mətn', value: 'Biz bu şərtləri istənilən vaxt dəyişdirmək hüququnu özümüzdə saxlayırıq. Yenilənmiş versiya saytda dərc edildiyi tarixdən qüvvəyə minir.' },

                        { id: 'SECTION_7_TITLE', label: 'Bölmə 7 Başlıq', value: '7. Tətbiq Olunan Qanun' },
                        { id: 'SECTION_7_BODY', label: 'Bölmə 7 Mətn', value: 'Bu Xidmət Şərtləri Azərbaycan Respublikasının qanunvericiliyinə uyğun tənzimlənir.' },

                        { id: 'SECTION_8_TITLE', label: 'Bölmə 8 Başlıq', value: '8. Əlaqə' },
                        { id: 'SECTION_8_BODY', label: 'Bölmə 8 Mətn', value: 'Email: info@forsaj.az\nVeb sayt: https://forsaj.az' },

                        { id: 'CONTACT_TITLE', label: 'Əlaqə Bölməsi Başlığı', value: 'Əlaqə' },
                        { id: 'CONTACT_EMAIL', label: 'Əlaqə E-poçtu', value: 'info@forsaj.az' },
                        { id: 'CONTACT_WEBSITE', label: 'Əlaqə Vebsaytı', value: 'https://forsaj.az' }
                    ]);
                };

                defaultIds.forEach(id => {
                    const found = updatedContent.find(p => p.id === id);
                    if (!found) {
                        updatedContent.push({
                            id,
                            title: componentLabels[id] || id,
                            sections: [{ id: `${id}-default`, type: 'text', label: 'Bölmə', value: '' }],
                            images: []
                        });
                    } else if (id === 'about') {
                        ensureAboutDefaults(found);
                    } else if (id === 'partners') {
                        ensurePartnersDefaults(found);
                    } else if (id === 'hero') {
                        ensureHeroDefaults(found);
                    } else if (id === 'contactpage') {
                        ensureContactDefaults(found);
                    } else if (id === 'eventspage') {
                        ensureEventsDefaults(found);
                    } else if (id === 'newspage') {
                        ensureNewsPageDefaults(found);
                    } else if (id === 'gallerypage') {
                        ensureGalleryPageDefaults(found);
                    } else if (id === 'driverspage') {
                        ensureDriversPageDefaults(found);
                    } else if (id === 'footer') {
                        ensureFooterDefaults(found);
                    } else if (id === 'categoryleaders') {
                        ensureCategoryLeaderDefaults(found);
                    } else if (id === 'nextrace') {
                        ensureNextRaceDefaults(found);
                    } else if (id === 'rulespage') {
                        ensureRulesDefaults(found);
                    } else if (id === 'privacypolicypage') {
                        ensurePrivacyPolicyDefaults(found);
                    } else if (id === 'termsofservicepage') {
                        ensureTermsOfServiceDefaults(found);
                    }
                });

                const aboutPage = updatedContent.find(p => p.id === 'about');
                if (aboutPage) ensureAboutDefaults(aboutPage);
                const partnersPage = updatedContent.find(p => p.id === 'partners');
                if (partnersPage) ensurePartnersDefaults(partnersPage);
                const heroPage = updatedContent.find(p => p.id === 'hero');
                if (heroPage) ensureHeroDefaults(heroPage);
                const contactPage = updatedContent.find(p => p.id === 'contactpage');
                if (contactPage) ensureContactDefaults(contactPage);
                const eventsPage = updatedContent.find(p => p.id === 'eventspage');
                if (eventsPage) ensureEventsDefaults(eventsPage);
                const newsPage = updatedContent.find(p => p.id === 'newspage');
                if (newsPage) ensureNewsPageDefaults(newsPage);
                const galleryPage = updatedContent.find(p => p.id === 'gallerypage');
                if (galleryPage) ensureGalleryPageDefaults(galleryPage);
                const driversPage = updatedContent.find(p => p.id === 'driverspage');
                if (driversPage) ensureDriversPageDefaults(driversPage);
                const footerPage = updatedContent.find(p => p.id === 'footer');
                if (footerPage) ensureFooterDefaults(footerPage);
                const categoryLeadersPage = updatedContent.find(p => p.id === 'categoryleaders');
                if (categoryLeadersPage) ensureCategoryLeaderDefaults(categoryLeadersPage);
                const nextRacePage = updatedContent.find(p => p.id === 'nextrace');
                if (nextRacePage) ensureNextRaceDefaults(nextRacePage);
                const rulesPage = updatedContent.find(p => p.id === 'rulespage');
                if (rulesPage) ensureRulesDefaults(rulesPage);
                const privacyPolicyPage = updatedContent.find(p => p.id === 'privacypolicypage');
                if (privacyPolicyPage) ensurePrivacyPolicyDefaults(privacyPolicyPage);
                const termsOfServicePage = updatedContent.find(p => p.id === 'termsofservicepage');
                if (termsOfServicePage) ensureTermsOfServiceDefaults(termsOfServicePage);

                const defaultRank = new Map(defaultIds.map((id, idx) => [id, idx]));
                updatedContent.sort((a, b) => {
                    const ra = defaultRank.has(a.id) ? (defaultRank.get(a.id) as number) : Number.MAX_SAFE_INTEGER;
                    const rb = defaultRank.has(b.id) ? (defaultRank.get(b.id) as number) : Number.MAX_SAFE_INTEGER;
                    if (ra !== rb) return ra - rb;
                    return (a.title || a.id).localeCompare(b.title || b.id);
                });

                const cleanedContent = updatedContent.map((page: PageContent) => ({
                    ...page,
                    sections: (page.sections || [])
                        .map((section, sectionIndex) => {
                            if (section.type !== 'text') return section;

                            const forcePlain = shouldForcePlainText(section);
                            const nextValue = forcePlain ? normalizeMultilinePlainText(section.value || '') : (section.value || '').replace(/\u00a0/g, ' ');
                            const nextLabel = containsHtmlNoise(section.label || '') ? normalizePlainText(section.label || '') : section.label;

                            return {
                                ...section,
                                label: nextLabel,
                                value: nextValue,
                                ...(section.url ? { url: toAbsoluteUrl(section.url) } : {}),
                                order: normalizeOrder(section.order, sectionIndex)
                            };
                        })
                        .sort((a, b) => normalizeOrder(a.order, 0) - normalizeOrder(b.order, 0)),
                    images: (page.images || [])
                        .map((img, imgIndex) => ({
                            ...img,
                            order: normalizeOrder(img.order, imgIndex)
                        }))
                        .sort((a, b) => normalizeOrder(a.order, 0) - normalizeOrder(b.order, 0))
                }));

                setPages(cleanedContent);
            }

            // 2..7. Load all secondary resources in parallel to avoid slow UI boot.
            const [imagesData, eventsData, newsData, driversData, photosData, videosData] = await Promise.all([
                fetch(`/api/all-images?v=${Date.now()}`).then(res => res.json()).catch(() => ({})),
                fetch(`/api/events?v=${Date.now()}`, { cache: 'no-store' }).then(res => res.json()).catch(() => []),
                fetch(`/api/news?v=${Date.now()}`, { cache: 'no-store' }).then(res => res.json()).catch(() => []),
                fetch(`/api/drivers?v=${Date.now()}`, { cache: 'no-store' }).then(res => res.json()).catch(() => []),
                fetch(`/api/gallery-photos?v=${Date.now()}`, { cache: 'no-store' }).then(res => res.json()).catch(() => []),
                fetch(`/api/videos?v=${Date.now()}`, { cache: 'no-store' }).then(res => res.json()).catch(() => [])
            ]);

            if (imagesData?.local) setAllAvailableImages(imagesData.local);

            if (Array.isArray(eventsData)) {
                const normalizedEvents = eventsData.map((item: any) => {
                    const normalizedEvent = syncEventWithAzTranslations(item);
                    return {
                        ...normalizedEvent,
                        status: normalizeEventStatus(item?.status, item?.date),
                        youtubeUrl: String(item?.youtubeUrl || item?.youtube_url || item?.url || '').trim(),
                        registrationEnabled: normalizeEventRegistrationEnabled(item?.registrationEnabled ?? item?.registration_enabled)
                    };
                });
                setEvents(normalizedEvents);
                if (normalizedEvents.length > 0 && selectedEventId === null) {
                    setSelectedEventId(normalizedEvents[0].id);
                    setEventForm(syncEventWithAzTranslations(normalizedEvents[0]));
                }
            }

            if (Array.isArray(newsData)) {
                const normalizedNews = newsData.map((item: any) => syncNewsWithAzTranslations(item));
                setNews(normalizedNews);
                if (normalizedNews.length > 0 && selectedNewsId === null) {
                    setSelectedNewsId(normalizedNews[0].id);
                    setNewsForm(syncNewsWithAzTranslations(normalizedNews[0]));
                }
            }

            if (Array.isArray(driversData)) {
                setDriverCategories(driversData);
                if (driversData.length > 0 && selectedCatId === null) {
                    setSelectedCatId(driversData[0].id);
                }
            }

            if (Array.isArray(photosData)) {
                const normalizedPhotos = photosData.map((item: any, index: number) => normalizeGalleryPhotoItem(item, index));
                setGalleryPhotos(normalizedPhotos);
                if (normalizedPhotos.length === 0) {
                    setSelectedPhotoId(null);
                    setPhotoForm({});
                }
            }

            if (Array.isArray(videosData)) {
                setVideos(videosData);
                if (videosData.length > 0 && selectedVideoId === null) {
                    handleVideoSelect(videosData[0].id);
                }
            }
        } catch (err) {
            console.error('Content load error:', err);
        }
    };

    useEffect(() => {
        loadContent();
    }, []);

    useEffect(() => {
        if (!pages.length) return;

        const aboutIdx = pages.findIndex((p) => p.id === 'about');
        if (aboutIdx === -1) return;

        const aboutPage = pages[aboutIdx];
        const hasStatPairs = (aboutPage.sections || []).some((s) => isStatSectionId(s.id));
        if (hasStatPairs) return;

        const defaults = [
            { label: 'PİLOTLAR', value: '140+' },
            { label: 'YARIŞLAR', value: '50+' },
            { label: 'GƏNCLƏR', value: '20+' }
        ];

        const patched = [...pages];
        const target = { ...patched[aboutIdx] };
        const sections = [...(target.sections || [])];

        defaults.forEach((item, index) => {
            const suffix = `${index + 1}`;
            sections.push(
                {
                    id: `${STAT_LABEL_PREFIX}${suffix}`,
                    type: 'text',
                    label: `Statistika Etiketi ${index + 1}`,
                    value: item.label
                },
                {
                    id: `${STAT_VALUE_PREFIX}${suffix}`,
                    type: 'text',
                    label: `Statistika Dəyəri ${index + 1}`,
                    value: item.value
                }
            );
        });

        target.sections = sections;
        patched[aboutIdx] = target;
        setPages(patched);
    }, [pages]);

    useEffect(() => {
        if (autoSyncTriggeredRef.current) return;
        autoSyncTriggeredRef.current = true;
        // Prevent destructive auto-rebuild on page open; extraction stays manual.
    }, []);

    // Sync URL params to state
    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const modeParam = queryParams.get('mode');
        const pageParam = queryParams.get('page');

        if (modeParam && ['extract', 'events', 'event-management', 'news', 'drivers', 'videos', 'photos'].includes(modeParam)) {
            setEditorMode(modeParam as any);
        } else if (pageParam) {
            setEditorMode('extract');
            const candidateIds = resolvePageGroup(pageParam);
            const idx = pages.findIndex(p => candidateIds.includes(p.id));
            if (idx !== -1) setSelectedPageIndex(idx);
        }
    }, [location.search, pages]);

    const startExtraction = async () => {
        setIsExtracting(true);
        setExtractStep('Front-end komponentləri skan edilir...');
        setProgress(30);

        const startTime = Date.now();
        const toastId = toast.loading('Sinxronizasiya başladı...');

        try {
            const response = await fetch('/api/extract-content', { method: 'POST' });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(errText || 'Extraction failed');
            }

            setProgress(60);
            setExtractStep('Bulud bazası ilə sinxronizasiya edilir...');

            const data = await response.json();
            const extractedPages = data.pages || data;

            // Sync with JSON storage
            const syncRes = await fetch('/api/save-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(extractedPages)
            });
            if (!syncRes.ok) {
                const errText = await syncRes.text();
                throw new Error(errText || 'Save failed');
            }

            setProgress(90);
            setPages(extractedPages);

            // Artificial delay for UX
            const elapsed = Date.now() - startTime;
            if (elapsed < 800) await new Promise(r => setTimeout(r, 800 - elapsed));

            setProgress(100);
            setExtractStep('Tamamlandı!');

            setTimeout(() => {
                setIsExtracting(false);
                localStorage.setItem('forsaj_extracted', 'true');
                notifySiteContentUpdated();
                toast.success('Sinxronizasiya tamamlandı! Baza yeniləndi.', { id: toastId });
            }, 500);

        } catch (error: any) {
            console.error('Extraction error:', error);
            setIsExtracting(false);
            toast.error(`Sinxronizasiya xətası: ${error.message}`, { id: toastId });
        }
    };

    const handleSectionChange = (pageIdx: number, sectionId: string, field: 'value' | 'label' | 'url', value: string) => {
        const newPages = [...pages];
        const sectionIdx = newPages[pageIdx].sections.findIndex(s => s.id === sectionId);
        if (sectionIdx !== -1) {
            const targetSection = newPages[pageIdx].sections[sectionIdx];
            if (!canEditSectionField(targetSection, field)) return;
            let nextValue = value;
            const key = extractSectionKey(targetSection);
            const plainTextSection =
                !!key ||
                isStatSectionId(targetSection.id) ||
                targetSection.id.startsWith('val-') ||
                targetSection.id.startsWith('txt-');

            if (field === 'value' && plainTextSection) {
                // Keep user-entered spaces/newlines during typing.
                nextValue = normalizeMultilinePlainText(value, { decodeEntities: false });
            } else if (field === 'label' && plainTextSection) {
                nextValue = normalizePlainText(value);
            }

            newPages[pageIdx].sections[sectionIdx][field] = nextValue;
            setPages(newPages);
        }
    };

    const handleSectionTextareaKeyDown = (
        e: React.KeyboardEvent<HTMLTextAreaElement>,
        pageIdx: number,
        sectionId: string
    ) => {
        e.stopPropagation();
        if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;

        e.preventDefault();
        const textarea = e.currentTarget;
        const start = textarea.selectionStart ?? textarea.value.length;
        const end = textarea.selectionEnd ?? textarea.value.length;
        const nextValue = `${textarea.value.slice(0, start)}\n${textarea.value.slice(end)}`;
        const cursor = start + 1;

        handleSectionChange(pageIdx, sectionId, 'value', nextValue);
        requestAnimationFrame(() => {
            try {
                textarea.setSelectionRange(cursor, cursor);
            } catch {
                // no-op
            }
        });
    };

    const normalizeSectionUrl = (pageIdx: number, sectionId: string) => {
        const page = pages[pageIdx];
        if (!page) return;
        const section = page.sections.find(s => s.id === sectionId);
        if (!section || !section.url) return;
        const normalized = toAbsoluteUrl(section.url);
        if (normalized && normalized !== section.url) {
            handleSectionChange(pageIdx, sectionId, 'url', normalized);
        }
    };

    const handleImageAltChange = (pageIdx: number, imgId: string, alt: string) => {
        const newPages = [...pages];
        const imgIdx = newPages[pageIdx].images.findIndex(i => i.id === imgId);
        if (imgIdx !== -1) {
            newPages[pageIdx].images[imgIdx].alt = alt;
            setPages(newPages);
        }
    };

    const addNewSection = () => {
        if (!newSectionTitle.trim()) {
            toast.error('Başlıq daxil edin!');
            return;
        }

        const newId = newSectionTitle.toLowerCase().replace(/\s+/g, '-');
        const newPage: PageContent = {
            id: newId,
            title: newSectionTitle,
            sections: [
                { id: `text-0`, type: 'text', label: 'Bölmə', value: 'Yeni bölmə məzmunu...' }
            ],
            images: [],
        };

        setPages([...pages, newPage]);
        setSelectedPageIndex(pages.length);
        setIsModalOpen(false);
        setNewSectionTitle('');
        toast.success('Yeni bölmə əlavə edildi!');
    };

    const addField = (type: 'text' | 'image', customLabel?: string, customId?: string) => {
        if (selectedPageIndex < 0 || selectedPageIndex >= pages.length) return;
        const newPages = [...pages];
        const currentPage = newPages[selectedPageIndex];
        if (!currentPage) return;

        if (type === 'text') {
            const newId = customId || `text-${currentPage.sections.length}-${Date.now()}`;
            const nextOrder = currentPage.sections.reduce((max, s, idx) => Math.max(max, normalizeOrder(s.order, idx)), -1) + 1;
            currentPage.sections.push({ id: newId, type: 'text', label: customLabel || 'Bölmə', value: 'Yeni mətn sahəsi...', order: nextOrder });
            toast.success(`${customLabel || 'Yeni mətn'} sahəsi əlavə edildi`);
        } else {
            const newId = customId || `img-${currentPage.images.length}-${Date.now()}`;
            const nextOrder = currentPage.images.reduce((max, i, idx) => Math.max(max, normalizeOrder(i.order, idx)), -1) + 1;
            currentPage.images.push({ id: newId, path: '', alt: '', type: 'local', order: nextOrder });
            toast.success('Yeni şəkil sahəsi əlavə edildi');
        }

        setPages(newPages);
    };

    const ensureContactDynamicTopicOptions = (page: PageContent) => {
        const dynamicRows = (page.sections || [])
            .map((section) => {
                const match = String(section.id || '').match(CONTACT_TOPIC_OPTION_REGEX);
                if (!match) return null;
                return {
                    id: section.id,
                    optionNumber: Number(match[1]),
                    value: String(section.value || '')
                };
            })
            .filter((row): row is { id: string; optionNumber: number; value: string } => !!row)
            .sort((a, b) => a.optionNumber - b.optionNumber);

        if (dynamicRows.length > 0) return dynamicRows;

        let nextOrder = (page.sections || []).reduce(
            (max, section, idx) => Math.max(max, normalizeOrder(section.order, idx)),
            -1
        ) + 1;

        CONTACT_LEGACY_TOPIC_FIELDS.forEach((legacyField, index) => {
            const existingLegacy = (page.sections || []).find((section) => section.id === legacyField.id);
            const value = String(existingLegacy?.value || legacyField.fallback).trim() || legacyField.fallback;
            page.sections.push({
                id: `TOPIC_OPTION_${index + 1}`,
                type: 'text',
                label: `Mövzu Seçimi ${index + 1}`,
                value,
                order: nextOrder++
            });
        });

        return (page.sections || [])
            .map((section) => {
                const match = String(section.id || '').match(CONTACT_TOPIC_OPTION_REGEX);
                if (!match) return null;
                return {
                    id: section.id,
                    optionNumber: Number(match[1]),
                    value: String(section.value || '')
                };
            })
            .filter((row): row is { id: string; optionNumber: number; value: string } => !!row)
            .sort((a, b) => a.optionNumber - b.optionNumber);
    };

    const updateContactTopicOptionValue = (
        sectionId: string,
        optionNumber: number,
        value: string,
        pageIdx: number = selectedPageIndex
    ) => {
        if (pageIdx < 0 || pageIdx >= pages.length) return;
        const newPages = [...pages];
        const currentPage = newPages[pageIdx];
        if (!currentPage || currentPage.id !== 'contactpage') return;

        const sectionIndex = (currentPage.sections || []).findIndex((section) => section.id === sectionId);
        if (sectionIndex >= 0) {
            currentPage.sections[sectionIndex] = {
                ...currentPage.sections[sectionIndex],
                label: currentPage.sections[sectionIndex].label || `Mövzu Seçimi ${optionNumber}`,
                value
            };
        } else {
            const nextOrder = (currentPage.sections || []).reduce(
                (max, section, idx) => Math.max(max, normalizeOrder(section.order, idx)),
                -1
            ) + 1;
            currentPage.sections.push({
                id: sectionId,
                type: 'text',
                label: `Mövzu Seçimi ${optionNumber}`,
                value,
                order: nextOrder
            });
        }

        setPages(newPages);
    };

    const addContactTopicOption = (pageIdx: number = selectedPageIndex) => {
        if (pageIdx < 0 || pageIdx >= pages.length) return;
        const newPages = [...pages];
        const currentPage = newPages[pageIdx];
        if (!currentPage || currentPage.id !== 'contactpage') return;

        const dynamicRows = ensureContactDynamicTopicOptions(currentPage);
        const maxOptionNumber = dynamicRows.reduce((max, row) => Math.max(max, row.optionNumber), 0);
        const nextOptionNumber = maxOptionNumber + 1;
        const nextOrder = (currentPage.sections || []).reduce(
            (max, section, idx) => Math.max(max, normalizeOrder(section.order, idx)),
            -1
        ) + 1;

        currentPage.sections.push({
            id: `TOPIC_OPTION_${nextOptionNumber}`,
            type: 'text',
            label: `Mövzu Seçimi ${nextOptionNumber}`,
            value: `SEÇİM ${nextOptionNumber}`,
            order: nextOrder
        });

        setPages(newPages);
        toast.success(`Mövzu seçimi ${nextOptionNumber} əlavə edildi`);
    };

    const removeContactTopicOption = (sectionId: string, pageIdx: number = selectedPageIndex) => {
        if (pageIdx < 0 || pageIdx >= pages.length) return;
        const newPages = [...pages];
        const currentPage = newPages[pageIdx];
        if (!currentPage || currentPage.id !== 'contactpage') return;

        const dynamicRows = ensureContactDynamicTopicOptions(currentPage);
        const legacyIndex = CONTACT_LEGACY_TOPIC_FIELDS.findIndex((field) => field.id === sectionId);
        const normalizedSectionId = legacyIndex >= 0 ? `TOPIC_OPTION_${legacyIndex + 1}` : sectionId;

        if (dynamicRows.length <= 1) {
            toast.error('Ən azı bir seçim qalmalıdır.');
            return;
        }

        currentPage.sections = (currentPage.sections || [])
            .filter((section) => section.id !== normalizedSectionId)
            .map((section, index) => ({ ...section, order: index }));

        setPages(newPages);
        toast.success('Mövzu seçimi silindi');
    };

    const addLegalSectionPair = (pageIdx: number = selectedPageIndex) => {
        if (pageIdx < 0 || pageIdx >= pages.length) return;
        const newPages = [...pages];
        const currentPage = newPages[pageIdx];
        if (!currentPage || !LEGAL_PAGE_IDS.has(currentPage.id)) return;

        const maxSectionNo = (currentPage.sections || []).reduce((max, section) => {
            const match = String(section.id || '').match(LEGAL_DYNAMIC_SECTION_REGEX);
            if (!match) return max;
            const sectionNo = Number(match[1]);
            if (!Number.isFinite(sectionNo)) return max;
            return Math.max(max, sectionNo);
        }, 0);

        const nextSectionNo = maxSectionNo + 1;
        const nextOrder = (currentPage.sections || []).reduce(
            (max, section, idx) => Math.max(max, normalizeOrder(section.order, idx)),
            -1
        ) + 1;

        currentPage.sections.push(
            {
                id: `SECTION_${nextSectionNo}_TITLE`,
                type: 'text',
                label: `Bölmə ${nextSectionNo} Başlıq`,
                value: `${nextSectionNo}. Yeni Bölmə`,
                order: nextOrder
            },
            {
                id: `SECTION_${nextSectionNo}_ICON`,
                type: 'text',
                label: `Bölmə ${nextSectionNo} İkon`,
                value: '',
                order: nextOrder + 1
            },
            {
                id: `SECTION_${nextSectionNo}_BODY`,
                type: 'text',
                label: `Bölmə ${nextSectionNo} Mətn`,
                value: 'Bu bölmənin mətni buraya yazılır.',
                order: nextOrder + 2
            }
        );

        setPages(newPages);
        setPendingLegalSectionScrollNo(nextSectionNo);
        toast.success(`Bölmə ${nextSectionNo} əlavə edildi`);
    };

    const updateLegalSectionFieldValue = (
        sectionNo: number,
        field: 'TITLE' | 'ICON' | 'BODY',
        value: string,
        pageIdx: number = selectedPageIndex
    ) => {
        if (pageIdx < 0 || pageIdx >= pages.length) return;
        const newPages = [...pages];
        const currentPage = newPages[pageIdx];
        if (!currentPage || !LEGAL_PAGE_IDS.has(currentPage.id)) return;

        const targetId = `SECTION_${sectionNo}_${field}`;
        const targetLabel = field === 'TITLE'
            ? `Bölmə ${sectionNo} Başlıq`
            : field === 'ICON'
                ? `Bölmə ${sectionNo} İkon`
                : `Bölmə ${sectionNo} Mətn`;
        const sectionIndex = (currentPage.sections || []).findIndex((section) => section.id === targetId);

        if (sectionIndex >= 0) {
            currentPage.sections[sectionIndex] = {
                ...currentPage.sections[sectionIndex],
                label: currentPage.sections[sectionIndex].label || targetLabel,
                value
            };
        } else {
            const nextOrder = (currentPage.sections || []).reduce(
                (max, section, idx) => Math.max(max, normalizeOrder(section.order, idx)),
                -1
            ) + 1;
            currentPage.sections.push({
                id: targetId,
                type: 'text',
                label: targetLabel,
                value,
                order: nextOrder
            });
        }

        setPages(newPages);
    };

    const removeLegalSectionPair = (sectionNo: number, pageIdx: number = selectedPageIndex) => {
        if (pageIdx < 0 || pageIdx >= pages.length) return;
        const newPages = [...pages];
        const currentPage = newPages[pageIdx];
        if (!currentPage || !LEGAL_PAGE_IDS.has(currentPage.id)) return;

        const sectionNumbers = Array.from(
            new Set(
                (currentPage.sections || [])
                    .map((section) => {
                        const match = String(section.id || '').match(LEGAL_DYNAMIC_SECTION_REGEX);
                        if (!match) return null;
                        const value = Number(match[1]);
                        return Number.isFinite(value) ? value : null;
                    })
                    .filter((value): value is number => value !== null)
            )
        ).sort((a, b) => a - b);

        if (sectionNumbers.length <= 1) {
            toast.error('Ən azı bir bölmə qalmalıdır.');
            return;
        }

        const targetIds = new Set([
            `SECTION_${sectionNo}_TITLE`,
            `SECTION_${sectionNo}_ICON`,
            `SECTION_${sectionNo}_BODY`
        ]);
        const hasAnyTarget = (currentPage.sections || []).some((section) => targetIds.has(section.id));
        if (!hasAnyTarget) return;

        currentPage.sections = (currentPage.sections || [])
            .filter((section) => !targetIds.has(section.id))
            .map((section, index) => ({ ...section, order: index }));

        setPages(newPages);
        toast.success(`Bölmə ${sectionNo} silindi`);
    };

    const removeField = (type: 'text' | 'image', fieldId: string, pageIdx: number = selectedPageIndex) => {
        if (pageIdx < 0 || pageIdx >= pages.length) return;
        const newPages = [...pages];
        const currentPage = newPages[pageIdx];
        if (!currentPage) return;

        if (type === 'text') {
            currentPage.sections = currentPage.sections.filter(s => s.id !== fieldId);
            currentPage.sections = currentPage.sections.map((s, idx) => ({ ...s, order: idx }));
        } else {
            currentPage.images = currentPage.images.filter(img => img.id !== fieldId);
            currentPage.images = currentPage.images.map((img, idx) => ({ ...img, order: idx }));
        }

        setPages(newPages);
        toast.success('Sahə silindi');
    };

    const moveField = (type: 'text' | 'image', fieldId: string, direction: 'up' | 'down', pageIdx: number = selectedPageIndex) => {
        if (pageIdx < 0 || pageIdx >= pages.length) return;
        const newPages = [...pages];
        const currentPage = newPages[pageIdx];
        if (!currentPage) return;

        const list = type === 'text' ? currentPage.sections : currentPage.images;
        const idx = list.findIndex((item: any) => item.id === fieldId);
        if (idx === -1) return;

        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= list.length) return;

        const temp = list[idx];
        list[idx] = list[targetIdx];
        list[targetIdx] = temp;
        if (type === 'text') {
            currentPage.sections = (currentPage.sections || []).map((s, index) => ({ ...s, order: index }));
        } else {
            currentPage.images = (currentPage.images || []).map((img, index) => ({ ...img, order: index }));
        }

        setPages(newPages);
    };

    const addAboutStatRow = (pageIdx: number = selectedPageIndex) => {
        if (pageIdx < 0 || pageIdx >= pages.length) return;
        const newPages = [...pages];
        const current = newPages[pageIdx];
        if (!current || current.id !== 'about') return;

        const suffix = `${Date.now()}`;
        current.sections.push(
            { id: `${STAT_LABEL_PREFIX}${suffix}`, type: 'text', label: 'Statistika Etiketi', value: 'YENİ STATİSTİKA' },
            { id: `${STAT_VALUE_PREFIX}${suffix}`, type: 'text', label: 'Statistika Dəyəri', value: '0+' }
        );
        setPages(newPages);
        toast.success('Yeni statistika əlavə edildi');
    };

    const updateAboutStatField = (suffix: string, field: 'label' | 'value', value: string, pageIdx: number = selectedPageIndex) => {
        if (pageIdx < 0 || pageIdx >= pages.length) return;
        const newPages = [...pages];
        const current = newPages[pageIdx];
        if (!current || current.id !== 'about') return;

        const targetId = field === 'label' ? `${STAT_LABEL_PREFIX}${suffix}` : `${STAT_VALUE_PREFIX}${suffix}`;
        const idx = current.sections.findIndex(s => s.id === targetId);

        const normalized = normalizePlainText(value);

        if (idx !== -1) {
            current.sections[idx].value = normalized;
        } else {
            current.sections.push({
                id: targetId,
                type: 'text',
                label: field === 'label' ? 'Statistika Etiketi' : 'Statistika Dəyəri',
                value: normalized
            });
        }

        setPages(newPages);
    };

    const removeAboutStatRow = (suffix: string, pageIdx: number = selectedPageIndex) => {
        if (pageIdx < 0 || pageIdx >= pages.length) return;
        const newPages = [...pages];
        const current = newPages[pageIdx];
        if (!current || current.id !== 'about') return;

        current.sections = current.sections.filter(
            s => s.id !== `${STAT_LABEL_PREFIX}${suffix}` && s.id !== `${STAT_VALUE_PREFIX}${suffix}`
        );
        setPages(newPages);
        toast.success('Statistika silindi');
    };

    const addCoreValueRow = (pageIdx: number = selectedPageIndex) => {
        const newPages = [...pages];
        let targetIdx = pageIdx;

        if (targetIdx < 0 || targetIdx >= newPages.length || !['about', 'values'].includes(newPages[targetIdx]?.id)) {
            targetIdx = newPages.findIndex((p) => p.id === 'about');
        }
        if (targetIdx < 0 || targetIdx >= newPages.length) return;

        const current = newPages[targetIdx];
        const suffix = `${Date.now()}`;
        current.sections.push(
            { id: `val-icon-${suffix}`, type: 'text', label: 'İkon Kodu (Shield/Users/Leaf/Zap)', value: 'Shield' },
            { id: `val-title-${suffix}`, type: 'text', label: 'Dəyər Başlığı', value: 'YENİ DƏYƏR' },
            { id: `val-desc-${suffix}`, type: 'text', label: 'Dəyər Təsviri', value: 'Dəyər təsvirini daxil edin.' }
        );

        setPages(newPages);
        toast.success('Yeni dəyər əlavə edildi');
    };

    const updateCoreValueField = (suffix: string, field: CoreValueField, value: string, pageIdx: number = selectedPageIndex) => {
        if (pageIdx < 0 || pageIdx >= pages.length) return;
        const newPages = [...pages];
        const current = newPages[pageIdx];
        if (!current || !['about', 'values'].includes(current.id)) return;

        const targetId = `val-${field}-${suffix}`;
        const sectionIdx = (current.sections || []).findIndex((s) => s.id === targetId);
        const normalizedValue = field === 'icon'
            ? String(value || '').trim()
            : field === 'desc'
                ? normalizeMultilinePlainText(value)
                : normalizePlainText(value);

        if (sectionIdx !== -1) {
            current.sections[sectionIdx].value = normalizedValue;
        } else {
            const defaultLabel = field === 'icon'
                ? 'İkon Kodu (Shield/Users/Leaf/Zap)'
                : field === 'title'
                    ? 'Dəyər Başlığı'
                    : 'Dəyər Təsviri';
            current.sections.push({
                id: targetId,
                type: 'text',
                label: defaultLabel,
                value: normalizedValue
            });
        }

        setPages(newPages);
    };

    const removeCoreValueRow = (suffix: string, pageIdx: number = selectedPageIndex) => {
        if (pageIdx < 0 || pageIdx >= pages.length) return;
        const newPages = [...pages];
        const current = newPages[pageIdx];
        if (!current || !['about', 'values'].includes(current.id)) return;

        current.sections = (current.sections || []).filter((section) => {
            const parsed = parseCoreValueField(section.id);
            return !parsed || parsed.suffix !== suffix;
        });

        setPages(newPages);
        if (editorMode === 'extract') {
            void savePagesSilently(newPages);
        }
        toast.success('Dəyər silindi');
    };

    const getPartnerRows = (page: PageContent | undefined): PartnerRow[] => {
        if (!page) return [];
        const rows = new Map<number, PartnerRow>();
        (page.sections || []).forEach((section) => {
            const m = section.id.match(PARTNER_KEY_REGEX);
            if (!m) return;
            const idx = Number(m[1]);
            const field = toPartnerField(m[2]);
            if (!field) return;

            const current = rows.get(idx) || {
                index: idx,
                name: '',
                tag: 'OFFICIAL PARTNER',
                icon: 'ShieldCheck',
                useImage: 'false',
                imageId: `partner-image-${idx}`,
                linkUrl: ''
            };
            current[field] = section.value || '';
            rows.set(idx, current);
        });
        return Array.from(rows.values()).sort((a, b) => a.index - b.index);
    };

    const normalizePartnerImageId = (row: PartnerRow) => {
        const raw = (row.imageId || '').trim();
        return raw || `partner-image-${row.index}`;
    };

    const rewritePartnerRows = (rows: PartnerRow[], pageIdx: number = selectedPageIndex) => {
        if (pageIdx < 0 || pageIdx >= pages.length) return;
        const newPages = [...pages];
        const page = newPages[pageIdx];
        if (!page || page.id !== 'partners') return;

        const restSections = (page.sections || []).filter(s => !PARTNER_KEY_REGEX.test(s.id));
        const partnerSections: Section[] = [];

        rows.forEach((row) => {
            const imageId = normalizePartnerImageId(row);
            partnerSections.push(
                { id: `PARTNER_${row.index}_NAME`, type: 'text', label: `Tərəfdaş ${row.index} Ad`, value: row.name },
                { id: `PARTNER_${row.index}_TAG`, type: 'text', label: `Tərəfdaş ${row.index} Etiket`, value: row.tag },
                { id: `PARTNER_${row.index}_ICON`, type: 'text', label: `Tərəfdaş ${row.index} İkon`, value: row.icon },
                { id: `PARTNER_${row.index}_USE_IMAGE`, type: 'text', label: `Tərəfdaş ${row.index} Görsel İstifadə`, value: row.useImage },
                { id: `PARTNER_${row.index}_IMAGE_ID`, type: 'text', label: `Tərəfdaş ${row.index} Görsel ID`, value: imageId },
                { id: `PARTNER_${row.index}_LINK_URL`, type: 'text', label: `Tərəfdaş ${row.index} Link`, value: row.linkUrl || '' }
            );
        });

        const existingImages = page.images || [];
        const neededImageIds = new Set(rows.map((row) => normalizePartnerImageId(row)));
        const nextImages = [...existingImages];
        neededImageIds.forEach((id) => {
            if (nextImages.some(img => img.id === id)) return;
            nextImages.push({ id, path: '', alt: id, type: 'local', order: nextImages.length });
        });

        page.sections = [...restSections, ...partnerSections];
        page.images = nextImages.map((img, idx) => ({ ...img, order: idx }));
        setPages(newPages);
    };

    const updatePartnerRowField = (index: number, field: PartnerField, value: string, pageIdx: number = selectedPageIndex) => {
        const rows = getPartnerRows(pages[pageIdx]).map(r => r.index === index ? { ...r, [field]: value } : r);
        rewritePartnerRows(rows, pageIdx);
    };

    const addPartnerRow = (pageIdx: number = selectedPageIndex) => {
        const rows = getPartnerRows(pages[pageIdx]);
        const nextIndex = (rows[rows.length - 1]?.index || 0) + 1;
        rows.push({
            index: nextIndex,
            name: `PARTNER ${nextIndex}`,
            tag: 'OFFICIAL PARTNER',
            icon: 'ShieldCheck',
            useImage: 'false',
            imageId: `partner-image-${nextIndex}`,
            linkUrl: ''
        });
        rewritePartnerRows(rows, pageIdx);
    };

    const removePartnerRow = (index: number, pageIdx: number = selectedPageIndex) => {
        const rows = getPartnerRows(pages[pageIdx]).filter(r => r.index !== index);
        rewritePartnerRows(rows, pageIdx);
    };

    const movePartnerRow = (index: number, direction: 'up' | 'down', pageIdx: number = selectedPageIndex) => {
        const rows = getPartnerRows(pages[pageIdx]);
        const idx = rows.findIndex(r => r.index === index);
        if (idx === -1) return;
        const target = direction === 'up' ? idx - 1 : idx + 1;
        if (target < 0 || target >= rows.length) return;
        const temp = rows[idx];
        rows[idx] = rows[target];
        rows[target] = temp;
        const normalized = rows.map((r, i) => ({ ...r, index: i + 1, imageId: normalizePartnerImageId({ ...r, index: i + 1 }) }));
        rewritePartnerRows(normalized, pageIdx);
    };

    const ensurePartnerImageSlot = (row: PartnerRow, pageIdx: number = selectedPageIndex) => {
        if (pageIdx < 0 || pageIdx >= pages.length) return '';
        const newPages = [...pages];
        const page = newPages[pageIdx];
        if (!page || page.id !== 'partners') return '';

        const imageId = normalizePartnerImageId(row);
        const existing = (page.images || []).find((img) => img.id === imageId);
        if (existing) return imageId;

        const nextImages = [...(page.images || [])];
        nextImages.push({
            id: imageId,
            path: '',
            alt: row.name || `Partner ${row.index}`,
            type: 'local',
            order: nextImages.length
        });
        page.images = nextImages;
        setPages(newPages);
        return imageId;
    };

    const updatePartnerImageAsset = (
        row: PartnerRow,
        updates: { path?: string; alt?: string },
        pageIdx: number = selectedPageIndex
    ) => {
        if (pageIdx < 0 || pageIdx >= pages.length) return;
        const imageId = normalizePartnerImageId(row);
        const newPages = [...pages];
        const page = newPages[pageIdx];
        if (!page || page.id !== 'partners') return;

        const nextImages = [...(page.images || [])];
        let imgIdx = nextImages.findIndex((img) => img.id === imageId);
        if (imgIdx === -1) {
            nextImages.push({
                id: imageId,
                path: '',
                alt: row.name || `Partner ${row.index}`,
                type: 'local',
                order: nextImages.length
            });
            imgIdx = nextImages.length - 1;
        }

        if (typeof updates.path === 'string') nextImages[imgIdx].path = updates.path;
        if (typeof updates.alt === 'string') nextImages[imgIdx].alt = updates.alt;

        page.images = nextImages.map((img, idx) => ({ ...img, order: idx }));
        setPages(newPages);
    };

    const normalizeRuleTabSlug = (value: string, fallback: string) => {
        const token = normalizePlainText(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        return token || fallback;
    };

    const RULE_TAB_LEGACY_PRESETS = [
        {
            id: 'pilot',
            icon: 'Info',
            titleKey: 'RULES_PILOT_TITLE',
            titleFallback: 'PİLOT PROTOKOLU',
            items: [
                { titleKey: 'RULES_PILOT_SUB1', titleFallback: 'İSTİFADƏÇİ ÖHDƏLİKLƏRİ', descKey: 'RULES_PILOT_DESC1', descFallback: 'HƏR BİR İŞTİRAKÇI FEDERASİYANIN MÜƏYYƏN ETDİYİ BÜTÜN TEXNİKİ VƏ ETİK NORMALARI QEYD-ŞƏRTSİZ QƏBUL EDİR.' },
                { titleKey: 'RULES_PILOT_SUB2', titleFallback: 'DİSKVALİFİKASİYA', descKey: 'RULES_PILOT_DESC2', descFallback: 'PROTOKOLDAN KƏNARA ÇIXMAQ VƏ YA HAKİM QƏRARLARINA ETİRAZ ETMƏK DƏRHAL DİSKVALİFİKASİYA İLƏ NƏTİCƏLƏNƏ BİLƏR.' },
                { titleKey: 'RULES_PILOT_SUB3', titleFallback: 'TEXNİKİ TƏLƏBLƏR', descKey: 'RULES_PILOT_DESC3', descFallback: 'BÜTÜN AVADANLIQLAR YARIŞDAN 24 SAAT ƏVVƏL TEXNİKİ KOMİSSİYA TƏRƏFİNDƏN YOXLANILMALI VƏ TƏHLÜKƏSİZLİK SERTİFİKATI İLƏ TƏMİN EDİLMƏLİDİR.' }
            ]
        },
        {
            id: 'technical',
            icon: 'Settings',
            titleKey: 'RULES_TECH_TITLE',
            titleFallback: 'TEXNİKİ NORMARTİVLƏR',
            items: [
                { titleKey: 'RULES_TECH_SUB1', titleFallback: 'TƏKƏR ÖLÇÜLƏRİ', descKey: 'RULES_TECH_DESC1', descFallback: 'PRO CLASS ÜÇÜN MAKSİMUM TƏKƏR ÖLÇÜSÜ 37 DÜYM, AMATEUR CLASS ÜÇÜN İSƏ 33 DÜYM OLARAQ MÜƏYYƏN EDİLMİŞDİR.' },
                { titleKey: 'RULES_TECH_SUB2', titleFallback: 'MÜHƏRRİK GÜCÜ', descKey: 'RULES_TECH_DESC2', descFallback: 'MÜHƏRRİK ÜZƏRİNDƏ APARILAN MODİFİKASİYALAR KATEQORİYA ÜZRƏ LİMİTLƏRİ AŞMAMALIDIR. TURBO SİSTEMLƏRİ YALNIZ XÜSUSİ KLASLARDA İCAZƏLİDİR.' },
                { titleKey: 'RULES_TECH_SUB3', titleFallback: 'ASQI SİSTEMİ', descKey: 'RULES_TECH_DESC3', descFallback: 'AVTOMOBİLİN KLİRENSİ (YERDƏN HÜNDÜRLÜYÜ) VƏ ASQI ARTIKULYASİYASI TƏHLÜKƏSİZLİK STANDARTLARINA UYĞUN OLMALIDIR.' }
            ]
        },
        {
            id: 'safety',
            icon: 'ShieldAlert',
            titleKey: 'RULES_SAFETY_TITLE',
            titleFallback: 'TƏHLÜKƏSİZLİK QAYDALARI',
            items: [
                { titleKey: 'RULES_SAFETY_SUB1', titleFallback: 'KARKAS TƏLƏBİ', descKey: 'RULES_SAFETY_DESC1', descFallback: 'BÜTÜN AÇIQ VƏ YA MODİFİKASİYA OLUNMUŞ AVTOMOBİLLƏRDƏ FIA STANDARTLARINA UYĞUN TƏHLÜKƏSİZLİK KARKASI (ROLL CAGE) MƏCBURİDİR.' },
                { titleKey: 'RULES_SAFETY_SUB2', titleFallback: 'YANĞIN SÖNDÜRMƏ', descKey: 'RULES_SAFETY_DESC2', descFallback: 'HƏR BİR AVTOMOBİLDƏ ƏN AZI 2 KİLOQRAMLIQ, ASAN ƏLÇATAN YERDƏ YERLƏŞƏN YANĞINSÖNDÜRƏN BALON OLMALIDIR.' },
                { titleKey: 'RULES_SAFETY_SUB3', titleFallback: 'KƏMƏR VƏ DƏBİLQƏ', descKey: 'RULES_SAFETY_DESC3', descFallback: '5 NÖQTƏLİ TƏHLÜKƏSİZLİK KƏMƏRLƏRİ VƏ SERTİFİKATLI KASKALARIN (DƏBİLQƏLƏRİN) İSTİFADƏSİ BÜTÜN MƏRHƏLƏLƏRDƏ MƏCBURİDİR.' }
            ]
        },
        {
            id: 'eco',
            icon: 'Leaf',
            titleKey: 'RULES_ECO_TITLE',
            titleFallback: 'EKOLOJİ MƏSULİYYƏT',
            items: [
                { titleKey: 'RULES_ECO_SUB1', titleFallback: 'TULLANTILARIN İDARƏ EDİLMƏSİ', descKey: 'RULES_ECO_DESC1', descFallback: 'YARIŞ ƏRAZİSİNDƏ VƏ TRASDA HƏR HANSI BİR TULLANTININ ATILMASI QƏTİ QADAĞANDIR. İŞTİRAKÇILAR "LEAVE NO TRACE" PRİNSİPİNƏ ƏMƏL ETMƏLİDİR.' },
                { titleKey: 'RULES_ECO_SUB2', titleFallback: 'MAYE SIZMALARI', descKey: 'RULES_ECO_DESC2', descFallback: 'AVTOMOBİLDƏN YAĞ VƏ YA SOYUDUCU MAYE SIZMASI OLDUĞU TƏQDİRDƏ PİLOT DƏRHAL DAYANMALI VƏ ƏRAZİNİN ÇİRKLƏNMƏSİNİN QARŞISINI ALMALIDIR.' },
                { titleKey: 'RULES_ECO_SUB3', titleFallback: 'MARŞRUTDAN KƏNARA ÇIXMAMAQ', descKey: 'RULES_ECO_DESC3', descFallback: 'TƏBİİ ÖRTÜYÜ QORUMAQ MƏQSƏDİ İLƏ MÜƏYYƏN OLUNMUŞ TRASDANKƏNAR SÜRÜŞLƏR VƏ YA YAŞIL SAHƏLƏRƏ ZƏRƏR VERMƏK QADAĞANDIR.' }
            ]
        }
    ];

    const pickLegacyRuleSectionValue = (sections: Section[], key: string, fallback: string) => {
        const raw = normalizePlainText((sections.find((s) => s.id === key)?.value || '').toString());
        if (!raw || looksLikeKeyToken(raw)) return fallback;
        return raw;
    };

    const buildLegacyRuleTabRows = (sections: Section[]): RuleTabRow[] => {
        return RULE_TAB_LEGACY_PRESETS.map((preset, index) => ({
            index: index + 1,
            id: preset.id,
            title: pickLegacyRuleSectionValue(sections, preset.titleKey, preset.titleFallback),
            icon: preset.icon,
            items: preset.items.map((item, itemIndex) => ({
                index: itemIndex + 1,
                title: pickLegacyRuleSectionValue(sections, item.titleKey, item.titleFallback),
                desc: pickLegacyRuleSectionValue(sections, item.descKey, item.descFallback)
            }))
        }));
    };

    const normalizeRuleTabKey = (value: string) => normalizeRuleTabSlug(value || '', '');

    const getRulesTabRows = (page: PageContent | undefined): RuleTabRow[] => {
        if (!page || page.id !== 'rulespage') return [];

        const tabs = new Map<number, { id: string; title: string; icon: string; items: Map<number, { title: string; desc: string }> }>();
        (page.sections || []).forEach((section) => {
            const tabMatch = section.id.match(RULE_TAB_FIELD_REGEX);
            if (tabMatch) {
                const tabNo = Number(tabMatch[1]);
                const field = tabMatch[2];
                const current = tabs.get(tabNo) || {
                    id: `tab-${tabNo}`,
                    title: '',
                    icon: 'Info',
                    items: new Map<number, { title: string; desc: string }>()
                };
                if (field === 'ID') current.id = section.value || `tab-${tabNo}`;
                if (field === 'TITLE') current.title = section.value || '';
                if (field === 'ICON') current.icon = section.value || 'Info';
                tabs.set(tabNo, current);
                return;
            }

            const itemMatch = section.id.match(RULE_TAB_ITEM_FIELD_REGEX);
            if (itemMatch) {
                const tabNo = Number(itemMatch[1]);
                const itemNo = Number(itemMatch[2]);
                const field = itemMatch[3];
                const current = tabs.get(tabNo) || {
                    id: `tab-${tabNo}`,
                    title: '',
                    icon: 'Info',
                    items: new Map<number, { title: string; desc: string }>()
                };
                const item = current.items.get(itemNo) || { title: '', desc: '' };
                if (field === 'TITLE') item.title = section.value || '';
                if (field === 'DESC') item.desc = section.value || '';
                current.items.set(itemNo, item);
                tabs.set(tabNo, current);
            }
        });

        const dynamicRows = Array.from(tabs.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([index, tab]) => ({
                index,
                id: tab.id || `tab-${index}`,
                title: tab.title || '',
                icon: tab.icon || 'Info',
                items: Array.from(tab.items.entries())
                    .sort((a, b) => a[0] - b[0])
                    .map(([itemIndex, item]) => ({
                        index: itemIndex,
                        title: item.title || '',
                        desc: item.desc || ''
                    }))
            }))
            .filter((tab) => tab.title || tab.items.length > 0);

        const legacyRows = buildLegacyRuleTabRows(page.sections || []);
        if (!dynamicRows.length) return legacyRows;

        const dynamicByKey = new Map<string, RuleTabRow>();
        dynamicRows.forEach((row) => {
            dynamicByKey.set(normalizeRuleTabKey(row.id || row.title || ''), row);
        });

        const usedKeys = new Set<string>();
        const mergedRows: RuleTabRow[] = legacyRows.map((legacyRow) => {
            const key = normalizeRuleTabKey(legacyRow.id || legacyRow.title || '');
            const dynamic = dynamicByKey.get(key);
            if (!dynamic) return legacyRow;
            usedKeys.add(key);
            return {
                ...legacyRow,
                ...dynamic,
                id: dynamic.id || legacyRow.id,
                title: dynamic.title || legacyRow.title,
                icon: dynamic.icon || legacyRow.icon,
                items: (dynamic.items && dynamic.items.length > 0) ? dynamic.items : legacyRow.items
            };
        });

        dynamicRows.forEach((row) => {
            const key = normalizeRuleTabKey(row.id || row.title || '');
            if (!usedKeys.has(key)) mergedRows.push(row);
        });

        return mergedRows.map((row, index) => ({ ...row, index: index + 1 }));
    };

    const rewriteRulesTabRows = (rows: RuleTabRow[], pageIdx: number = selectedPageIndex) => {
        if (pageIdx < 0 || pageIdx >= pages.length) return;
        const newPages = [...pages];
        const page = newPages[pageIdx];
        if (!page || page.id !== 'rulespage') return;

        const restSections = (page.sections || []).filter((s) => !RULE_TAB_SECTION_REGEX.test(s.id));
        const nextSections: Section[] = [];

        rows.forEach((row, tabIndex) => {
            const tabNo = tabIndex + 1;
            const safeId = normalizeRuleTabSlug(row.id || row.title || '', `tab-${tabNo}`);
            const safeTitle = normalizePlainText(row.title || `SEKME ${tabNo}`);
            const safeIcon = RULE_TAB_ICON_PRESETS.includes(row.icon) ? row.icon : 'Info';

            nextSections.push(
                { id: `RULE_TAB_${tabNo}_ID`, type: 'text', label: `Qayda Sekməsi ${tabNo} ID`, value: safeId },
                { id: `RULE_TAB_${tabNo}_TITLE`, type: 'text', label: `Qayda Sekməsi ${tabNo} Başlıq`, value: safeTitle },
                { id: `RULE_TAB_${tabNo}_ICON`, type: 'text', label: `Qayda Sekməsi ${tabNo} İkon`, value: safeIcon }
            );

            (row.items || []).forEach((item, itemIndex) => {
                const itemNo = itemIndex + 1;
                nextSections.push(
                    { id: `RULE_TAB_${tabNo}_ITEM_${itemNo}_TITLE`, type: 'text', label: `Sekmə ${tabNo} Maddə ${itemNo} Başlıq`, value: normalizePlainText(item.title || '') },
                    { id: `RULE_TAB_${tabNo}_ITEM_${itemNo}_DESC`, type: 'text', label: `Sekmə ${tabNo} Maddə ${itemNo} Təsvir`, value: normalizeMultilinePlainText(item.desc || '') }
                );
            });
        });

        page.sections = [...restSections, ...nextSections].map((section, idx) => ({ ...section, order: idx }));
        setPages(newPages);
        return newPages;
    };

    const addRulesTab = (pageIdx: number = selectedPageIndex) => {
        const rows = getRulesTabRows(pages[pageIdx]);
        const nextNo = rows.length + 1;
        rows.push({
            index: nextNo,
            id: `tab-${nextNo}`,
            title: `SEKME ${nextNo}`,
            icon: 'Info',
            items: [{ index: 1, title: 'YENİ MADDƏ', desc: 'Maddə təsviri...' }]
        });
        rewriteRulesTabRows(rows, pageIdx);
        toast.success('Yeni sekmə əlavə edildi');
    };

    const removeRulesTab = (rowIdx: number, pageIdx: number = selectedPageIndex) => {
        const rows = getRulesTabRows(pages[pageIdx]).filter((_, index) => index !== rowIdx);
        rewriteRulesTabRows(rows, pageIdx);
        toast.success('Sekmə silindi');
    };

    const moveRulesTab = (rowIdx: number, direction: 'up' | 'down', pageIdx: number = selectedPageIndex) => {
        const rows = getRulesTabRows(pages[pageIdx]);
        const target = direction === 'up' ? rowIdx - 1 : rowIdx + 1;
        if (target < 0 || target >= rows.length) return;
        const temp = rows[rowIdx];
        rows[rowIdx] = rows[target];
        rows[target] = temp;
        rewriteRulesTabRows(rows, pageIdx);
    };

    const updateRulesTabField = (
        rowIdx: number,
        field: 'id' | 'title' | 'icon',
        value: string,
        pageIdx: number = selectedPageIndex
    ) => {
        const rows = getRulesTabRows(pages[pageIdx]);
        if (!rows[rowIdx]) return;
        rows[rowIdx] = { ...rows[rowIdx], [field]: value };
        rewriteRulesTabRows(rows, pageIdx);
    };

    const deriveFileNameFromUrl = (rawUrl: string) => {
        const cleaned = (rawUrl || '').split('?')[0].split('#')[0];
        if (!cleaned) return '';
        const token = cleaned.substring(cleaned.lastIndexOf('/') + 1).trim();
        if (!token) return '';
        try {
            return decodeURIComponent(token);
        } catch {
            return token;
        }
    };

    const getRulesGeneralPdfState = (page: PageContent | undefined) => {
        const section = (page?.sections || []).find((s) => s.id === 'BTN_DOWNLOAD_PDF');
        const buttonText = normalizePlainText((section?.value || '').toString()) || 'PDF YÜKLƏ';
        const url = toAbsoluteUrl((section?.url || '').toString());
        return {
            buttonText,
            url,
            fileName: deriveFileNameFromUrl(url)
        };
    };

    const updateRulesGeneralPdf = (
        patch: { buttonText?: string; url?: string },
        pageIdx: number = selectedPageIndex
    ) => {
        if (pageIdx < 0 || pageIdx >= pages.length) return null;
        const newPages = [...pages];
        const page = newPages[pageIdx];
        if (!page || page.id !== 'rulespage') return null;

        const sections = [...(page.sections || [])];
        let sectionIdx = sections.findIndex((s) => s.id === 'BTN_DOWNLOAD_PDF');
        if (sectionIdx === -1) {
            sections.push({
                id: 'BTN_DOWNLOAD_PDF',
                type: 'text',
                label: 'Ümumi PDF Düyməsi',
                value: 'PDF YÜKLƏ',
                url: ''
            });
            sectionIdx = sections.length - 1;
        }

        const section = { ...sections[sectionIdx] };
        if (patch.buttonText !== undefined) {
            section.value = normalizePlainText(patch.buttonText) || 'PDF YÜKLƏ';
        }
        if (patch.url !== undefined) {
            section.url = toStoredUrl(patch.url || '');
            if (!normalizePlainText((section.value || '').toString())) {
                section.value = 'PDF YÜKLƏ';
            }
        }
        sections[sectionIdx] = section;

        page.sections = sections.map((item, idx) => ({ ...item, order: idx }));
        setPages(newPages);
        return newPages;
    };

    const handleRulesGeneralPdfUpload = async (file: File, pageIdx: number = selectedPageIndex) => {
        const url = await uploadPdf(file);
        if (!url) return;
        const nextPages = updateRulesGeneralPdf({ url }, pageIdx);
        if (nextPages && editorMode === 'extract') {
            await savePagesSilently(nextPages);
        }
    };

    const addRulesTabItem = (rowIdx: number, pageIdx: number = selectedPageIndex) => {
        const rows = getRulesTabRows(pages[pageIdx]);
        if (!rows[rowIdx]) return;
        const nextNo = (rows[rowIdx].items?.length || 0) + 1;
        rows[rowIdx].items = [...(rows[rowIdx].items || []), { index: nextNo, title: `MADDƏ ${nextNo}`, desc: 'Maddə təsviri...' }];
        rewriteRulesTabRows(rows, pageIdx);
    };

    const removeRulesTabItem = (rowIdx: number, itemIdx: number, pageIdx: number = selectedPageIndex) => {
        const rows = getRulesTabRows(pages[pageIdx]);
        if (!rows[rowIdx]) return;
        rows[rowIdx].items = (rows[rowIdx].items || []).filter((_, index) => index !== itemIdx);
        rewriteRulesTabRows(rows, pageIdx);
    };

    const updateRulesTabItemField = (
        rowIdx: number,
        itemIdx: number,
        field: 'title' | 'desc',
        value: string,
        pageIdx: number = selectedPageIndex
    ) => {
        const rows = getRulesTabRows(pages[pageIdx]);
        if (!rows[rowIdx] || !rows[rowIdx].items[itemIdx]) return;
        rows[rowIdx].items[itemIdx] = {
            ...rows[rowIdx].items[itemIdx],
            [field]: value
        };
        rewriteRulesTabRows(rows, pageIdx);
    };

    const openImageSelector = (pageIdx: number, imgId: string) => {
        setActiveImageField({ pageIdx, imgId });
        setIsImageSelectorOpen(true);
    };

    const uploadAsset = async (
        file: File,
        options?: { loadingText?: string; successText?: string; errorText?: string }
    ): Promise<string | null> => {
        const formData = new FormData();
        formData.append('image', file);
        const uploadId = toast.loading(options?.loadingText || 'Şəkil yüklənir...');
        try {
            const response = await fetch('/api/upload-image', { method: 'POST', body: formData });
            if (response.ok) {
                const data = await response.json();
                toast.success(options?.successText || 'Şəkil uğurla yükləndi', { id: uploadId });
                return data.url;
            } else {
                throw new Error('Upload fail');
            }
        } catch (err) {
            console.error('Upload error:', err);
            toast.error(options?.errorText || 'Görsəl yüklənərkən xəta baş verdi', { id: uploadId });
            return null;
        }
    };

    const uploadImage = async (file: File): Promise<string | null> => {
        return uploadAsset(file);
    };

    const uploadPdf = async (file: File): Promise<string | null> => {
        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            toast.error('Yalnız PDF faylı yüklənə bilər');
            return null;
        }
        return uploadAsset(file, {
            loadingText: 'PDF yüklənir...',
            successText: 'PDF uğurla yükləndi',
            errorText: 'PDF yüklənərkən xəta baş verdi'
        });
    };

    const notifySiteContentUpdated = (version: string = Date.now().toString()) => {
        localStorage.setItem(CONTENT_VERSION_KEY, version);
        window.dispatchEvent(new CustomEvent(SITE_CONTENT_READY_EVENT));
    };

    const savePagesSilently = async (nextPages: PageContent[]) => {
        try {
            const res = await fetch('/api/save-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nextPages)
            });
            if (res.ok) {
                notifySiteContentUpdated();
            }
        } catch (error) {
            console.error('Silent save failed:', error);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, pageIdx: number, imgId: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const url = await uploadImage(file);
        if (url) {
            const newPages = [...pages];
            const imgIdx = newPages[pageIdx].images.findIndex(i => i.id === imgId);
            if (imgIdx !== -1) {
                newPages[pageIdx].images[imgIdx].path = url;
                newPages[pageIdx].images[imgIdx].type = 'local';
                setPages(newPages);
            }
        }
    };

    const selectImage = (path: string) => {
        if (!activeImageField) return;

        const newPages = [...pages];
        if (isAddingNewFromSystem) {
            // Add a new field instead of replacing
            const newId = `img-${newPages[activeImageField.pageIdx].images.length}-${Date.now()}`;
            newPages[activeImageField.pageIdx].images.push({
                id: newId,
                path: path,
                alt: 'Daxil edildi',
                type: 'local'
            });
            setIsAddingNewFromSystem(false);
        } else {
            const imgIdx = newPages[activeImageField.pageIdx].images.findIndex(i => i.id === activeImageField.imgId);
            if (imgIdx !== -1) {
                newPages[activeImageField.pageIdx].images[imgIdx].path = path;
                newPages[activeImageField.pageIdx].images[imgIdx].type = 'local';
            }
        }

        setPages(newPages);
        setIsImageSelectorOpen(false);
        toast.success('Şəkil seçildi');
    };

    const saveChanges = async () => {
        setIsSaving(true);
        const toastId = toast.loading('Yadda saxlanılır...');
        try {
            const saveVersion = Date.now().toString();
            let eventsMailNotice = '';
            if (editorMode === 'extract' || editorMode === 'event-management') {
                const res = await fetch('/api/save-content', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(pages)
                });
                if (!res.ok) throw new Error(await res.text());
            } else if (editorMode === 'events') {
                const res = await fetch('/api/events', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(events)
                });
                if (!res.ok) throw new Error(await res.text());
                const data = await res.json().catch(() => ({} as any));
                const addedEventsCount = Number(data?.addedEventsCount || 0);
                const mailSent = Boolean(data?.mailSent);
                const recipients = Number(data?.mailStatus?.recipients || 0);
                const reason = String(data?.mailStatus?.reason || '').trim();

                if (addedEventsCount > 0) {
                    if (mailSent) {
                        eventsMailNotice = `Yeni tədbir bildirişi ${recipients || 0} abunəçiyə göndərildi.`;
                    } else if (reason === 'no_active_new_events') {
                        eventsMailNotice = 'Keçmiş tarixli yeni tədbir üçün abunəçilərə bildiriş göndərilmir.';
                    } else if (reason === 'smtp_disabled' || reason === 'smtp_not_configured') {
                        eventsMailNotice = 'Yeni tədbir əlavə olundu, amma SMTP aktiv olmadığından mail göndərilmədi.';
                    } else {
                        eventsMailNotice = 'Yeni tədbir əlavə olundu, lakin bildiriş maili göndərilmədi.';
                    }
                }
            } else if (editorMode === 'news') {
                const res = await fetch('/api/news', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(news)
                });
                if (!res.ok) throw new Error(await res.text());
            } else if (editorMode === 'drivers') {
                const res = await fetch('/api/drivers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(driverCategories)
                });
                if (!res.ok) throw new Error(await res.text());
            } else if (editorMode === 'videos') {
                const res = await fetch('/api/videos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(videos)
                });
                if (!res.ok) throw new Error(await res.text());
            } else if (editorMode === 'photos') {
                const res = await fetch('/api/gallery-photos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(galleryPhotos)
                });
                if (!res.ok) throw new Error(await res.text());
            }

            notifySiteContentUpdated(saveVersion);
            if (editorMode === 'photos' || editorMode === 'videos' || editorMode === 'events') {
                localStorage.setItem(GALLERY_VERSION_KEY, saveVersion);
            }
            toast.success('Dəyişikliklər bulud bazasına qeyd edildi!', { id: toastId });
            if (eventsMailNotice) {
                toast.success(eventsMailNotice);
            }
            await loadContent();
        } catch (err: any) {
            console.error('Save error:', err);
            toast.error(`Yadda saxlama xətası: ${err.message} `, { id: toastId });
        } finally {
            setIsSaving(false);
        }
    };

    const handleEventSelect = (id: number) => {
        const evt = events.find(e => e.id === id);
        if (evt) {
            setSelectedEventId(id);
            setEventForm(syncEventWithAzTranslations(evt));
        }
    };

    const handleEventChange = (field: keyof EventItem, value: any, targetId?: number) => {
        const activeId = targetId || selectedEventId;

        setEventForm(prev => {
            // Only update local form if the ID matches what we are currently looking at
            // or if it's a field like 'title' that doesn't use targetId
            const isSameEvent = !targetId || targetId === selectedEventId;
            const updatedForm = isSameEvent
                ? syncEventWithAzTranslations({ ...(prev as EventItem), [field]: value } as EventItem)
                : prev;

            // ALWAYS update the master events list using the correct ID
            if (activeId) {
                setEvents(oldEvents => oldEvents.map(e => (
                    e.id === activeId
                        ? syncEventWithAzTranslations({ ...e, [field]: value } as EventItem)
                        : e
                )));
            }

            return updatedForm;
        });
    };

    const handleEventLocalizedChange = (
        field: EventLocalizedField,
        value: string,
        lang: EventLanguageCode,
        targetId?: number
    ) => {
        const activeId = targetId || selectedEventId;
        if (!activeId) return;
        const normalizedValue = (field === 'description' || field === 'rules')
            ? normalizeRichEditorValue(value)
            : value;

        setEventForm(prev => {
            const isSameEvent = !targetId || targetId === selectedEventId;
            const updatedForm = isSameEvent
                ? applyEventLocalizedFieldUpdate((prev as EventItem), field, lang, normalizedValue)
                : prev;

            setEvents(oldEvents => oldEvents.map(e => (
                e.id === activeId ? applyEventLocalizedFieldUpdate(e, field, lang, normalizedValue) : e
            )));

            return updatedForm;
        });
    };

    const autoFillEventLanguages = async (sourceLang: EventLanguageCode, targetId?: number) => {
        const activeId = targetId || selectedEventId;
        if (!activeId || isAutoTranslatingEvent) return;

        const sourceEvent = events.find((item) => item.id === activeId);
        if (!sourceEvent) return;

        const normalizedSourceEvent = syncEventWithAzTranslations(sourceEvent);
        const sourceTextValues = EVENT_AUTO_TRANSLATE_TEXT_FIELDS.map((field) =>
            getEventLocalizedFieldValue(normalizedSourceEvent, field, sourceLang, false)
        );
        const sourceHtmlValues = EVENT_AUTO_TRANSLATE_HTML_FIELDS.map((field) =>
            getEventLocalizedFieldValue(normalizedSourceEvent, field, sourceLang, false)
        );
        const hasSourceContent = [...sourceTextValues, ...sourceHtmlValues].some((value) => String(value || '').trim());
        if (!hasSourceContent) {
            toast.error('Əvvəlcə seçilmiş dildə məzmun daxil edin');
            return;
        }

        setIsAutoTranslatingEvent(true);
        try {
            let usedFallback = false;
            let nextEvent = normalizedSourceEvent;

            for (const targetLang of EVENT_LANGUAGE_CODES) {
                if (targetLang === sourceLang) continue;

                const translatedText = await translateWithoutApiKey(sourceLang, targetLang, sourceTextValues, 'text');
                const translatedHtml = await translateWithoutApiKey(sourceLang, targetLang, sourceHtmlValues, 'html');
                usedFallback = usedFallback || translatedText.usedFallback || translatedHtml.usedFallback;

                EVENT_AUTO_TRANSLATE_TEXT_FIELDS.forEach((field, index) => {
                    nextEvent = applyEventLocalizedFieldUpdate(nextEvent, field, targetLang, translatedText.values[index] || '');
                });
                EVENT_AUTO_TRANSLATE_HTML_FIELDS.forEach((field, index) => {
                    nextEvent = applyEventLocalizedFieldUpdate(nextEvent, field, targetLang, translatedHtml.values[index] || '');
                });
            }

            setEvents((prev) => prev.map((item) => (item.id === activeId ? nextEvent : item)));
            if (selectedEventId === activeId) {
                setEventForm(nextEvent);
            }

            if (usedFallback) {
                toast.success('Dillər dolduruldu (fallback rejimi işlədildi)');
            } else {
                toast.success('Digər dillər avtomatik dolduruldu');
            }
        } catch (error) {
            console.error('Event auto translate failed:', error);
            toast.error('Avtomatik doldurma zamanı xəta baş verdi');
        } finally {
            setIsAutoTranslatingEvent(false);
        }
    };

    const addNewEvent = () => {
        const newId = events.length > 0 ? Math.max(...events.map(e => e.id)) + 1 : 1;
        const newEvent: EventItem = syncEventWithAzTranslations({
            id: newId,
            title: 'Yeni Tədbir',
            date: new Date().toISOString().split('T')[0],
            location: 'Bakı',
            category: 'OFFROAD',
            img: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?q=80&w=2070&auto=format&fit=crop',
            description: '',
            rules: '',
            youtubeUrl: '',
            status: 'planned',
            registrationEnabled: true
        });
        setEvents([...events, newEvent]);
        setSelectedEventId(newId);
        setEventForm(newEvent);
        toast.success('Yeni tədbir yaradıldı');
    };

    const deleteEvent = async (id: any, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm('Bu tədbiri silmək istədiyinizə əminsiniz?')) {
            if (typeof id === 'string') {
                // For JSON file, we just save the updated list, so deleting from state is enough
                // But if we wanted to be strict, we'd save immediately. 
                // For now, saveChanges() handles saving the whole list.
            }
            setEvents(events.filter(ev => ev.id !== id));
            if (selectedEventId === id) setSelectedEventId(null);
            toast.success('Tədbir silindi');
        }
    };

    // News Handlers
    const handleNewsSelect = (id: number) => {
        const item = news.find(n => n.id === id);
        if (item) {
            setSelectedNewsId(id);
            setNewsForm(syncNewsWithAzTranslations(item));
        }
    };

    const handleNewsChange = (field: keyof NewsItem, value: string | number | boolean, targetId?: number) => {
        const activeId = targetId || selectedNewsId;

        setNewsForm(prev => {
            const isSame = !targetId || targetId === selectedNewsId;
            const updatedForm = isSame
                ? syncNewsWithAzTranslations({ ...prev, [field]: value } as NewsItem)
                : prev;

            if (activeId) {
                setNews(oldNews => oldNews.map(n => (
                    n.id === activeId
                        ? syncNewsWithAzTranslations({ ...n, [field]: value } as NewsItem)
                        : n
                )));
            }

            return updatedForm;
        });
    };

    const handleNewsLocalizedChange = (
        field: NewsLocalizedField,
        value: string,
        lang: EventLanguageCode,
        targetId?: number
    ) => {
        const activeId = targetId || selectedNewsId;
        if (!activeId) return;
        const normalizedValue = field === 'description'
            ? normalizeRichEditorValue(value)
            : value;

        setNewsForm(prev => {
            const isSame = !targetId || targetId === selectedNewsId;
            const updatedForm = isSame
                ? applyNewsLocalizedFieldUpdate((prev as NewsItem), field, lang, normalizedValue)
                : prev;

            setNews(oldNews => oldNews.map(n => (
                n.id === activeId ? applyNewsLocalizedFieldUpdate(n, field, lang, normalizedValue) : n
            )));

            return updatedForm;
        });
    };

    const autoFillNewsLanguages = async (sourceLang: EventLanguageCode, targetId?: number) => {
        const activeId = targetId || selectedNewsId;
        if (!activeId || isAutoTranslatingNews) return;

        const sourceNews = news.find((item) => item.id === activeId);
        if (!sourceNews) return;

        const normalizedSourceNews = syncNewsWithAzTranslations(sourceNews);
        const sourceTextValues = NEWS_AUTO_TRANSLATE_TEXT_FIELDS.map((field) =>
            getNewsLocalizedFieldValue(normalizedSourceNews, field, sourceLang, false)
        );
        const sourceHtmlValues = NEWS_AUTO_TRANSLATE_HTML_FIELDS.map((field) =>
            getNewsLocalizedFieldValue(normalizedSourceNews, field, sourceLang, false)
        );
        const hasSourceContent = [...sourceTextValues, ...sourceHtmlValues].some((value) => String(value || '').trim());
        if (!hasSourceContent) {
            toast.error('Əvvəlcə seçilmiş dildə məzmun daxil edin');
            return;
        }

        setIsAutoTranslatingNews(true);
        try {
            let usedFallback = false;
            let nextNews = normalizedSourceNews;

            for (const targetLang of EVENT_LANGUAGE_CODES) {
                if (targetLang === sourceLang) continue;

                const translatedText = await translateWithoutApiKey(sourceLang, targetLang, sourceTextValues, 'text');
                const translatedHtml = await translateWithoutApiKey(sourceLang, targetLang, sourceHtmlValues, 'html');
                usedFallback = usedFallback || translatedText.usedFallback || translatedHtml.usedFallback;

                NEWS_AUTO_TRANSLATE_TEXT_FIELDS.forEach((field, index) => {
                    nextNews = applyNewsLocalizedFieldUpdate(nextNews, field, targetLang, translatedText.values[index] || '');
                });
                NEWS_AUTO_TRANSLATE_HTML_FIELDS.forEach((field, index) => {
                    nextNews = applyNewsLocalizedFieldUpdate(nextNews, field, targetLang, translatedHtml.values[index] || '');
                });
            }

            setNews((prev) => prev.map((item) => (item.id === activeId ? nextNews : item)));
            if (selectedNewsId === activeId) {
                setNewsForm(nextNews);
            }

            if (usedFallback) {
                toast.success('Dillər dolduruldu (fallback rejimi işlədildi)');
            } else {
                toast.success('Digər dillər avtomatik dolduruldu');
            }
        } catch (error) {
            console.error('News auto translate failed:', error);
            toast.error('Avtomatik doldurma zamanı xəta baş verdi');
        } finally {
            setIsAutoTranslatingNews(false);
        }
    };

    const addNewNews = () => {
        const newId = news.length > 0 ? Math.max(...news.map(n => n.id)) + 1 : 1;
        const newItem: NewsItem = syncNewsWithAzTranslations({
            id: newId,
            title: 'Yeni Xəbər',
            date: new Date().toISOString().split('T')[0],
            img: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=2070&auto=format&fit=crop',
            description: '',
            category: 'BLOQ',
            status: 'published'
        });
        setNews([...news, newItem]);
        setSelectedNewsId(newId);
        setNewsForm(newItem);
        toast.success('Yeni xəbər yaradıldı');
    };

    // Video Handlers
    const handleVideoSelect = (id: number) => {
        setSelectedVideoId(id);
        const item = videos.find(v => v.id === id);
        if (item) setVideoForm({ ...item });
    };

    const handleVideoChange = (field: keyof VideoItem, value: string, targetId?: number) => {
        const activeId = targetId || selectedVideoId;

        setVideoForm(prev => {
            const isSame = !targetId || targetId === selectedVideoId;
            let updatedForm = isSame ? { ...prev, [field]: value } as VideoItem : prev;

            // Extract YouTube info if URL changes
            if (field === 'youtubeUrl' && isSame) {
                const vId = extractYoutubeId(value);
                if (vId) {
                    updatedForm = {
                        ...updatedForm,
                        videoId: vId,
                        thumbnail: `https://img.youtube.com/vi/${vId}/maxresdefault.jpg`
                    };
                }
            }

            if (activeId) {
                setVideos(old => old.map(v => {
                    if (v.id === activeId) {
                        let updated = { ...v, [field]: value };
                        if (field === 'youtubeUrl') {
                            const vId = extractYoutubeId(value);
                            if (vId) {
                                updated.videoId = vId;
                                updated.thumbnail = `https://img.youtube.com/vi/${vId}/maxresdefault.jpg`;
                            }
                        }
                        return updated;
                    }
                    return v;
                }));
            }

            return updatedForm;
        });
    };

    const extractYoutubeId = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const getNextGalleryPhotoId = (items: GalleryPhotoItem[] = galleryPhotos) => {
        const maxId = items.reduce((max, item) => {
            const numeric = Number(item.id);
            if (!Number.isFinite(numeric)) return max;
            return numeric > max ? numeric : max;
        }, 0);
        return maxId + 1;
    };

    const handlePhotoSelect = (id: number) => {
        setSelectedPhotoId(id);
        const item = galleryPhotos.find(p => p.id === id);
        if (item) {
            const normalizedAlbum = normalizePhotoAlbum(item.album);
            const linkedEvent = item.eventId
                ? events.find((evt) => evt.id === item.eventId)
                : events.find((evt) => normalizePhotoAlbum(evt.title) === normalizedAlbum);
            setPhotoForm({ ...item, album: normalizedAlbum });
            setSelectedPhotoAlbum(normalizedAlbum);
            setSelectedPhotoEventId(linkedEvent ? String(linkedEvent.id) : '');
        }
    };

    const createOrSelectPhotoAlbum = () => {
        const rawName = newPhotoAlbumName.trim();
        if (!rawName) {
            toast.error('Albom adı daxil edin');
            return;
        }
        const normalizedAlbum = normalizePhotoAlbum(rawName);
        if (isReservedPhotoAlbum(normalizedAlbum)) {
            toast.error('Xüsusi albom adı yazın (Ümumi Arxiv olmaz)');
            return;
        }
        setSelectedPhotoAlbum(normalizedAlbum);
        setPhotoAlbumFilter(normalizedAlbum);
        setNewPhotoAlbumName('');
        toast.success(`Albom seçildi: ${normalizedAlbum}`);
    };

    const handlePhotoAlbumFromEventChange = (rawEventId: string) => {
        setSelectedPhotoEventId(rawEventId);
        if (!rawEventId) return;

        const numericId = Number(rawEventId);
        if (!Number.isFinite(numericId)) return;

        const linkedEvent = events.find((evt) => evt.id === numericId);
        if (!linkedEvent) return;

        const normalizedAlbum = normalizePhotoAlbum(linkedEvent.title);
        setSelectedPhotoAlbum(normalizedAlbum);
        setPhotoAlbumFilter(normalizedAlbum);
    };

    const renamePhotoAlbumBulk = () => {
        if (photoAlbumFilter === 'all') {
            toast.error('Yenidən adlandırmaq üçün əvvəlcə albom seçin');
            return;
        }

        const sourceAlbum = normalizePhotoAlbum(photoAlbumFilter);
        const targetAlbum = normalizePhotoAlbum(renamePhotoAlbumName);

        if (!renamePhotoAlbumName.trim()) {
            toast.error('Yeni albom adı daxil edin');
            return;
        }

        if (sourceAlbum === targetAlbum) {
            toast.error('Yeni albom adı fərqli olmalıdır');
            return;
        }

        let renamedCount = 0;
        setGalleryPhotos((prev) => prev.map((item) => {
            if (normalizePhotoAlbum(item.album) !== sourceAlbum) return item;
            renamedCount += 1;
            return { ...item, album: targetAlbum };
        }));

        if (renamedCount === 0) {
            toast.error('Seçilən albomda yenilənəcək şəkil yoxdur');
            return;
        }

        if (selectedPhotoId !== null && normalizePhotoAlbum(photoForm.album) === sourceAlbum) {
            setPhotoForm((prev) => ({ ...prev, album: targetAlbum }));
        }

        if (normalizePhotoAlbum(selectedPhotoAlbum) === sourceAlbum) {
            setSelectedPhotoAlbum(targetAlbum);
        }

        setPhotoAlbumFilter(targetAlbum);
        setRenamePhotoAlbumName(targetAlbum);
        toast.success(`"${sourceAlbum}" albomu "${targetAlbum}" olaraq yeniləndi`);
    };

    const addGalleryPhoto = () => {
        const newId = getNextGalleryPhotoId();
        const normalizedAlbum = normalizePhotoAlbum(selectedPhotoAlbum);
        if (isReservedPhotoAlbum(normalizedAlbum)) {
            toast.error('Əvvəlcə albom seçin və ya event albomu təyin edin');
            return;
        }
        const numericEventId = Number(selectedPhotoEventId);
        const linkedEventId = selectedPhotoEventId && Number.isFinite(numericEventId) ? numericEventId : null;
        const newItem: GalleryPhotoItem = {
            id: newId,
            title: 'Yeni Şəkil',
            url: '',
            album: normalizedAlbum,
            eventId: linkedEventId
        };
        setGalleryPhotos(prev => [...prev, newItem]);
        setPhotoAlbumFilter(normalizedAlbum);
        setSelectedPhotoId(newId);
        setPhotoForm({ ...newItem });
    };

    const deleteGalleryPhoto = async (id: any, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm('Bu şəkli silmək istədiyinizə əminsiniz?')) {
            if (typeof id === 'string') {
                // Local state update is sufficient until save
            }
            setGalleryPhotos(prev => prev.filter(p => p.id !== id));
            if (selectedPhotoId === id) {
                setSelectedPhotoId(null);
                setPhotoForm({});
            }
            toast.success('Şəkil silindi');
        }
    };

    const deletePhotoAlbumBulk = () => {
        if (photoAlbumFilter === 'all') {
            toast.error('Toplu silmək üçün əvvəlcə albom seçin');
            return;
        }

        const targetAlbum = normalizePhotoAlbum(photoAlbumFilter);
        const targetIds = new Set(
            galleryPhotos
                .filter((item) => normalizePhotoAlbum(item.album) === targetAlbum)
                .map((item) => item.id)
        );

        if (targetIds.size === 0) {
            toast.error('Seçilən albomda silinəcək şəkil yoxdur');
            return;
        }

        const confirmed = window.confirm(
            `"${targetAlbum}" albomundakı ${targetIds.size} şəkli toplu silmək istədiyinizə əminsiniz?`
        );
        if (!confirmed) return;

        setGalleryPhotos((prev) => prev.filter((item) => !targetIds.has(item.id)));

        if (selectedPhotoId !== null && targetIds.has(selectedPhotoId)) {
            setSelectedPhotoId(null);
            setPhotoForm({});
            setSelectedPhotoEventId('');
        }

        if (normalizePhotoAlbum(selectedPhotoAlbum) === targetAlbum) {
            setSelectedPhotoAlbum(DEFAULT_PHOTO_ALBUM);
        }

        setPhotoAlbumFilter('all');
        toast.success(`"${targetAlbum}" albomu silindi (${targetIds.size} şəkil)`);
    };

    const handlePhotoChange = (field: keyof GalleryPhotoItem, value: string) => {
        setPhotoForm(prev => {
            const updatedForm = { ...prev, [field]: value } as GalleryPhotoItem;

            if (field === 'album') {
                updatedForm.album = normalizePhotoAlbum(value);
                setSelectedPhotoAlbum(updatedForm.album);
            }

            if (selectedPhotoId !== null) {
                setGalleryPhotos(old => old.map(p => p.id === selectedPhotoId ? updatedForm : p));
            }
            return updatedForm;
        });
    };

    const handlePhotoEventLinkChange = (rawEventId: string) => {
        const numericId = Number(rawEventId);
        const linkedEventId = rawEventId && Number.isFinite(numericId) ? numericId : null;
        const linkedEvent = linkedEventId !== null ? events.find((evt) => evt.id === linkedEventId) : null;

        setSelectedPhotoEventId(rawEventId);

        setPhotoForm(prev => {
            const updatedForm = {
                ...prev,
                eventId: linkedEventId,
                album: linkedEvent ? normalizePhotoAlbum(linkedEvent.title) : normalizePhotoAlbum(prev.album)
            } as GalleryPhotoItem;

            setSelectedPhotoAlbum(updatedForm.album || DEFAULT_PHOTO_ALBUM);

            if (selectedPhotoId !== null) {
                setGalleryPhotos(old => old.map(p => p.id === selectedPhotoId ? updatedForm : p));
            }

            return updatedForm;
        });
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const url = await uploadImage(file);
        if (url) {
            handlePhotoChange('url', url);
        }
    };

    const handleMultiPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        const baseAlbum = normalizePhotoAlbum(selectedPhotoAlbum);
        if (isReservedPhotoAlbum(baseAlbum)) {
            toast.error('Çoxlu yükləmə üçün əvvəlcə albom seçin');
            e.target.value = '';
            return;
        }
        const numericEventId = Number(selectedPhotoEventId);
        const linkedEventId = selectedPhotoEventId && Number.isFinite(numericEventId) ? numericEventId : null;

        let nextId = getNextGalleryPhotoId();
        const uploadedItems: GalleryPhotoItem[] = [];

        for (const file of files) {
            const url = await uploadImage(file);
            if (!url) continue;

            const fileTitle = (file.name || '')
                .replace(/\.[^/.]+$/, '')
                .trim() || `Şəkil ${nextId}`;

            uploadedItems.push({
                id: nextId,
                title: fileTitle,
                url,
                album: baseAlbum,
                eventId: linkedEventId
            });
            nextId += 1;
        }

        if (!uploadedItems.length) {
            toast.error('Şəkillər yüklənmədi');
            e.target.value = '';
            return;
        }

        setGalleryPhotos((prev) => [...prev, ...uploadedItems]);
        setPhotoAlbumFilter(baseAlbum);
        setSelectedPhotoId(uploadedItems[0].id);
        setPhotoForm({ ...uploadedItems[0] });
        toast.success(`${uploadedItems.length} şəkil "${baseAlbum}" albomuna əlavə edildi`);

        if (uploadedItems.length !== files.length) {
            toast.error(`${files.length - uploadedItems.length} fayl yüklənmədi`);
        }

        e.target.value = '';
    };

    const addNewVideo = () => {
        const newId = videos.length > 0 ? Math.max(...videos.map(v => v.id)) + 1 : 1;
        const newItem: VideoItem = {
            id: newId,
            title: 'Yeni Video',
            youtubeUrl: '',
            videoId: '',
            duration: '00:00',
            thumbnail: '',
            created_at: new Date().toISOString()
        };
        setVideos([...videos, newItem]);
        setSelectedVideoId(newId);
        setVideoForm(newItem);
        toast.success('Yeni video əlavə edildi');
    };

    const deleteVideo = async (id: any, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm('Bu videonu silmək istədiyinizə əminsiniz?')) {
            if (typeof id === 'string') {
                // Local state update is sufficient until save
            }
            setVideos(videos.filter(v => v.id !== id));
            if (selectedVideoId === id) setSelectedVideoId(null);
            toast.success('Video silindi');
        }
    };

    const deleteNews = async (id: any, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm('Bu xəbəri silmək istədiyinizə əminsiniz?')) {
            if (typeof id === 'string') {
                // Local state update is sufficient until save
            }
            setNews(news.filter(n => n.id !== id));
            if (selectedNewsId === id) setSelectedNewsId(null);
            toast.success('Xəbər silindi');
        }
    };

    // Drivers Handlers
    const handleCatSelect = (id: string) => {
        setSelectedCatId(id);
        setSelectedDriverId(null);
        setDriverForm({});
    };

    const handleDriverSelect = (id: number) => {
        setSelectedDriverId(id);
        const cat = driverCategories.find(c => c.id === selectedCatId);
        const driver = cat?.drivers.find(d => d.id === id);
        if (driver) {
            setDriverForm({ ...driver });
        }
    };

    const handleDriverChange = (field: keyof DriverItem, value: any) => {
        if (!selectedCatId || !selectedDriverId) return;

        // Update both form and master list
        setDriverForm(prev => {
            const updated = { ...prev, [field]: value } as DriverItem;

            setDriverCategories(prevCats => prevCats.map(c => {
                if (c.id === selectedCatId) {
                    return {
                        ...c,
                        drivers: c.drivers.map(d => d.id === selectedDriverId ? updated : d)
                    };
                }
                return c;
            }));

            return updated;
        });
    };

    const addDriver = () => {
        if (!selectedCatId) {
            toast.error('Öncə kateqoriya seçin və ya yaradın');
            return;
        }
        const newId = Date.now();
        const newDriver: DriverItem = {
            id: newId,
            rank: 99,
            name: 'Yeni Sürücü',
            license: 'PILOT LICENSE',
            team: 'TEAM NAME',
            wins: 0,
            points: 0,
            img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=400&fit=crop'
        };

        setDriverCategories(prev => prev.map(c => {
            if (c.id === selectedCatId) {
                return { ...c, drivers: [...c.drivers, newDriver] };
            }
            return c;
        }));

        setSelectedDriverId(newId);
        setDriverForm(newDriver);
        toast.success('Yeni sürücü siyahıya əlavə edildi');
    };

    const deleteDriver = (id: number) => {
        if (window.confirm('Bu sürücünü silmək istədiyinizə əminsiniz?')) {
            setDriverCategories(prev => prev.map(c => {
                if (c.id === selectedCatId) {
                    return { ...c, drivers: c.drivers.filter(d => d.id !== id) };
                }
                return c;
            }));
            if (selectedDriverId === id) {
                setSelectedDriverId(null);
                setDriverForm({});
            }
            toast.success('Sürücü silindi');
        }
    };

    const handleDriverSave = async () => {
        // Ensure master list is up to date one last time just in case
        const currentForm = driverForm as DriverItem;
        const updatedCats = driverCategories.map(c => {
            if (c.id === selectedCatId) {
                return {
                    ...c,
                    drivers: c.drivers.map(d => d.id === selectedDriverId ? { ...d, ...currentForm } as DriverItem : d)
                };
            }
            return c;
        });

        setIsSaving(true);
        const tid = toast.loading('Yadda saxlanılır...');
        try {
            const res = await fetch('/api/drivers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedCats)
            });
            if (!res.ok) throw new Error('Yadda saxlama uğursuz oldu');
            setDriverCategories(updatedCats);
            toast.success('Bütün sürücü məlumatları qeyd edildi', { id: tid });
        } catch (err) {
            toast.error('Xəta baş verdi', { id: tid });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSendDriversRankingNotification = async () => {
        if (isSendingRankingNotice) return;
        const token = getAuthToken();
        if (!token) {
            toast.error('Sessiya etibarsızdır. Yenidən daxil olun.');
            return;
        }

        const approved = window.confirm('Sürücü sıralama bildirişini bütün abunəçilərə göndərmək istəyirsiniz?');
        if (!approved) {
            toast('Bildiriş göndərilməsi ləğv edildi.');
            return;
        }

        const note = window.prompt('Bildiriş üçün qısa qeyd (istəyə bağlı):', '') ?? '';
        setIsSendingRankingNotice(true);
        const tid = toast.loading('Abunələrə bildiriş göndərilir...');
        const benignMailReasons = new Set(['smtp_disabled', 'smtp_not_configured', 'no_subscribers', 'no_drivers_data']);
        try {
            const res = await fetch('/api/notifications/drivers-ranking', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ note, approved: true })
            });
            const data = await res.json().catch(() => ({} as any));
            const reason = String(data?.mailStatus?.reason || '').trim();
            const recipients = Number(data?.mailStatus?.recipients || 0);
            const failedRecipients = Number(data?.mailStatus?.failedRecipients || 0);
            if (!res.ok || !data?.success) {
                if (benignMailReasons.has(reason)) {
                    if (reason === 'no_subscribers') {
                        toast('Aktiv newsletter abunəçisi yoxdur.', { id: tid });
                    } else if (reason === 'no_drivers_data') {
                        toast('Sürücü məlumatı olmadığı üçün bildiriş göndərilmədi.', { id: tid });
                    } else {
                        toast('SMTP aktiv deyil və ya tam qurulmayıb.', { id: tid });
                    }
                    return;
                }
                throw new Error(data?.error || 'Bildiriş göndərilə bilmədi');
            }
            if (reason === 'partial_failure' && failedRecipients > 0) {
                toast.success(`Bildiriş qismən göndərildi (${Math.max(recipients - failedRecipients, 0)}/${recipients})`, { id: tid });
                return;
            }
            toast.success(recipients > 0 ? `Bildiriş göndərildi (${recipients} abunəçi)` : 'Bildiriş göndərildi', { id: tid });
        } catch (error: any) {
            toast.error(error?.message || 'Bildiriş göndərilə bilmədi', { id: tid });
        } finally {
            setIsSendingRankingNotice(false);
        }
    };

    const addCategory = () => {
        const name = window.prompt('Kateqoriya adı (Məs: UNLIMITED CLASS):');
        if (!name) return;
        const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        if (driverCategories.find(c => c.id === id)) {
            toast.error('Bu adda kateqoriya artıq mövcuddur');
            return;
        }
        const newCat: DriverCategory = { id, name, drivers: [] };
        setDriverCategories([...driverCategories, newCat]);
        setSelectedCatId(id);
        toast.success('Kateqoriya əlavə edildi');
    };

    const deleteCategory = () => {
        if (!selectedCatId) return;
        const cat = driverCategories.find(c => c.id === selectedCatId);
        if (!cat) return;

        if (window.confirm(`"${cat.name}" kateqoriyasını və içindəki bütün sürücüləri silmək istədiyinizə əminsiniz?`)) {
            const newCats = driverCategories.filter(c => c.id !== selectedCatId);
            setDriverCategories(newCats);
            if (newCats.length > 0) {
                setSelectedCatId(newCats[0].id);
            } else {
                setSelectedCatId(null);
            }
            setSelectedDriverId(null);
            setDriverForm({});
            toast.success('Kateqoriya silindi');
        }
    };

    const renameCategory = (nextName: string) => {
        if (!selectedCatId) return;
        const normalized = nextName.trim();
        if (!normalized) {
            toast.error('Kateqoriya adı boş ola bilməz');
            return;
        }
        setDriverCategories(prev => prev.map(cat => (
            cat.id === selectedCatId ? { ...cat, name: normalized } : cat
        )));
    };

    if (pages.length === 0 && !isExtracting && !localStorage.getItem('forsaj_extracted')) {
        return (
            <div className="extractor-overlay">
                <div className="extractor-card fade-in">
                    <Globe size={64} className="text-primary" style={{ marginBottom: '1.5rem' }} />
                    <h2>Sayt Məzmununu və Görselləri Çıxarın</h2>
                    <p>Front-end layihənizdəki bütün səhifələri, mətnləri və şəkilləri avtomatik olaraq bu panelə yükləyin.</p>
                    <button className="extract-btn" onClick={startExtraction}>
                        Sinxronizasiyanı Başlat
                    </button>
                </div>
            </div>
        );
    }

    if (isExtracting) {
        return (
            <div className="extractor-overlay">
                <div className="extractor-card">
                    <div className="loader-ring" style={{ marginBottom: '1.5rem' }}></div>
                    <h2>Avtomatik Sinxronizasiya</h2>
                    <p>Zəhmət olmasa gözləyin, front-end məlumatları oxunur...</p>
                    <div className="progress-container">
                        <div className="progress-bar" style={{ width: `${progress}%` }}></div>
                    </div>
                    <div className="step-label">{extractStep}</div>
                </div>
            </div>
        );
    }

    const currentPage = pages[selectedPageIndex];
    const activeGroupIds = resolvePageGroup(pageParam);
    const activeGroupPages = activeGroupIds
        .map((id) => {
            const pageIdx = pages.findIndex((page) => page.id === id);
            if (pageIdx === -1) return null;
            return { page: pages[pageIdx], pageIdx };
        })
        .filter(Boolean) as { page: PageContent; pageIdx: number }[];
    const isGroupedRequest = !!pageParam && activeGroupIds.length > 1 && (
        !!TAB_PAGE_GROUPS[pageParam] ||
        !!PAGE_TO_TAB_GROUP[pageParam]
    );
    const isGroupedTabView = editorMode === 'extract' && isGroupedRequest && activeGroupPages.length > 0;
    const isHomeGroupedView = !!pageParam && (pageParam === 'home' || PAGE_TO_TAB_GROUP[pageParam] === 'home');
    const groupedPagesToRender = isHomeGroupedView
        ? activeGroupPages.filter(({ page }) => HOME_TAB_PAGE_IDS[homeEditTab].includes(page.id))
        : activeGroupPages;
    const searchQuery = searchTerm.trim().toLowerCase();
    const matchesSearch = (...values: Array<string | number | undefined>) => {
        if (!searchQuery) return true;
        return values.some((value) => (value || '').toString().toLowerCase().includes(searchQuery));
    };
    const eventsPageIndex = pages.findIndex((page) => page.id === 'eventspage');
    const eventsPageConfig = eventsPageIndex >= 0 ? pages[eventsPageIndex] : null;
    const eventClubOptionRows = (eventsPageConfig?.sections || [])
        .map((section) => {
            const match = String(section.id || '').match(/^CLUB_OPTION_(\d+)$/i);
            if (!match) return null;
            return {
                id: section.id,
                optionNumber: Number(match[1]),
                value: String(section.value || '')
            };
        })
        .filter((row): row is { id: string; optionNumber: number; value: string } => !!row)
        .sort((a, b) => a.optionNumber - b.optionNumber);
    const getEventsPageConfigValue = (key: string, fallback: string) => {
        const found = eventsPageConfig?.sections?.find((section) => section.id === key);
        return (found?.value || fallback).toString();
    };
    const updateEventManagementValue = (key: string, label: string, value: string) => {
        const nextPages = [...pages];
        let pageIdx = nextPages.findIndex((page) => page.id === 'eventspage');
        if (pageIdx === -1) {
            nextPages.push({
                id: 'eventspage',
                title: componentLabels.eventspage || 'Tədbirlər Səhifəsi',
                sections: [],
                images: []
            });
            pageIdx = nextPages.length - 1;
        }

        const page = nextPages[pageIdx];
        const sectionIdx = (page.sections || []).findIndex((section) => section.id === key);
        if (sectionIdx >= 0) {
            page.sections[sectionIdx] = {
                ...page.sections[sectionIdx],
                label: page.sections[sectionIdx].label || label,
                value
            };
        } else {
            const nextOrder = (page.sections || []).reduce((max, s, idx) => Math.max(max, normalizeOrder(s.order, idx)), -1) + 1;
            page.sections.push({ id: key, type: 'text', label, value, order: nextOrder });
        }

        setPages(nextPages);
    };
    const addEventManagementClubOption = () => {
        const nextPages = [...pages];
        let pageIdx = nextPages.findIndex((page) => page.id === 'eventspage');
        if (pageIdx === -1) {
            nextPages.push({
                id: 'eventspage',
                title: componentLabels.eventspage || 'Tədbirlər Səhifəsi',
                sections: [],
                images: []
            });
            pageIdx = nextPages.length - 1;
        }

        const page = nextPages[pageIdx];
        const maxOptionNumber = (page.sections || []).reduce((max, section) => {
            const match = String(section.id || '').match(/^CLUB_OPTION_(\d+)$/i);
            if (!match) return max;
            return Math.max(max, Number(match[1]));
        }, 0);
        const nextOptionNumber = maxOptionNumber + 1;
        const nextSectionId = `CLUB_OPTION_${nextOptionNumber}`;
        const nextOrder = (page.sections || []).reduce((max, s, idx) => Math.max(max, normalizeOrder(s.order, idx)), -1) + 1;
        page.sections.push({
            id: nextSectionId,
            type: 'text',
            label: `Klub Seçimi ${nextOptionNumber}`,
            value: `Klub ${nextOptionNumber}`,
            order: nextOrder
        });
        setPages(nextPages);
        setPendingClubFocusId(nextSectionId);
    };
    const removeEventManagementClubOption = (sectionId: string) => {
        if (eventClubOptionRows.length <= 1) {
            toast.error('Ən azı bir klub seçimi qalmalıdır.');
            return;
        }

        const nextPages = [...pages];
        const pageIdx = nextPages.findIndex((page) => page.id === 'eventspage');
        if (pageIdx === -1) return;

        const page = nextPages[pageIdx];
        const sectionIdx = (page.sections || []).findIndex((section) => section.id === sectionId);
        if (sectionIdx === -1) return;

        page.sections.splice(sectionIdx, 1);
        setPages(nextPages);
    };
    const updateEventManagementUrl = (key: string, label: string, value: string, url: string) => {
        const nextPages = [...pages];
        let pageIdx = nextPages.findIndex((page) => page.id === 'eventspage');
        if (pageIdx === -1) {
            nextPages.push({
                id: 'eventspage',
                title: componentLabels.eventspage || 'Tədbirlər Səhifəsi',
                sections: [],
                images: []
            });
            pageIdx = nextPages.length - 1;
        }

        const page = nextPages[pageIdx];
        const normalizedUrl = toAbsoluteUrl(url);
        const sectionIdx = (page.sections || []).findIndex((section) => section.id === key);
        if (sectionIdx >= 0) {
            page.sections[sectionIdx] = {
                ...page.sections[sectionIdx],
                label: page.sections[sectionIdx].label || label,
                value,
                url: normalizedUrl || page.sections[sectionIdx].url
            };
        } else {
            const nextOrder = (page.sections || []).reduce((max, s, idx) => Math.max(max, normalizeOrder(s.order, idx)), -1) + 1;
            page.sections.push({ id: key, type: 'text', label, value, url: normalizedUrl, order: nextOrder });
        }

        setPages(nextPages);
    };

    const displayedSections = (currentPage?.sections || []).filter(s => {
        if (!isSectionVisibleInAdmin(s)) return false;
        if (shouldSkipSectionInEditor(s)) return false;
        if (currentPage?.id === 'about' && isStatSectionId(s.id)) return false;
        if ((currentPage?.id === 'about' || currentPage?.id === 'values') && CORE_VALUE_FIELD_REGEX.test(s.id)) return false;
        if (currentPage?.id === 'partners') return false;
        if (currentPage?.id === 'rulespage' && RULE_TAB_SECTION_REGEX.test(s.id)) return false;
        if (currentPage?.id === 'rulespage' && s.id.startsWith('RULES_')) return false;
        if (currentPage?.id === 'rulespage' && s.id === 'BTN_DOWNLOAD_PDF') return false;
        return matchesSearch(s.id, s.label, s.value, s.url);
    }).sort((a, b) => normalizeOrder(a.order, 0) - normalizeOrder(b.order, 0));

    const contactPageSections = currentPage?.id === 'contactpage' ? (currentPage.sections || []) : [];
    const contactTopicOptionRows = currentPage?.id === 'contactpage'
        ? (() => {
            const dynamicRows = contactPageSections
                .map((section) => {
                    const match = String(section.id || '').match(CONTACT_TOPIC_OPTION_REGEX);
                    if (!match) return null;
                    return {
                        id: section.id,
                        optionNumber: Number(match[1]),
                        value: String(section.value || ''),
                        isLegacy: false
                    };
                })
                .filter((row): row is { id: string; optionNumber: number; value: string; isLegacy: false } => !!row)
                .sort((a, b) => a.optionNumber - b.optionNumber);

            if (dynamicRows.length > 0) {
                return dynamicRows.filter((row) => matchesSearch(row.id, row.optionNumber, row.value));
            }

            return CONTACT_LEGACY_TOPIC_FIELDS
                .map((legacyField, index) => {
                    const section = contactPageSections.find((entry) => entry.id === legacyField.id);
                    return {
                        id: legacyField.id,
                        optionNumber: index + 1,
                        value: String(section?.value || legacyField.fallback),
                        isLegacy: true
                    };
                })
                .filter((row) => matchesSearch(row.id, row.optionNumber, row.value));
        })()
        : [];

    const legalSectionRows = currentPage?.id && LEGAL_PAGE_IDS.has(currentPage.id)
        ? (() => {
            const pairMap = new Map<number, {
                sectionNo: number;
                titleSection?: Section;
                iconSection?: Section;
                bodySection?: Section;
            }>();

            (currentPage.sections || []).forEach((section) => {
                const match = String(section.id || '').match(LEGAL_DYNAMIC_SECTION_REGEX);
                if (!match) return;
                const sectionNo = Number(match[1]);
                if (!Number.isFinite(sectionNo)) return;

                const current = pairMap.get(sectionNo) || { sectionNo };
                if (match[2].toUpperCase() === 'TITLE') current.titleSection = section;
                if (match[2].toUpperCase() === 'ICON') current.iconSection = section;
                if (match[2].toUpperCase() === 'BODY') current.bodySection = section;
                pairMap.set(sectionNo, current);
            });

            return Array.from(pairMap.values())
                .sort((a, b) => a.sectionNo - b.sectionNo)
                .filter((row) =>
                    matchesSearch(
                        `SECTION_${row.sectionNo}`,
                        row.titleSection?.label,
                        row.titleSection?.value,
                        row.iconSection?.label,
                        row.iconSection?.value,
                        row.bodySection?.label,
                        row.bodySection?.value
                    )
                );
        })()
        : [];

    const aboutStats = currentPage?.id === 'about'
        ? (() => {
            const statsMap = new Map<string, { label: string; value: string }>();

            (currentPage.sections || []).forEach(section => {
                if (!isStatSectionId(section.id)) return;
                const suffix = getStatSuffix(section.id) || section.id;
                const current = statsMap.get(suffix) || { label: '', value: '' };

                if (section.id.startsWith(STAT_LABEL_PREFIX)) current.label = section.value || '';
                if (section.id.startsWith(STAT_VALUE_PREFIX)) current.value = section.value || '';

                statsMap.set(suffix, current);
            });

            const rows = Array.from(statsMap.entries())
                .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
                .map(([suffix, data]) => ({ suffix, ...data }));

            return rows.filter((row) => matchesSearch(row.suffix, row.label, row.value));
        })()
        : [];

    const rulesTabRows = currentPage?.id === 'rulespage' ? getRulesTabRows(currentPage) : [];
    const coreValueRows: CoreValueRow[] = (currentPage?.id === 'about' || currentPage?.id === 'values')
        ? (() => {
            const rowsMap = new Map<string, CoreValueRow>();
            (currentPage?.sections || []).forEach((section) => {
                const parsed = parseCoreValueField(section.id);
                if (!parsed) return;
                const current = rowsMap.get(parsed.suffix) || {
                    suffix: parsed.suffix,
                    icon: 'Shield',
                    title: '',
                    desc: ''
                };
                current[parsed.field] = section.value || '';
                rowsMap.set(parsed.suffix, current);
            });

            return Array.from(rowsMap.values())
                .sort((a, b) => a.suffix.localeCompare(b.suffix, undefined, { numeric: true }))
                .filter((row) => matchesSearch(row.suffix, row.icon, row.title, row.desc));
        })()
        : [];

    const displayedImages = (currentPage?.images || []).filter(i => {
        return matchesSearch(i.id, i.alt, i.path);
    }).sort((a, b) => normalizeOrder(a.order, 0) - normalizeOrder(b.order, 0));

    const shouldUseRichEditor = (section: Section) => {
        const v = (section.value || '').toLowerCase();
        // Only use heavy rich editor for explicit rich content.
        return (
            v.includes('<p') ||
            v.includes('<br') ||
            v.includes('[b]') ||
            v.includes('[i]') ||
            v.includes('[u]') ||
            v.includes('[url') ||
            v.includes('[img') ||
            v.includes('[center]')
        );
    };

    const isCoreValueField = (section: Section) => /^val-(icon|title|desc)-/i.test(section.id);

    const getCoreValueFieldType = (section: Section): 'icon' | 'title' | 'desc' | null => {
        if (!isCoreValueField(section)) return null;
        if (/^val-icon-/i.test(section.id)) return 'icon';
        if (/^val-title-/i.test(section.id)) return 'title';
        if (/^val-desc-/i.test(section.id)) return 'desc';
        return null;
    };

    const isLongLegalBodyField = (section: Section, pageId?: string) => {
        if (!pageId || !LEGAL_PAGE_IDS.has(pageId)) return false;
        if (section.id === 'INTRO_TEXT') return true;
        return /^SECTION_\d+_BODY$/i.test(section.id);
    };

    const getSectionCollapseStorageKey = (pageId: string, sectionId: string) => `${pageId}::${sectionId}`;

    const renderTextSectionCard = (section: Section, visibleIndex: number, pageIdx: number = selectedPageIndex, pageContext: PageContent | undefined = currentPage) => {
        const editable = isSectionBusinessEditable(section);
        const key = extractSectionKey(section);
        const editableLabel = canEditSectionField(section, 'label');
        const editableValue = canEditSectionField(section, 'value');
        const editableUrl = canEditSectionField(section, 'url');
        const hasUrlValue = !!String(section.url ?? '').trim();
        const deletable = canDeleteSection(section);
        const realSections = pageContext?.sections || [];
        const realIndex = realSections.findIndex(s => s.id === section.id);
        const canMoveUp = realIndex > 0;
        const canMoveDown = realIndex >= 0 && realIndex < realSections.length - 1;
        const coreValueField = isCoreValueField(section);
        const coreValueFieldType = getCoreValueFieldType(section);
        const iconField = coreValueFieldType === 'icon';
        const simpleCoreValueField = coreValueField && !showAdvancedEditor;
        const pageIdForStorage = pageContext?.id || currentPage?.id || 'unknown';
        const collapseStorageKey = getSectionCollapseStorageKey(pageIdForStorage, section.id);
        const isCollapsed = Boolean(sectionCollapsed[collapseStorageKey]);
        const effectiveCollapsed = showAdvancedEditor && !coreValueField ? isCollapsed : false;
        const textAreaRows = isLongLegalBodyField(section, pageContext?.id) ? 8 : 4;
        const displayTitle = getSectionDisplayTitle(section);
        const sectionHint = getSectionHint(section, pageContext?.id);
        const selectedIcon = (section.value || '').trim();
        const isKnownSelectedIcon = Boolean(selectedIcon && CORE_VALUE_ICON_COMPONENTS[selectedIcon]);
        const showSectionHint = !simpleCoreValueField;
        const showSectionOrder = !simpleCoreValueField;
        const showSectionActions = !simpleCoreValueField;

        return (
            <div key={`${section.id}-${visibleIndex}`} className="field-item-wrapper" style={{ background: editable ? '#fcfcfd' : '#f8fafc', padding: simpleCoreValueField ? '1rem' : '1.25rem', borderRadius: '14px', border: editable ? '1px solid #e5e7eb' : '1px dashed #cbd5e1' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 260, flex: 1 }}>
                        {showAdvancedEditor && !simpleCoreValueField ? (
                            <input
                                type="text"
                                value={looksLikeKeyToken(section.label) ? humanizeKey(section.label) : section.label}
                                onChange={(e) => handleSectionChange(pageIdx, section.id, 'label', e.target.value)}
                                disabled={!editableLabel}
                                style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', border: 'none', background: 'none', width: 'auto', padding: 0 }}
                            />
                        ) : (
                            <div className="section-title-readonly">{displayTitle}</div>
                        )}
                        {showSectionHint && <div className="section-meta-hint">{sectionHint}</div>}
                        {showAdvancedEditor && !simpleCoreValueField && (
                            <div className="section-technical-id">ID: {section.id}</div>
                        )}
                    </div>
                    {showAdvancedEditor && key && !simpleCoreValueField && (
                        <span style={{ fontSize: '10px', color: '#475569', background: '#f1f5f9', borderRadius: '999px', padding: '3px 8px', fontWeight: 700 }}>
                            Açar mətn
                        </span>
                    )}
                    {showSectionOrder && (
                        <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, marginLeft: showAdvancedEditor ? '0' : 'auto' }}>
                            Sıra: {visibleIndex + 1}
                        </span>
                    )}
                    {showAdvancedEditor && !simpleCoreValueField && (
                        <label className="section-hide-toggle">
                            <input
                                type="checkbox"
                                checked={isCollapsed}
                                onChange={(e) => {
                                    setSectionCollapsed((prev) => ({ ...prev, [collapseStorageKey]: e.target.checked }));
                                }}
                            />
                            <span>Paneldə gizlə</span>
                        </label>
                    )}
                </div>
                {effectiveCollapsed ? (
                    <div className="section-collapsed-tip">
                        Bu section paneldə gizlidir. Yenidən göstərmək üçün “Paneldə gizlə” seçimini söndürün.
                    </div>
                ) : (
                    <>
                        {iconField ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(54px, 1fr))', gap: '8px' }}>
                                    {CORE_VALUE_ICON_PRESETS.map((opt) => {
                                        const IconComponent = CORE_VALUE_ICON_COMPONENTS[opt];
                                        const selected = selectedIcon === opt;
                                        return (
                                            <button
                                                key={`${section.id}-${opt}`}
                                                type="button"
                                                title={opt}
                                                onClick={() => handleSectionChange(pageIdx, section.id, 'value', opt)}
                                                disabled={!editableValue}
                                                style={{
                                                    height: '48px',
                                                    border: selected ? '1px solid #f97316' : '1px solid #e2e8f0',
                                                    borderRadius: '10px',
                                                    background: selected ? '#fff7ed' : '#fff',
                                                    color: selected ? '#ea580c' : '#475569',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: editableValue ? 'pointer' : 'not-allowed'
                                                }}
                                            >
                                                <IconComponent size={18} />
                                            </button>
                                        );
                                    })}
                                </div>
                                {selectedIcon && !isKnownSelectedIcon && (
                                    <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 700 }}>
                                        Naməlum ikon kodu: {selectedIcon}. Düzgün ikon seçin.
                                    </div>
                                )}
                                {(showAdvancedEditor || !coreValueField) && (
                                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                                        Seçilmiş ikon: {selectedIcon || '-'}
                                    </div>
                                )}
                            </div>
                        ) : coreValueFieldType === 'title' ? (
                            <input
                                type="text"
                                value={section.value || ''}
                                onChange={(e) => handleSectionChange(pageIdx, section.id, 'value', e.target.value)}
                                disabled={!editableValue}
                                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: 700 }}
                            />
                        ) : key || !shouldUseRichEditor(section) || coreValueFieldType === 'desc' ? (
                            <textarea
                                value={section.value || ''}
                                onChange={(e) => handleSectionChange(pageIdx, section.id, 'value', e.target.value)}
                                onKeyDown={(e) => handleSectionTextareaKeyDown(e, pageIdx, section.id)}
                                disabled={!editableValue}
                                rows={coreValueFieldType === 'desc' ? 3 : textAreaRows}
                                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', lineHeight: '1.4', resize: 'vertical' }}
                            />
                        ) : (
                            <QuillEditor
                                id={`editor-${section.id}`}
                                value={bbcodeToHtmlForEditor(section.value || '')}
                                onChange={(val: string) => handleSectionChange(pageIdx, section.id, 'value', val)}
                                readOnly={!editableValue}
                            />
                        )}
                        {hasUrlValue && showSectionActions && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '0.75rem' }}>
                                <Globe size={14} style={{ color: '#94a3b8' }} />
                                <input
                                    type="text"
                                    value={toAbsoluteUrl(section.url || '')}
                                    onChange={(e) => handleSectionChange(pageIdx, section.id, 'url', e.target.value)}
                                    onBlur={() => normalizeSectionUrl(pageIdx, section.id)}
                                    disabled={!editableUrl}
                                    placeholder="URL (Məs: /about veya https://...)"
                                    style={{ fontSize: '12px', padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', flex: 1 }}
                                />
                            </div>
                        )}
                        {showSectionActions && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.9rem' }}>
                                {!hasUrlValue && editableUrl && (
                                    <button
                                        title="Link əlavə et"
                                        onClick={() => handleSectionChange(pageIdx, section.id, 'url', `${window.location.origin}/`)}
                                        style={{ background: '#fff', border: '1px solid #dbeafe', color: '#2563eb', borderRadius: '8px', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '12px' }}
                                    >
                                        <Globe size={12} /> Link əlavə et
                                    </button>
                                )}
                                {showAdvancedEditor && (
                                    <>
                                        <button
                                            title="Yuxarı daşı"
                                            onClick={() => moveField('text', section.id, 'up', pageIdx)}
                                            disabled={!canMoveUp}
                                            style={{ background: '#fff', border: '1px solid #e2e8f0', color: canMoveUp ? '#334155' : '#cbd5e1', borderRadius: '8px', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6, cursor: canMoveUp ? 'pointer' : 'not-allowed', fontSize: '12px' }}
                                        >
                                            <ChevronUp size={12} /> Yuxarı
                                        </button>
                                        <button
                                            title="Aşağı daşı"
                                            onClick={() => moveField('text', section.id, 'down', pageIdx)}
                                            disabled={!canMoveDown}
                                            style={{ background: '#fff', border: '1px solid #e2e8f0', color: canMoveDown ? '#334155' : '#cbd5e1', borderRadius: '8px', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6, cursor: canMoveDown ? 'pointer' : 'not-allowed', fontSize: '12px' }}
                                        >
                                            <ChevronDown size={12} /> Aşağı
                                        </button>
                                        {deletable && (
                                            <button
                                                className="field-delete-btn"
                                                onClick={() => removeField('text', section.id, pageIdx)}
                                                style={{ background: '#fff', border: '1px solid #fee2e2', color: '#ef4444', borderRadius: '8px', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '12px' }}
                                            >
                                                <Trash2 size={12} /> Sil
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        );
    };

    const contactGroupedSections = (() => {
        if (currentPage?.id !== 'contactpage') return [];
        const usedIds = new Set<string>();
        const hiddenTopicIds = new Set<string>(CONTACT_LEGACY_TOPIC_FIELDS.map((field) => field.id));

        const groups: Array<{ title: string; subtitle: string; sections: Section[] }> = CONTACT_SECTION_GROUPS.map((group) => {
            const baseSections = group.ids
                .map((id) => displayedSections.find((section) => section.id === id))
                .filter(Boolean) as Section[];
            const sections = group.title === 'Form'
                ? baseSections.filter((section) => !hiddenTopicIds.has(section.id))
                : baseSections;

            sections.forEach((section) => usedIds.add(section.id));
            return {
                title: group.title,
                subtitle: group.subtitle,
                sections
            };
        }).filter((group) => group.sections.length > 0);

        displayedSections.forEach((section) => {
            if (CONTACT_TOPIC_OPTION_REGEX.test(String(section.id || ''))) usedIds.add(section.id);
            if (hiddenTopicIds.has(section.id)) usedIds.add(section.id);
        });

        const extraSections = displayedSections.filter((section) => !usedIds.has(section.id));
        if (extraSections.length > 0) groups.push({ title: 'Digər Sahələr', subtitle: 'Avtomatik qruplaşdırıla bilməyən sahələr', sections: extraSections });
        return groups;
    })();

    const legalGroupedSections = (() => {
        if (!currentPage?.id || !LEGAL_SECTION_GROUPS[currentPage.id]) return [];
        const pageGroups = LEGAL_SECTION_GROUPS[currentPage.id];
        const headerGroup = pageGroups[0];
        const textGroup = pageGroups[1];
        const contactGroup = pageGroups[2];
        const usedIds = new Set<string>();
        const groups: Array<{ title: string; subtitle: string; sections: Section[]; kind?: 'legal-sections' }> = [];

        const headerSections = headerGroup.ids
            .map((id) => displayedSections.find((section) => section.id === id))
            .filter(Boolean) as Section[];
        if (headerSections.length > 0) {
            headerSections.forEach((section) => usedIds.add(section.id));
            groups.push({ title: headerGroup.title, subtitle: headerGroup.subtitle, sections: headerSections });
        }

        const textSections = [...displayedSections]
            .filter((section) => LEGAL_DYNAMIC_SECTION_REGEX.test(String(section.id || '')))
            .sort((a, b) => {
                const aMatch = String(a.id || '').match(LEGAL_DYNAMIC_SECTION_REGEX);
                const bMatch = String(b.id || '').match(LEGAL_DYNAMIC_SECTION_REGEX);
                if (!aMatch || !bMatch) return 0;
                const sectionNoDiff = Number(aMatch[1]) - Number(bMatch[1]);
                if (sectionNoDiff !== 0) return sectionNoDiff;
                if (aMatch[2] === bMatch[2]) return 0;
                const fieldOrder: Record<string, number> = { TITLE: 0, ICON: 1, BODY: 2 };
                const aField = String(aMatch[2] || '').toUpperCase();
                const bField = String(bMatch[2] || '').toUpperCase();
                return (fieldOrder[aField] ?? 99) - (fieldOrder[bField] ?? 99);
            });

        if (textSections.length > 0) {
            textSections.forEach((section) => usedIds.add(section.id));
            groups.push({
                title: textGroup.title,
                subtitle: textGroup.subtitle,
                sections: textSections,
                kind: 'legal-sections'
            });
        }

        const contactSections = contactGroup.ids
            .map((id) => displayedSections.find((section) => section.id === id))
            .filter(Boolean) as Section[];
        if (contactSections.length > 0) {
            contactSections.forEach((section) => usedIds.add(section.id));
            groups.push({ title: contactGroup.title, subtitle: contactGroup.subtitle, sections: contactSections });
        }

        const extraSections = displayedSections.filter((section) => !usedIds.has(section.id));
        if (extraSections.length > 0) {
            groups.push({
                title: 'Digər Sahələr',
                subtitle: 'Avtomatik qruplaşdırıla bilməyən əlavə sahələr',
                sections: extraSections
            });
        }
        return groups;
    })();

    const renderPartnerIconPreview = (token: string, size: number = 16) => {
        const Icon = PARTNER_ICON_COMPONENTS[token] || ShieldCheck;
        return <Icon size={size} />;
    };

    const renderPartnersEditor = (pageContext: PageContent, pageIdx: number) => {
        const rows = getPartnerRows(pageContext).filter((row) => {
            const imageId = normalizePartnerImageId(row);
            const imageAsset = (pageContext.images || []).find((img) => img.id === imageId);
            return matchesSearch(
                row.index,
                row.name,
                row.tag,
                row.icon,
                row.useImage,
                row.imageId,
                row.linkUrl,
                imageAsset?.path,
                imageAsset?.alt
            );
        });

        return (
            <div className="field-group">
                <div className="field-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label><Trophy size={16} /> Tərəfdaş Kartları</label>
                    <button className="add-field-minimal" onClick={() => addPartnerRow(pageIdx)}>
                        <Plus size={14} /> Tərəfdaş Əlavə Et
                    </button>
                </div>

                <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '6px', fontWeight: 700 }}>Bölmə Başlığı</label>
                    <input
                        type="text"
                        value={pageContext.sections.find((s) => s.id === 'SECTION_TITLE')?.value || ''}
                        onChange={(e) => handleSectionChange(pageIdx, 'SECTION_TITLE', 'value', e.target.value)}
                        style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: 700 }}
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px' }}>
                    {rows.length === 0 ? (
                        <div style={{ gridColumn: '1/-1', padding: '1rem', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#64748b', fontSize: '13px' }}>
                            {searchTerm ? 'Axtarışa uyğun tərəfdaş tapılmadı.' : 'Hələ tərəfdaş kartı yoxdur. "Tərəfdaş Əlavə Et" ilə başlayın.'}
                        </div>
                    ) : rows.map((row, idx) => {
                        const canMoveUp = idx > 0;
                        const canMoveDown = idx < rows.length - 1;
                        const imageId = normalizePartnerImageId(row);
                        const imageAsset = (pageContext.images || []).find((img) => img.id === imageId);
                        const useImage = ['1', 'true', 'yes', 'on'].includes((row.useImage || '').toLowerCase());

                        return (
                            <div key={`${pageIdx}-${row.index}`} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', background: '#fff', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800 }}>
                                        {idx + 1}
                                    </div>
                                    <input
                                        type="text"
                                        value={row.name}
                                        onChange={(e) => updatePartnerRowField(row.index, 'name', e.target.value, pageIdx)}
                                        placeholder="Tərəfdaş adı"
                                        style={{ flex: 1, padding: '9px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: 700 }}
                                    />
                                </div>
                                <input
                                    type="text"
                                    value={row.linkUrl || ''}
                                    onChange={(e) => updatePartnerRowField(row.index, 'linkUrl', e.target.value, pageIdx)}
                                    placeholder="Link URL (opsional) - məsələn: https://example.com"
                                    style={{ width: '100%', padding: '9px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                                />

                                <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: '10px', alignItems: 'start' }}>
                                    <div style={{ width: '72px', height: '72px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                                        {useImage ? (
                                            imageAsset?.path ? <img src={imageAsset.path} alt={imageAsset.alt || row.name || `Partner ${row.index}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageIcon size={18} />
                                        ) : renderPartnerIconPreview(row.icon || 'ShieldCheck', 18)}
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            <button
                                                type="button"
                                                onClick={() => updatePartnerRowField(row.index, 'useImage', 'false', pageIdx)}
                                                style={{
                                                    padding: '7px 10px',
                                                    borderRadius: '8px',
                                                    border: !useImage ? '1px solid #fb923c' : '1px solid #e2e8f0',
                                                    background: !useImage ? '#fff7ed' : '#fff',
                                                    color: !useImage ? '#c2410c' : '#334155',
                                                    fontSize: '12px',
                                                    fontWeight: 700
                                                }}
                                            >
                                                İkon
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    updatePartnerRowField(row.index, 'useImage', 'true', pageIdx);
                                                    ensurePartnerImageSlot(row, pageIdx);
                                                }}
                                                style={{
                                                    padding: '7px 10px',
                                                    borderRadius: '8px',
                                                    border: useImage ? '1px solid #fb923c' : '1px solid #e2e8f0',
                                                    background: useImage ? '#fff7ed' : '#fff',
                                                    color: useImage ? '#c2410c' : '#334155',
                                                    fontSize: '12px',
                                                    fontWeight: 700
                                                }}
                                            >
                                                Görsəl
                                            </button>
                                        </div>

                                        {!useImage ? (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                {PARTNER_ICON_PRESETS.map((iconToken) => {
                                                    const isActive = (row.icon || '').toLowerCase() === iconToken.toLowerCase();
                                                    return (
                                                        <button
                                                            key={`${row.index}-${iconToken}`}
                                                            type="button"
                                                            onClick={() => updatePartnerRowField(row.index, 'icon', iconToken, pageIdx)}
                                                            style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '6px',
                                                                padding: '7px 10px',
                                                                borderRadius: '8px',
                                                                border: isActive ? '1px solid #fb923c' : '1px solid #e2e8f0',
                                                                background: isActive ? '#fff7ed' : '#fff',
                                                                color: isActive ? '#c2410c' : '#334155',
                                                                fontSize: '12px',
                                                                fontWeight: 700
                                                            }}
                                                        >
                                                            {renderPartnerIconPreview(iconToken, 14)}
                                                            {iconToken}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '6px' }}>
                                                <input
                                                    type="text"
                                                    value={imageAsset?.path || ''}
                                                    onChange={(e) => updatePartnerImageAsset(row, { path: e.target.value }, pageIdx)}
                                                    placeholder="Görsel URL / yol"
                                                    style={{ padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                                                />
                                                <input
                                                    id={`partner-upload-${pageIdx}-${row.index}`}
                                                    type="file"
                                                    accept="image/*"
                                                    style={{ display: 'none' }}
                                                    onChange={async (e) => {
                                                        const f = e.target.files?.[0];
                                                        if (!f) return;
                                                        const url = await uploadImage(f);
                                                        if (url) updatePartnerImageAsset(row, { path: url }, pageIdx);
                                                        e.target.value = '';
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    className="btn-secondary"
                                                    style={{ padding: '8px 10px', fontSize: '12px' }}
                                                    onClick={() => document.getElementById(`partner-upload-${pageIdx}-${row.index}`)?.click()}
                                                >
                                                    Yüklə
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn-secondary"
                                                    style={{ padding: '8px 10px', fontSize: '12px' }}
                                                    onClick={() => {
                                                        const ensured = ensurePartnerImageSlot(row, pageIdx);
                                                        if (!ensured) return;
                                                        openImageSelector(pageIdx, ensured);
                                                    }}
                                                >
                                                    Kitabxana
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '2px' }}>
                                    <button
                                        title="Yuxarı"
                                        onClick={() => movePartnerRow(row.index, 'up', pageIdx)}
                                        disabled={!canMoveUp}
                                        style={{ width: '30px', height: '30px', border: '1px solid #e2e8f0', background: '#fff', borderRadius: '8px', color: canMoveUp ? '#334155' : '#cbd5e1' }}
                                    >
                                        <ChevronUp size={14} />
                                    </button>
                                    <button
                                        title="Aşağı"
                                        onClick={() => movePartnerRow(row.index, 'down', pageIdx)}
                                        disabled={!canMoveDown}
                                        style={{ width: '30px', height: '30px', border: '1px solid #e2e8f0', background: '#fff', borderRadius: '8px', color: canMoveDown ? '#334155' : '#cbd5e1' }}
                                    >
                                        <ChevronDown size={14} />
                                    </button>
                                    <button
                                        title="Sil"
                                        onClick={() => removePartnerRow(row.index, pageIdx)}
                                        style={{ width: '30px', height: '30px', border: '1px solid #fee2e2', background: '#fff', borderRadius: '8px', color: '#ef4444' }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const filteredNews = news.filter((item) =>
        matchesSearch(item.title, item.date, item.category, item.status, item.description)
    );
    const filteredEvents = events.filter((item) =>
        matchesSearch(item.title, item.date, item.location, item.category, item.status, item.description)
    );
    const filteredVideos = videos.filter((item) =>
        matchesSearch(item.title, item.duration, item.youtubeUrl, item.videoId, item.created_at)
    );
    const eventAlbumOptions = events
        .map((event) => ({
            eventId: event.id,
            album: normalizePhotoAlbum(event.title)
        }))
        .filter((entry, index, array) =>
            array.findIndex((candidate) => candidate.album === entry.album) === index
        );

    const availablePhotoAlbums = Array.from(new Set([
        DEFAULT_PHOTO_ALBUM,
        ...eventAlbumOptions.map((entry) => entry.album),
        ...galleryPhotos.map((item) => normalizePhotoAlbum(item.album)),
        normalizePhotoAlbum(selectedPhotoAlbum),
        normalizePhotoAlbum(typeof photoForm.album === 'string' ? photoForm.album : '')
    ]))
        .filter((album) => !!album.trim())
        .sort((a, b) => a.localeCompare(b, 'az'));

    const activePhotoAlbumFilter = photoAlbumFilter === 'all'
        ? 'all'
        : normalizePhotoAlbum(photoAlbumFilter);

    const filteredPhotos = galleryPhotos.filter((item) => {
        const itemAlbum = normalizePhotoAlbum(item.album);
        const albumMatches = activePhotoAlbumFilter === 'all' || itemAlbum === activePhotoAlbumFilter;
        return albumMatches && matchesSearch(item.title, item.url, itemAlbum);
    });

    const resetAllCollapsedPanels = () => {
        setGroupedPageCollapsed({});
        setSectionCollapsed({});
        toast.success('Gizlədilən bütün sahələr yenidən açıldı');
    };

    return (
        <div className="visual-editor fade-in">
            <div className="editor-header">
                <div className="header-top-row">
                    <div className="header-info">
                        <h1><Globe size={20} /> Admin Panel</h1>
                    </div>

                    <div className="header-search-container">
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                            placeholder="Komponentləri və məzmunu axtar..."
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="header-search-input"
                        />
                    </div>

                    <div className="header-actions">
                        {editorMode === 'extract' && (
                            <span className="editor-lock-badge" title="Geniş rejim məcburi aktivdir">
                                Geniş Rejim: Məcburi
                            </span>
                        )}
                        {editorMode === 'extract' && (
                            <button
                                type="button"
                                className="editor-secondary-btn"
                                onClick={resetAllCollapsedPanels}
                                title="Paneldə gizlədilən bütün bölmələri yenidən göstər"
                            >
                                Gizlədilənləri Aç
                            </button>
                        )}
                        <button
                            className={`save-btn ${isSaving ? 'saving' : ''}`}
                            onClick={saveChanges}
                            disabled={isSaving}
                        >
                            {isSaving ? 'Gözləyin...' : <><Save size={16} /> Saxla</>}
                        </button>
                    </div>
                </div>

                <div className="mode-switcher">
                    <button
                        className={`mode-btn ${editorMode === 'extract' ? 'active' : ''}`}
                        onClick={() => setEditorMode('extract')}
                    >
                        Ana Səhifə
                    </button>
                    <button
                        className={`mode-btn ${editorMode === 'events' ? 'active' : ''}`}
                        onClick={() => setEditorMode('events')}
                    >
                        Tədbirlər
                    </button>
                    <button
                        className={`mode-btn ${editorMode === 'event-management' ? 'active' : ''}`}
                        onClick={() => setEditorMode('event-management')}
                    >
                        Tədbir İdarəetməsi
                    </button>
                    <button
                        className={`mode-btn ${editorMode === 'news' ? 'active' : ''}`}
                        onClick={() => setEditorMode('news')}
                    >
                        Xəbərlər
                    </button>
                    <button
                        className={`mode-btn ${editorMode === 'drivers' ? 'active' : ''}`}
                        onClick={() => setEditorMode('drivers')}
                    >
                        Sürücülər
                    </button>
                    <button
                        className={`mode-btn ${editorMode === 'videos' ? 'active' : ''}`}
                        onClick={() => setEditorMode('videos')}
                    >
                        Videolar
                    </button>
                    <button
                        className={`mode-btn ${editorMode === 'photos' ? 'active' : ''}`}
                        onClick={() => setEditorMode('photos')}
                    >
                        Fotolar
                    </button>
                </div>
                {editorMode === 'extract' && (
                    <div className="editor-view-note">
                        Geniş rejim məcburi aktivdir: texniki ID, sıralama, silmə və gizlətmə alətləri hər zaman görünür.
                    </div>
                )}
            </div>

            {editorMode === 'event-management' ? (
                <div className="editor-layout with-sidebar">
                    <aside className="page-list">
                        <div className="list-header" style={{ marginBottom: '1rem' }}>
                            <h3>Tədbir İdarəetməsi</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <button
                                className={`page-nav-item ${eventManagementTab === 'modal' ? 'active' : ''}`}
                                onClick={() => setEventManagementTab('modal')}
                                style={{ width: '100%', textAlign: 'left' }}
                            >
                                <Layout size={14} /> Yarışda İştirak
                            </button>
                            <button
                                className={`page-nav-item ${eventManagementTab === 'pilot' ? 'active' : ''}`}
                                onClick={() => setEventManagementTab('pilot')}
                                style={{ width: '100%', textAlign: 'left' }}
                            >
                                <FileText size={14} /> Pilot Qeydiyyatı
                            </button>
                            <button
                                className={`page-nav-item ${eventManagementTab === 'clubs' ? 'active' : ''}`}
                                onClick={() => setEventManagementTab('clubs')}
                                style={{ width: '100%', textAlign: 'left' }}
                            >
                                <List size={14} /> Klub Seçimləri
                            </button>
                        </div>
                    </aside>

                    <main className="editor-canvas editor-canvas-flat">
                        <div className="editor-workspace">
                            <div className="canvas-header canvas-header-block">
                                <h2 style={{ fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Calendar size={22} /> Tədbir İdarəetməsi
                                </h2>
                                <p style={{ color: '#64748b' }}>
                                    Tədbir modalı, pilot qeydiyyat formu və klub dropdown seçimlərini buradan dəyişin.
                                </p>
                            </div>

                            {eventManagementTab === 'modal' ? (
                                <div className="edit-grid grid-2">
                                    <div className="form-group full-span">
                                        <label>MODAL BAŞLIĞI</label>
                                        <input
                                            type="text"
                                            value={getEventsPageConfigValue('MODAL_TITLE', 'YARIŞDA İŞTİRAK')}
                                            onChange={(e) => updateEventManagementValue('MODAL_TITLE', 'İştirak Modal Başlığı', e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>TƏDBİRƏ QOŞUL DÜYMƏSİ</label>
                                        <input
                                            type="text"
                                            value={getEventsPageConfigValue('BTN_JOIN_EVENT', 'TƏDBİRƏ QOŞUL')}
                                            onChange={(e) => updateEventManagementValue('BTN_JOIN_EVENT', 'Tədbirə Qoşul Düyməsi', e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>QEYDİYYAT BAĞLI DÜYMƏSİ</label>
                                        <input
                                            type="text"
                                            value={getEventsPageConfigValue('BTN_JOIN_EVENT_UNAVAILABLE', 'Qeydiyyat aktiv deyil')}
                                            onChange={(e) => updateEventManagementValue('BTN_JOIN_EVENT_UNAVAILABLE', 'Qeydiyyat Bağlı Düyməsi', e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>PİLOT KART BAŞLIĞI</label>
                                        <input
                                            type="text"
                                            value={getEventsPageConfigValue('JOIN_AS_PILOT', 'PİLOT KİMİ QATIL')}
                                            onChange={(e) => updateEventManagementValue('JOIN_AS_PILOT', 'Pilot Kart Başlığı', e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>PİLOT KART TƏSVİRİ</label>
                                        <input
                                            type="text"
                                            value={getEventsPageConfigValue('JOIN_PILOT_DESC', 'TEXNİKİ REQLAMENTƏ UYĞUN OLARAQ')}
                                            onChange={(e) => updateEventManagementValue('JOIN_PILOT_DESC', 'Pilot Kart Təsviri', e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>İZLƏYİCİ KART BAŞLIĞI</label>
                                        <input
                                            type="text"
                                            value={getEventsPageConfigValue('JOIN_AS_SPECTATOR', 'İZLƏYİCİ KİMİ QATIL')}
                                            onChange={(e) => updateEventManagementValue('JOIN_AS_SPECTATOR', 'İzləyici Kart Başlığı', e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>İZLƏYİCİ KART TƏSVİRİ</label>
                                        <input
                                            type="text"
                                            value={getEventsPageConfigValue('JOIN_SPECTATOR_DESC', 'YARIŞI TRİBUNADAN İZLƏ')}
                                            onChange={(e) => updateEventManagementValue('JOIN_SPECTATOR_DESC', 'İzləyici Kart Təsviri', e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group full-span">
                                        <label>İZLƏYİCİ YÖNLƏNDİRMƏ URL</label>
                                        <input
                                            type="text"
                                            value={getEventsPageConfigValue('SPECTATOR_TICKET_URL', 'https://iticket.az')}
                                            onChange={(e) => updateEventManagementUrl('SPECTATOR_TICKET_URL', 'İzləyici Bilet Linki', e.target.value, e.target.value)}
                                            placeholder="https://..."
                                        />
                                    </div>
                                </div>
                            ) : eventManagementTab === 'pilot' ? (
                                <div className="edit-grid grid-2">
                                    <div className="form-group full-span">
                                        <label>GERİ DÜYMƏSİ</label>
                                        <input
                                            type="text"
                                            value={getEventsPageConfigValue('BTN_BACK', 'GERİ QAYIT')}
                                            onChange={(e) => updateEventManagementValue('BTN_BACK', 'Geri Düyməsi', e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group full-span">
                                        <label>PİLOT QEYDİYYATI BAŞLIĞI</label>
                                        <input
                                            type="text"
                                            value={getEventsPageConfigValue('PILOT_REG_TITLE', 'PİLOT QEYDİYYATI')}
                                            onChange={(e) => updateEventManagementValue('PILOT_REG_TITLE', 'Pilot Qeydiyyatı Başlığı', e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>AD VƏ SOYAD LABEL</label>
                                        <input
                                            type="text"
                                            value={getEventsPageConfigValue('FIELD_NAME', 'AD VƏ SOYAD')}
                                            onChange={(e) => updateEventManagementValue('FIELD_NAME', 'Ad Soyad Label', e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>AD VƏ SOYAD PLACEHOLDER</label>
                                        <input
                                            type="text"
                                            value={getEventsPageConfigValue('PLACEHOLDER_NAME', 'Tam ad daxil edin')}
                                            onChange={(e) => updateEventManagementValue('PLACEHOLDER_NAME', 'Ad Soyad Placeholder', e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>WHATSAPP LABEL</label>
                                        <input
                                            type="text"
                                            value={getEventsPageConfigValue('FIELD_WHATSAPP', getEventsPageConfigValue('FIELD_PHONE', 'WHATSAPP NÖMRƏSİ'))}
                                            onChange={(e) => updateEventManagementValue('FIELD_WHATSAPP', 'WhatsApp Label', e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>WHATSAPP PLACEHOLDER</label>
                                        <input
                                            type="text"
                                            value={getEventsPageConfigValue('PLACEHOLDER_WHATSAPP', getEventsPageConfigValue('PLACEHOLDER_PHONE', '+994 50 123 45 67'))}
                                            onChange={(e) => updateEventManagementValue('PLACEHOLDER_WHATSAPP', 'WhatsApp Placeholder', e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>AVTOMOBİL LABEL</label>
                                        <input
                                            type="text"
                                            value={getEventsPageConfigValue('FIELD_CAR_MODEL', 'AVTOMOBİLİN MARKA/MODELİ')}
                                            onChange={(e) => updateEventManagementValue('FIELD_CAR_MODEL', 'Avtomobil Label', e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>AVTOMOBİL PLACEHOLDER</label>
                                        <input
                                            type="text"
                                            value={getEventsPageConfigValue('PLACEHOLDER_CAR', 'Məs: Toyota LC 105')}
                                            onChange={(e) => updateEventManagementValue('PLACEHOLDER_CAR', 'Avtomobil Placeholder', e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>TƏKƏR LABEL</label>
                                        <input
                                            type="text"
                                            value={getEventsPageConfigValue('FIELD_TIRE_SIZE', 'TƏKƏR ÖLÇÜSÜ')}
                                            onChange={(e) => updateEventManagementValue('FIELD_TIRE_SIZE', 'Təkər Label', e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>TƏKƏR PLACEHOLDER</label>
                                        <input
                                            type="text"
                                            value={getEventsPageConfigValue('PLACEHOLDER_TIRE', 'Məs: 35 DÜYM')}
                                            onChange={(e) => updateEventManagementValue('PLACEHOLDER_TIRE', 'Təkər Placeholder', e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>MÜHƏRRİK LABEL</label>
                                        <input
                                            type="text"
                                            value={getEventsPageConfigValue('FIELD_ENGINE', 'MÜHƏRRİK HƏCMİ')}
                                            onChange={(e) => updateEventManagementValue('FIELD_ENGINE', 'Mühərrik Label', e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>MÜHƏRRİK PLACEHOLDER</label>
                                        <input
                                            type="text"
                                            value={getEventsPageConfigValue('PLACEHOLDER_ENGINE', 'Məs: 4.4L')}
                                            onChange={(e) => updateEventManagementValue('PLACEHOLDER_ENGINE', 'Mühərrik Placeholder', e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>KLUB LABEL</label>
                                        <input
                                            type="text"
                                            value={getEventsPageConfigValue('FIELD_CLUB', 'TƏMSİL ETDİYİ KLUB')}
                                            onChange={(e) => updateEventManagementValue('FIELD_CLUB', 'Klub Label', e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>TAMAMLAMA DÜYMƏSİ</label>
                                        <input
                                            type="text"
                                            value={getEventsPageConfigValue('BTN_COMPLETE_REG', 'QEYDİYYATI TAMAMLA')}
                                            onChange={(e) => updateEventManagementValue('BTN_COMPLETE_REG', 'Qeydiyyatı Tamamla Düyməsi', e.target.value)}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="edit-grid grid-2">
                                    <div className="form-group full-span">
                                        <label>KLUB DROPDOWN BAŞLIĞI</label>
                                        <input
                                            type="text"
                                            value={getEventsPageConfigValue('FIELD_CLUB', 'TƏMSİL ETDİYİ KLUB')}
                                            onChange={(e) => updateEventManagementValue('FIELD_CLUB', 'Klub Label', e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group full-span">
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                            <label style={{ marginBottom: 0 }}>KLUB SEÇİMLƏRİ</label>
                                            <button
                                                type="button"
                                                className="add-section-btn add-option-btn"
                                                onClick={addEventManagementClubOption}
                                            >
                                                <Plus size={14} />
                                                Yeni Option
                                            </button>
                                        </div>
                                    </div>
                                    {eventClubOptionRows.map((row) => (
                                        <div className="form-group full-span" key={row.id}>
                                            <label>KLUB SEÇİMİ {row.optionNumber}</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <input
                                                    type="text"
                                                    value={row.value}
                                                    ref={(el) => {
                                                        clubOptionInputRefs.current[row.id] = el;
                                                    }}
                                                    onChange={(e) => updateEventManagementValue(row.id, `Klub Seçimi ${row.optionNumber}`, e.target.value)}
                                                />
                                                <button
                                                    type="button"
                                                    className="delete-section-btn"
                                                    onClick={() => removeEventManagementClubOption(row.id)}
                                                    disabled={eventClubOptionRows.length <= 1}
                                                    title={eventClubOptionRows.length <= 1 ? 'Ən azı bir seçim qalmalıdır' : 'Seçimi sil'}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="editor-savebar">
                                <button className="btn-primary" onClick={saveChanges}>Yadda Saxla</button>
                            </div>
                        </div>
                    </main>
                </div>
            ) : editorMode === 'news' ? (
                <div className="editor-layout with-sidebar">
                    <aside className="page-list">
                        <div className="list-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3>Xəbərlər</h3>
                            <button className="add-section-btn" onClick={addNewNews}>
                                <Plus size={16} />
                            </button>
                        </div>
                        <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
                            {filteredNews.length === 0 ? (
                                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem', border: '1px dashed #e2e8f0', borderRadius: '8px' }}>
                                    {searchQuery ? (
                                        <>
                                            <div style={{ marginBottom: '10px' }}>Axtarışa uyğun xəbər tapılmadı.</div>
                                            <button
                                                type="button"
                                                className="btn-secondary"
                                                onClick={() => setSearchTerm('')}
                                                style={{ fontSize: '12px' }}
                                            >
                                                Filtri təmizlə
                                            </button>
                                        </>
                                    ) : (
                                        'Hələ heç bir xəbər yoxdur. Yeni xəbər yaratmaq üçün yuxarıdakı "+" düyməsini basın.'
                                    )}
                                </div>
                            ) : (
                                filteredNews.map((item) => (
                                    <div key={item.id} className="page-nav-wrapper" style={{ position: 'relative', marginBottom: '4px' }}>
                                        <button
                                            className={`page-nav-item ${selectedNewsId === item.id ? 'active' : ''}`}
                                            onClick={() => handleNewsSelect(item.id)}
                                            style={{ width: '100%', paddingRight: '40px', textAlign: 'left' }}
                                        >
                                            <FileText size={14} /> {getNewsLocalizedFieldValue(item, 'title', 'AZ')}
                                            <div style={{ fontSize: '10px', color: '#999', marginLeft: '24px' }}>{item.date}</div>
                                        </button>
                                        <button
                                            className="delete-section-btn"
                                            onClick={(e) => deleteNews(item.id, e)}
                                            style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#ff4d4f', opacity: 0.5, cursor: 'pointer' }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </aside>

                    <main className="editor-canvas editor-canvas-flat">
                        {selectedNewsId !== null && newsForm.id !== undefined ? (
                            <div className="editor-workspace">
                                <div className="canvas-header canvas-header-block">
                                    <h2 style={{ fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <FileText size={22} /> Xəbəri Redaktə Et
                                    </h2>
                                    <p style={{ color: '#64748b' }}>
                                        {getNewsLocalizedFieldValue(newsForm, 'title', newsFormLanguage, true) || 'Yeni Xəbər'} // ID: {newsForm.id}
                                    </p>
                                </div>

                                <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        {EVENT_LANGUAGE_TABS.map((tab) => {
                                            const isActive = newsFormLanguage === tab.code;
                                            return (
                                                <button
                                                    key={tab.code}
                                                    type="button"
                                                    className="btn-secondary"
                                                    onClick={() => setNewsFormLanguage(tab.code)}
                                                    style={{
                                                        minWidth: '72px',
                                                        background: isActive ? '#FF4D00' : '#111',
                                                        color: isActive ? '#000' : '#fff',
                                                        border: isActive ? '1px solid #FF4D00' : '1px solid #e2e8f0'
                                                    }}
                                                >
                                                    {tab.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <button
                                        type="button"
                                        className="btn-secondary"
                                        onClick={() => void autoFillNewsLanguages(newsFormLanguage, newsForm.id)}
                                        disabled={isAutoTranslatingNews}
                                        style={{ minWidth: '240px' }}
                                    >
                                        {isAutoTranslatingNews ? 'Doldurulur...' : 'Digər dilləri avtomatik doldur'}
                                    </button>
                                </div>

                                <div className="edit-grid grid-2">
                                    <div className="form-group">
                                        <label>BAŞLIQ ({newsFormLanguage})</label>
                                        <input
                                            type="text"
                                            value={getNewsLocalizedFieldValue(newsForm, 'title', newsFormLanguage, false)}
                                            onChange={(e) => handleNewsLocalizedChange('title', e.target.value, newsFormLanguage, newsForm.id)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>TARİX</label>
                                        <input
                                            type="date"
                                            value={newsForm.date}
                                            onChange={(e) => handleNewsChange('date', e.target.value, newsForm.id)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>KATEQORİYA ({newsFormLanguage})</label>
                                        <input
                                            type="text"
                                            value={getNewsLocalizedFieldValue(newsForm, 'category', newsFormLanguage, false)}
                                            onChange={(e) => handleNewsLocalizedChange('category', e.target.value, newsFormLanguage, newsForm.id)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>VƏZİYYƏT</label>
                                        <select
                                            value={newsForm.status}
                                            onChange={(e) => handleNewsChange('status', e.target.value, newsForm.id)}
                                        >
                                            <option value="draft">Qaralama</option>
                                            <option value="published">Dərc edilib</option>
                                        </select>
                                    </div>
                                    <div className="form-group full-span">
                                        <label>ŞƏKİL</label>
                                        <div style={{ width: '100%', height: '180px', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f8fafc', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {newsForm.img ? (
                                                <img src={newsForm.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                <span style={{ color: '#94a3b8', fontSize: '12px' }}>Şəkil seçilməyib</span>
                                            )}
                                        </div>
                                        <div className="input-row">
                                            <input
                                                type="text"
                                                value={newsForm.img}
                                                onChange={(e) => handleNewsChange('img', e.target.value, newsForm.id)}
                                            />
                                            <input
                                                type="file"
                                                id="news-full-img"
                                                style={{ display: 'none' }}
                                                onChange={async (e) => {
                                                    const f = e.target.files?.[0];
                                                    if (f) {
                                                        const url = await uploadImage(f);
                                                        if (url) handleNewsChange('img', url, newsForm.id);
                                                    }
                                                }}
                                            />
                                            <button onClick={() => document.getElementById('news-full-img')?.click()} className="btn-secondary">Yüklə</button>
                                        </div>
                                    </div>
                                    <div className="form-group full-span">
                                        <label>MƏZMUN ({newsFormLanguage})</label>
                                        <QuillEditor
                                            key={`news-full-desc-${newsForm.id}-${newsFormLanguage}`}
                                            id={`news-full-desc-${newsForm.id}-${newsFormLanguage}`}
                                            value={bbcodeToHtmlForEditor(getNewsLocalizedFieldValue(newsForm, 'description', newsFormLanguage, false))}
                                            onChange={(val: string) => handleNewsLocalizedChange('description', val, newsFormLanguage, newsForm.id)}
                                        />
                                    </div>
                                </div>

                                <div className="editor-savebar">
                                    <button className="btn-primary" onClick={saveChanges}>Yadda Saxla</button>
                                </div>

                                <div className="edit-grid grid-2" style={{ marginTop: '1.25rem', display: 'none' }}>
                                    <div className="form-group full-span" style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', background: '#f8fafc' }}>
                                        <label style={{ color: '#0f172a' }}>SECTION 1: TƏDBİRƏ QOŞUL DÜYMƏSİ</label>
                                        <input
                                            type="text"
                                            value={getEventsPageConfigValue('BTN_JOIN_EVENT', 'TƏDBİRƏ QOŞUL')}
                                            onChange={(e) => {
                                                if (eventsPageIndex < 0) return;
                                                handleSectionChange(eventsPageIndex, 'BTN_JOIN_EVENT', 'value', e.target.value);
                                            }}
                                            placeholder="TƏDBİRƏ QOŞUL"
                                        />
                                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#64748b' }}>
                                            Tədbir detalında böyük narıncı düymənin mətnini buradan dəyişin.
                                        </div>
                                        <input
                                            type="text"
                                            value={getEventsPageConfigValue('BTN_JOIN_EVENT_UNAVAILABLE', 'Qeydiyyat aktiv deyil')}
                                            onChange={(e) => {
                                                if (eventsPageIndex < 0) return;
                                                handleSectionChange(eventsPageIndex, 'BTN_JOIN_EVENT_UNAVAILABLE', 'value', e.target.value);
                                            }}
                                            placeholder="Qeydiyyat aktiv deyil"
                                            style={{ marginTop: '10px' }}
                                        />
                                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#64748b' }}>
                                            Qeydiyyat bağlı olduqda görünən düymə mətnini buradan dəyişin.
                                        </div>
                                    </div>

                                    <div className="form-group full-span" style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', background: '#f8fafc' }}>
                                        <label style={{ color: '#0f172a' }}>SECTION 2: SUALINIZ VAR KARTI</label>
                                        <div style={{ display: 'grid', gap: '10px' }}>
                                            <input
                                                type="text"
                                                value={getEventsPageConfigValue('SIDEBAR_QUESTION_TITLE', 'SUALINIZ VAR?')}
                                                onChange={(e) => {
                                                    if (eventsPageIndex < 0) return;
                                                    handleSectionChange(eventsPageIndex, 'SIDEBAR_QUESTION_TITLE', 'value', e.target.value);
                                                }}
                                                placeholder="SUALINIZ VAR?"
                                            />
                                            <textarea
                                                rows={3}
                                                value={getEventsPageConfigValue('SIDEBAR_QUESTION_DESC', 'YARIŞLA BAĞLI ƏLAVƏ SUALLARINIZ ÜÇÜN BİZİMLƏ ƏLAQƏ SAXLAYIN.')}
                                                onChange={(e) => {
                                                    if (eventsPageIndex < 0) return;
                                                    handleSectionChange(eventsPageIndex, 'SIDEBAR_QUESTION_DESC', 'value', e.target.value);
                                                }}
                                                onKeyDown={(e) => e.stopPropagation()}
                                                placeholder="Kart təsviri"
                                                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', lineHeight: 1.4, resize: 'vertical' }}
                                            />
                                            <input
                                                type="text"
                                                value={getEventsPageConfigValue('BTN_CONTACT', 'ƏLAQƏ')}
                                                onChange={(e) => {
                                                    if (eventsPageIndex < 0) return;
                                                    handleSectionChange(eventsPageIndex, 'BTN_CONTACT', 'value', e.target.value);
                                                }}
                                                placeholder="ƏLAQƏ"
                                            />
                                        </div>
                                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#64748b' }}>
                                            Sağ tərəfdəki “Sualınız var?” kartının başlıq, təsvir və düymə mətnləri.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="editor-empty">
                                <FileText size={48} style={{ opacity: 0.2 }} />
                                <p>Redaktə etmək üçün sol tərəfdən xəbər seçin və ya yeni yaradın.</p>
                            </div>
                        )}
                    </main>
                </div>
            ) : editorMode === 'events' ? (
                <div className="editor-layout with-sidebar">
                    <aside className="page-list">
                        <div className="list-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3>Tədbirlər</h3>
                            <button className="add-section-btn" onClick={addNewEvent}>
                                <Plus size={16} />
                            </button>
                        </div>
                        <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
                            {filteredEvents.length === 0 ? (
                                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem', border: '1px dashed #e2e8f0', borderRadius: '8px' }}>
                                    {searchQuery ? (
                                        <>
                                            <div style={{ marginBottom: '10px' }}>Axtarışa uyğun tədbir tapılmadı.</div>
                                            <button
                                                type="button"
                                                className="btn-secondary"
                                                onClick={() => setSearchTerm('')}
                                                style={{ fontSize: '12px' }}
                                            >
                                                Filtri təmizlə
                                            </button>
                                        </>
                                    ) : (
                                        'Hələ heç bir tədbir yoxdur. Yeni tədbir yaratmaq üçün yuxarıdakı "+" düyməsini basın.'
                                    )}
                                </div>
                            ) : (
                                filteredEvents.map((evt) => (
                                    <div key={evt.id} className="page-nav-wrapper" style={{ position: 'relative', marginBottom: '4px' }}>
                                        <button
                                            className={`page-nav-item ${selectedEventId === evt.id ? 'active' : ''}`}
                                            onClick={() => handleEventSelect(evt.id)}
                                            style={{ width: '100%', paddingRight: '40px', textAlign: 'left' }}
                                        >
                                            <Calendar size={14} /> {getEventLocalizedFieldValue(evt, 'title', 'AZ')}
                                            <div style={{ fontSize: '10px', color: '#999', marginLeft: '24px' }}>{evt.date}</div>
                                        </button>
                                        <button
                                            className="delete-section-btn"
                                            onClick={(e) => deleteEvent(evt.id, e)}
                                            style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#ff4d4f', opacity: 0.5, cursor: 'pointer' }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </aside>

                    <main className="editor-canvas editor-canvas-flat">
                        {selectedEventId !== null && eventForm.id !== undefined ? (
                            <div className="editor-workspace">
                                <div className="canvas-header canvas-header-block">
                                    <h2 style={{ fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <Calendar size={22} /> Tədbiri Redaktə Et
                                    </h2>
                                    <p style={{ color: '#64748b' }}>
                                        {getEventLocalizedFieldValue(eventForm, 'title', eventFormLanguage, true) || 'Yeni Tədbir'} // ID: {eventForm.id}
                                    </p>
                                </div>

                                <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        {EVENT_LANGUAGE_TABS.map((tab) => {
                                            const isActive = eventFormLanguage === tab.code;
                                            return (
                                                <button
                                                    key={tab.code}
                                                    type="button"
                                                    className="btn-secondary"
                                                    onClick={() => setEventFormLanguage(tab.code)}
                                                    style={{
                                                        minWidth: '72px',
                                                        background: isActive ? '#FF4D00' : '#111',
                                                        color: isActive ? '#000' : '#fff',
                                                        border: isActive ? '1px solid #FF4D00' : '1px solid #e2e8f0'
                                                    }}
                                                >
                                                    {tab.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <button
                                        type="button"
                                        className="btn-secondary"
                                        onClick={() => void autoFillEventLanguages(eventFormLanguage, eventForm.id)}
                                        disabled={isAutoTranslatingEvent}
                                        style={{ minWidth: '240px' }}
                                    >
                                        {isAutoTranslatingEvent ? 'Doldurulur...' : 'Digər dilləri avtomatik doldur'}
                                    </button>
                                </div>

                                <div className="edit-grid grid-2">
                                    <div className="form-group">
                                        <label>TƏDBİR ADI ({eventFormLanguage})</label>
                                        <input
                                            type="text"
                                            value={getEventLocalizedFieldValue(eventForm, 'title', eventFormLanguage, false)}
                                            onChange={(e) => handleEventLocalizedChange('title', e.target.value, eventFormLanguage, eventForm.id)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>TARİX</label>
                                        <input
                                            type="date"
                                            value={eventForm.date}
                                            onChange={(e) => handleEventChange('date', e.target.value, eventForm.id)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>MƏKAN ({eventFormLanguage})</label>
                                        <input
                                            type="text"
                                            value={getEventLocalizedFieldValue(eventForm, 'location', eventFormLanguage, false)}
                                            onChange={(e) => handleEventLocalizedChange('location', e.target.value, eventFormLanguage, eventForm.id)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>KATEQORİYA ({eventFormLanguage})</label>
                                        <input
                                            type="text"
                                            value={getEventLocalizedFieldValue(eventForm, 'category', eventFormLanguage, false)}
                                            onChange={(e) => handleEventLocalizedChange('category', e.target.value, eventFormLanguage, eventForm.id)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>VƏZİYYƏT</label>
                                        <select
                                            value={eventForm.status}
                                            onChange={(e) => handleEventChange('status', normalizeEventStatus(e.target.value, eventForm.date), eventForm.id)}
                                        >
                                            <option value="planned">Gələcək</option>
                                            <option value="past">Keçmiş</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>QEYDİYYAT STATUSU</label>
                                        <select
                                            value={eventForm.registrationEnabled === false ? 'inactive' : 'active'}
                                            onChange={(e) => handleEventChange('registrationEnabled', e.target.value === 'active', eventForm.id)}
                                        >
                                            <option value="active">Aktiv (Qeydiyyat Açıq)</option>
                                            <option value="inactive">Deaktiv (Qeydiyyat Bağlı)</option>
                                        </select>
                                    </div>
                                    {eventForm.status === 'past' ? (
                                        <>
                                            <div className="form-group full-span">
                                                <label>COVER ŞƏKİLİ</label>
                                                <div style={{ width: '100%', height: '180px', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f8fafc', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {eventForm.img ? (
                                                        <img src={eventForm.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>Şəkil seçilməyib</span>
                                                    )}
                                                </div>
                                                <div className="input-row">
                                                    <input
                                                        type="text"
                                                        value={eventForm.img}
                                                        onChange={(e) => handleEventChange('img', e.target.value, eventForm.id)}
                                                        placeholder="Cover şəkil URL"
                                                    />
                                                    <input
                                                        type="file"
                                                        id="event-past-img"
                                                        style={{ display: 'none' }}
                                                        onChange={async (e) => {
                                                            const f = e.target.files?.[0];
                                                            if (f) {
                                                                const url = await uploadImage(f);
                                                                if (url) handleEventChange('img', url, eventForm.id);
                                                            }
                                                        }}
                                                    />
                                                    <button type="button" onClick={() => document.getElementById('event-past-img')?.click()} className="btn-secondary">Yüklə</button>
                                                </div>
                                            </div>
                                            <div className="form-group full-span">
                                                <label>YOUTUBE LİNKİ</label>
                                                <input
                                                    type="text"
                                                    value={eventForm.youtubeUrl || ''}
                                                    onChange={(e) => handleEventChange('youtubeUrl', e.target.value, eventForm.id)}
                                                    placeholder="https://www.youtube.com/watch?v=..."
                                                />
                                                <div style={{ marginTop: '8px', fontSize: '12px', color: '#64748b' }}>
                                                    Keçmiş tədbir üçün ad, cover və YouTube linki kifayətdir.
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="form-group full-span">
                                                <label>ŞƏKİL</label>
                                                <div style={{ width: '100%', height: '180px', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f8fafc', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {eventForm.img ? (
                                                        <img src={eventForm.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>Şəkil seçilməyib</span>
                                                    )}
                                                </div>
                                                <div className="input-row">
                                                    <input
                                                        type="text"
                                                        value={eventForm.img}
                                                        onChange={(e) => handleEventChange('img', e.target.value, eventForm.id)}
                                                    />
                                                    <input
                                                        type="file"
                                                        id="event-full-img"
                                                        style={{ display: 'none' }}
                                                        onChange={async (e) => {
                                                            const f = e.target.files?.[0];
                                                            if (f) {
                                                                const url = await uploadImage(f);
                                                                if (url) handleEventChange('img', url, eventForm.id);
                                                            }
                                                        }}
                                                    />
                                                    <button onClick={() => document.getElementById('event-full-img')?.click()} className="btn-secondary">Yüklə</button>
                                                </div>
                                            </div>
                                            <div className="form-group full-span">
                                                <label>TƏSVİR ({eventFormLanguage})</label>
                                                <QuillEditor
                                                    key={`event-full-desc-${eventForm.id}-${eventFormLanguage}`}
                                                    id={`event-full-desc-${eventForm.id}-${eventFormLanguage}`}
                                                    value={bbcodeToHtmlForEditor(getEventLocalizedFieldValue(eventForm, 'description', eventFormLanguage, false))}
                                                    onChange={(val: string) => handleEventLocalizedChange('description', val, eventFormLanguage, eventForm.id)}
                                                />
                                            </div>
                                            <div className="form-group full-span">
                                                <label>PDF URL</label>
                                                <div className="input-row">
                                                    <input
                                                        type="text"
                                                        value={eventForm.pdfUrl || ''}
                                                        onChange={(e) => handleEventChange('pdfUrl', e.target.value, eventForm.id)}
                                                        placeholder="https://.../rules.pdf"
                                                    />
                                                    <input
                                                        type="file"
                                                        id="event-full-pdf"
                                                        accept=".pdf,application/pdf"
                                                        style={{ display: 'none' }}
                                                        onChange={async (e) => {
                                                            const f = e.target.files?.[0];
                                                            if (!f) return;
                                                            if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
                                                                toast.error('Yalnız PDF faylı yüklənə bilər');
                                                                return;
                                                            }
                                                            const url = await uploadAsset(f, {
                                                                loadingText: 'PDF yüklənir...',
                                                                successText: 'PDF uğurla yükləndi',
                                                                errorText: 'PDF yüklənərkən xəta baş verdi'
                                                            });
                                                            if (url) handleEventChange('pdfUrl', url, eventForm.id);
                                                            (e.target as HTMLInputElement).value = '';
                                                        }}
                                                    />
                                                    <button type="button" onClick={() => document.getElementById('event-full-pdf')?.click()} className="btn-secondary">PDF Yüklə</button>
                                                </div>
                                            </div>
                                            <div className="form-group full-span">
                                                <label>QAYDALAR ({eventFormLanguage})</label>
                                                <QuillEditor
                                                    key={`event-full-rules-${eventForm.id}-${eventFormLanguage}`}
                                                    id={`event-full-rules-${eventForm.id}-${eventFormLanguage}`}
                                                    value={bbcodeToHtmlForEditor(getEventLocalizedFieldValue(eventForm, 'rules', eventFormLanguage, false))}
                                                    onChange={(val: string) => handleEventLocalizedChange('rules', val, eventFormLanguage, eventForm.id)}
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="editor-savebar">
                                    <button className="btn-primary" onClick={saveChanges}>Yadda Saxla</button>
                                </div>
                            </div>
                        ) : (
                            <div className="editor-empty">
                                <Calendar size={48} style={{ opacity: 0.2 }} />
                                <p>Redaktə etmək üçün sol tərəfdən tədbir seçin və ya yeni yaradın.</p>
                            </div>
                        )}
                    </main>
                </div>
            ) : editorMode === 'drivers' ? (
                <div className="editor-layout with-sidebar">
                    <aside className="page-list">
                        <div className="list-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3>Kateqoriyalar</h3>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <button className="add-section-btn" onClick={addCategory} title="Kateqoriya əlavə et">
                                    <Plus size={16} />
                                </button>
                                <button className="delete-section-btn" onClick={deleteCategory} title="Seçilmiş kateqoriyanı sil" style={{ background: 'none', border: 'none', color: '#ff4d4f', cursor: 'pointer', padding: '4px' }}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                        <select
                            value={selectedCatId || ''}
                            onChange={(e) => handleCatSelect(e.target.value)}
                            style={{ width: '100%', padding: '10px', marginBottom: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', fontWeight: 'bold' }}
                        >
                            {driverCategories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                        {selectedCatId && (
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                                    Kateqoriya adı
                                </label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="text"
                                        value={driverCategories.find(c => c.id === selectedCatId)?.name || ''}
                                        onChange={(e) => renameCategory(e.target.value)}
                                        placeholder="Kateqoriya adı"
                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', fontWeight: 'bold' }}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="list-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3>Sürücülər</h3>
                            <button className="add-section-btn" onClick={addDriver}>
                                <Plus size={16} />
                            </button>
                        </div>
                        <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 400px)' }}>
                            {selectedCatId && (driverCategories.find(c => c.id === selectedCatId)?.drivers || []).filter((d) =>
                                matchesSearch(d.name, d.license, d.team, d.rank, d.points, d.wins)
                            ).length === 0 ? (
                                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
                                    {searchQuery ? (
                                        <>
                                            <div style={{ marginBottom: '10px' }}>Axtarışa uyğun sürücü tapılmadı.</div>
                                            <button
                                                type="button"
                                                className="btn-secondary"
                                                onClick={() => setSearchTerm('')}
                                                style={{ fontSize: '12px' }}
                                            >
                                                Filtri təmizlə
                                            </button>
                                        </>
                                    ) : (
                                        'Bu kateqoriyada sürücü yoxdur.'
                                    )}
                                </div>
                            ) : (
                                (driverCategories.find(c => c.id === selectedCatId)?.drivers || [])
                                    .filter((d) => matchesSearch(d.name, d.license, d.team, d.rank, d.points, d.wins))
                                    .map((d) => (
                                        <div key={d.id} className="page-nav-wrapper" style={{ position: 'relative', marginBottom: '4px' }}>
                                            <button
                                                className={`page-nav-item ${selectedDriverId === d.id ? 'active' : ''}`}
                                                onClick={() => handleDriverSelect(d.id)}
                                                style={{ width: '100%', paddingRight: '40px', textAlign: 'left' }}
                                            >
                                                <span style={{ fontWeight: '900', color: 'var(--primary)', marginRight: '8px' }}>#{d.rank}</span> {d.name}
                                            </button>
                                            <button
                                                className="delete-section-btn"
                                                onClick={(e) => { e.stopPropagation(); deleteDriver(d.id); }}
                                                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#ff4d4f', opacity: 0.5, cursor: 'pointer' }}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))
                            )}
                        </div>
                    </aside>

                    <main className="editor-canvas editor-canvas-flat">
                        {selectedDriverId !== null && driverForm.id !== undefined ? (
                            <div className="editor-workspace">
                                <div className="canvas-header canvas-header-block">
                                    <h2 style={{ fontSize: '2rem' }}>{driverForm.name}</h2>
                                    <p style={{ color: '#64748b' }}>{driverCategories.find(c => c.id === selectedCatId)?.name} // RANK #{driverForm.rank}</p>
                                </div>

                                <div className="edit-grid grid-2">
                                    <div className="form-group">
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '12px', color: '#64748b' }}>SÜRÜCÜNÜN ADI VƏ SOYADI</label>
                                        <input
                                            type="text"
                                            value={driverForm.name}
                                            onChange={(e) => handleDriverChange('name', e.target.value)}
                                            placeholder="Məs: Əli Məmmədov"
                                            style={{ width: '100%', padding: '14px', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold' }}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '12px', color: '#64748b' }}>YARIŞ SIRALAMASI (RANK)</label>
                                        <input
                                            type="number"
                                            value={driverForm.rank}
                                            readOnly
                                            style={{ width: '100%', padding: '14px', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '16px', background: '#f8fafc', color: '#94a3b8', cursor: 'not-allowed' }}
                                        />
                                        <p style={{ fontSize: '11px', color: '#3b82f6', marginTop: '6px', fontWeight: 'bold' }}>ℹ️ Bu sıra ballara görə avtomatik hesablanır</p>
                                    </div>

                                    <div className="form-group">
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '12px', color: '#64748b' }}>PİLOT LİSENZİYASI</label>
                                        <input
                                            type="text"
                                            value={driverForm.license}
                                            onChange={(e) => handleDriverChange('license', e.target.value)}
                                            placeholder="Məs: A-SİNFİ"
                                            style={{ width: '100%', padding: '14px', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '15px' }}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '12px', color: '#64748b' }}>TƏMSİL ETDİYİ KOMANDA</label>
                                        <input
                                            type="text"
                                            value={driverForm.team}
                                            onChange={(e) => handleDriverChange('team', e.target.value)}
                                            placeholder="Məs: FORSAJ RACING"
                                            style={{ width: '100%', padding: '14px', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '15px' }}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '12px', color: '#64748b' }}>QALİBİYYƏT (WINS)</label>
                                        <input
                                            type="number"
                                            value={driverForm.wins}
                                            onChange={(e) => handleDriverChange('wins', parseInt(e.target.value))}
                                            style={{ width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px' }}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '12px', color: '#64748b' }}>XAL (POINTS)</label>
                                        <input
                                            type="number"
                                            value={driverForm.points}
                                            onChange={(e) => handleDriverChange('points', parseInt(e.target.value))}
                                            style={{ width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px' }}
                                        />
                                    </div>

                                    <div className="form-group full-span">
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '12px', color: '#64748b' }}>PİLOT ŞƏKLİ</label>
                                        <div className="input-row">
                                            <div style={{ width: '80px', height: '80px', borderRadius: '50%', overflow: 'hidden', background: '#f1f5f9', border: '2px solid var(--primary)' }}>
                                                {driverForm.img ? (
                                                    <img src={driverForm.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <ImageIcon size={24} style={{ opacity: 0.2 }} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="input-row" style={{ flex: 1 }}>
                                                <input
                                                    type="text"
                                                    value={driverForm.img || ''}
                                                    onChange={(e) => handleDriverChange('img', e.target.value)}
                                                    placeholder="Şəkil URL və ya yol..."
                                                    style={{ flex: 1, padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px' }}
                                                />
                                                <input
                                                    type="file"
                                                    id="driver-img-upload"
                                                    style={{ display: 'none' }}
                                                    accept="image/*"
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            const url = await uploadImage(file);
                                                            if (url) handleDriverChange('img', url);
                                                        }
                                                    }}
                                                />
                                                <button
                                                    onClick={() => document.getElementById('driver-img-upload')?.click()}
                                                    style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px', cursor: 'pointer' }}
                                                >
                                                    Yüklə
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="editor-savebar">
                                    <button className="btn-primary" onClick={handleDriverSave} disabled={isSaving}>
                                        {isSaving ? 'Gözləyin...' : 'Sürücünü Yadda Saxla'}
                                    </button>
                                    <button
                                        className="btn-secondary"
                                        onClick={handleSendDriversRankingNotification}
                                        disabled={isSendingRankingNotice || isSaving}
                                    >
                                        {isSendingRankingNotice ? 'Göndərilir...' : 'Sıralama Bildirişi Göndər'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="editor-empty">
                                <Trophy size={48} style={{ opacity: 0.2 }} />
                                <p>Redaktə etmək üçün sol tərəfdən sürücü seçin.</p>
                            </div>
                        )}
                    </main>
                </div>
            ) : editorMode === 'videos' ? (
                <div className="editor-layout with-sidebar">
                    <aside className="page-list">
                        <div className="list-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3>Videolar</h3>
                            <button className="add-section-btn" onClick={addNewVideo}>
                                <Plus size={16} />
                            </button>
                        </div>
                        <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
                            {filteredVideos.length === 0 ? (
                                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
                                    {searchQuery ? 'Axtarışa uyğun video tapılmadı.' : 'Heç bir video əlavə edilməyib.'}
                                </div>
                            ) : (
                                filteredVideos.map((v) => (
                                    <div key={v.id} className="page-nav-wrapper" style={{ position: 'relative', marginBottom: '4px' }}>
                                        <button
                                            className={`page-nav-item ${selectedVideoId === v.id ? 'active' : ''}`}
                                            onClick={() => handleVideoSelect(v.id)}
                                            style={{ width: '100%', paddingRight: '40px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}
                                        >
                                            <div style={{ width: '24px', height: '16px', background: '#333', borderRadius: '2px', overflow: 'hidden' }}>
                                                {v.thumbnail && <img src={v.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                            </div>
                                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title}</span>
                                        </button>
                                        <button
                                            className="delete-section-btn"
                                            onClick={(e) => { e.stopPropagation(); deleteVideo(v.id, e); }}
                                            style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#ff4d4f', opacity: 0.5, cursor: 'pointer' }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </aside>

                    <main className="editor-canvas editor-canvas-flat">
                        {selectedVideoId !== null && videoForm.id !== undefined ? (
                            <div className="editor-workspace">
                                <div className="canvas-header canvas-header-block">
                                    <h2 style={{ fontSize: '2rem' }}>Video Redaktəsi</h2>
                                    <p style={{ color: '#64748b' }}>{videoForm.title} // ID: {videoForm.id}</p>
                                </div>

                                <div className="edit-grid grid-1">
                                    <div className="form-group">
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '12px', color: '#64748b' }}>VİDEO BAŞLIĞI</label>
                                        <input
                                            type="text"
                                            value={videoForm.title}
                                            onChange={(e) => handleVideoChange('title', e.target.value)}
                                            style={{ width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold' }}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '12px', color: '#64748b' }}>YOUTUBE URL</label>
                                        <div style={{ position: 'relative' }}>
                                            <Globe size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                            <input
                                                type="text"
                                                value={videoForm.youtubeUrl}
                                                onChange={(e) => handleVideoChange('youtubeUrl', e.target.value)}
                                                placeholder="https://www.youtube.com/watch?v=..."
                                                style={{ width: '100%', padding: '12px 12px 12px 40px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px' }}
                                            />
                                        </div>
                                        <p style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>YouTube linkini daxil etdikdə şəkil və ID avtomatik təyin olunacaq.</p>
                                    </div>

                                    <div className="edit-grid grid-2-compact">
                                        <div className="form-group">
                                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '12px', color: '#64748b' }}>MÜDDƏT (MƏS: 05:20)</label>
                                            <input
                                                type="text"
                                                value={videoForm.duration}
                                                onChange={(e) => handleVideoChange('duration', e.target.value)}
                                                style={{ width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px' }}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '12px', color: '#64748b' }}>VİDEO ID (AVTOMATİK)</label>
                                            <input
                                                type="text"
                                                value={videoForm.videoId}
                                                readOnly
                                                style={{ width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', background: '#f8fafc', color: '#94a3b8' }}
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '12px', color: '#64748b' }}>YARADILMA TARİXİ</label>
                                        <input
                                            type="text"
                                            value={videoForm.created_at || ''}
                                            onChange={(e) => handleVideoChange('created_at', e.target.value)}
                                            placeholder="2026-02-16T10:30:00.000Z"
                                            style={{ width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px' }}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '12px', color: '#64748b' }}>ÖNİZLƏMƏ (THUMBNAIL)</label>
                                        <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: '12px', overflow: 'hidden', background: '#000', border: '1px solid #e2e8f0', position: 'relative' }}>
                                            {videoForm.thumbnail ? (
                                                <img src={videoForm.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
                                                    <Video size={48} style={{ opacity: 0.1, color: 'white' }} />
                                                    <p style={{ color: '#64748b', fontSize: '12px' }}>YouTube linki daxil edin</p>
                                                </div>
                                            )}
                                            {videoForm.videoId && (
                                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', cursor: 'pointer' }} onClick={() => window.open(videoForm.youtubeUrl, '_blank')}>
                                                    <div style={{ background: '#FF4D00', color: 'white', padding: '12px', borderRadius: '50%', boxShadow: '0 0 20px rgba(255,77,0,0.4)' }}>
                                                        <Play size={24} fill="currentColor" />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="editor-savebar">
                                    <button className="btn-primary" onClick={saveChanges} disabled={isSaving}>
                                        {isSaving ? 'Gözləyin...' : 'Yadda Saxla'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="editor-empty">
                                <Video size={48} style={{ opacity: 0.2 }} />
                                <p>Redaktə etmək üçün sol tərəfdən video seçin və ya yeni əlavə edin.</p>
                            </div>
                        )}
                    </main>
                </div>
            ) : editorMode === 'photos' ? (
                <div className="editor-layout with-sidebar">
                    <aside className="page-list">
                        <div className="list-header" style={{ marginBottom: '1rem' }}>
                            <h3 style={{ marginBottom: '0.75rem' }}>Foto Arxiv</h3>
                            <div style={{ display: 'grid', gap: '8px' }}>
                                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>EVENT ALBOMU</label>
                                <select
                                    value={selectedPhotoEventId}
                                    onChange={(e) => handlePhotoAlbumFromEventChange(e.target.value)}
                                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                                >
                                    <option value="">Event seçilməyib</option>
                                    {events.map((event) => (
                                        <option key={event.id} value={String(event.id)}>
                                            {event.title}
                                        </option>
                                    ))}
                                </select>

                                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginTop: '4px' }}>YENİ ALBOM</label>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <input
                                        type="text"
                                        value={newPhotoAlbumName}
                                        onChange={(e) => setNewPhotoAlbumName(e.target.value)}
                                        placeholder="Məs: Bakı Ralli 2026"
                                        style={{ flex: 1, minWidth: 0, padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={createOrSelectPhotoAlbum}
                                        style={{ padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}
                                    >
                                        Seç
                                    </button>
                                </div>

                                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginTop: '4px' }}>ALBOM FİLTRİ</label>
                                <select
                                    value={photoAlbumFilter}
                                    onChange={(e) => setPhotoAlbumFilter(e.target.value)}
                                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                                >
                                    <option value="all">Bütün albomlar</option>
                                    {availablePhotoAlbums.map((album) => (
                                        <option key={album} value={album}>
                                            {album}
                                        </option>
                                    ))}
                                </select>
                                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginTop: '4px' }}>ALBOM ADINI YENİLƏ</label>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <input
                                        type="text"
                                        value={renamePhotoAlbumName}
                                        onChange={(e) => setRenamePhotoAlbumName(e.target.value)}
                                        placeholder="Seçilən albomun yeni adı"
                                        disabled={photoAlbumFilter === 'all'}
                                        style={{
                                            flex: 1,
                                            minWidth: 0,
                                            padding: '8px 10px',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '8px',
                                            fontSize: '12px',
                                            background: photoAlbumFilter === 'all' ? '#f8fafc' : '#fff'
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={renamePhotoAlbumBulk}
                                        disabled={photoAlbumFilter === 'all'}
                                        style={{
                                            padding: '8px 10px',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '8px',
                                            background: photoAlbumFilter === 'all' ? '#f8fafc' : '#fff',
                                            cursor: photoAlbumFilter === 'all' ? 'not-allowed' : 'pointer',
                                            fontSize: '12px',
                                            fontWeight: 700,
                                            color: photoAlbumFilter === 'all' ? '#94a3b8' : '#0f172a'
                                        }}
                                    >
                                        Yenilə
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={deletePhotoAlbumBulk}
                                    disabled={photoAlbumFilter === 'all'}
                                    title={photoAlbumFilter === 'all' ? 'Əvvəlcə konkret albom seçin' : 'Seçilən albomu toplu sil'}
                                    style={{
                                        marginTop: '6px',
                                        width: '100%',
                                        padding: '8px 10px',
                                        border: '1px solid #fecaca',
                                        borderRadius: '8px',
                                        background: photoAlbumFilter === 'all' ? '#f8fafc' : '#fff1f2',
                                        color: photoAlbumFilter === 'all' ? '#94a3b8' : '#b91c1c',
                                        cursor: photoAlbumFilter === 'all' ? 'not-allowed' : 'pointer',
                                        fontSize: '12px',
                                        fontWeight: 700
                                    }}
                                >
                                    Albomu Toplu Sil
                                </button>

                                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                                    <button
                                        className="add-section-btn"
                                        onClick={addGalleryPhoto}
                                        title="Yeni şəkil əlavə et"
                                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                    >
                                        <Plus size={14} />
                                        Yeni
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => galleryMultiUploadInputRef.current?.click()}
                                        style={{ flex: 1, padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}
                                    >
                                        Çoxlu Yüklə
                                    </button>
                                    <input
                                        ref={galleryMultiUploadInputRef}
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        style={{ display: 'none' }}
                                        onChange={handleMultiPhotoUpload}
                                    />
                                </div>
                            </div>
                        </div>
                        <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
                            {filteredPhotos.length === 0 ? (
                                <p style={{ padding: '20px', color: '#94a3b8', textAlign: 'center', fontSize: '13px' }}>
                                    {searchQuery ? 'Axtarışa uyğun şəkil tapılmadı.' : 'Şəkil yoxdur'}
                                </p>
                            ) : (
                                filteredPhotos.map((photo) => (
                                    <div key={photo.id} className="page-nav-wrapper" style={{ position: 'relative', marginBottom: '4px' }}>
                                        <button
                                            className={`page-nav-item ${selectedPhotoId === photo.id ? 'active' : ''}`}
                                            onClick={() => handlePhotoSelect(photo.id)}
                                            style={{ width: '100%', paddingRight: '40px', display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left' }}
                                        >
                                            <div style={{ width: '24px', height: '24px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, background: '#eee' }}>
                                                {photo.url ? <img src={photo.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageIcon size={12} style={{ margin: '6px', opacity: 0.3 }} />}
                                            </div>
                                            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{photo.title}</span>
                                                <span style={{ fontSize: '10px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {normalizePhotoAlbum(photo.album)}
                                                </span>
                                            </div>
                                        </button>
                                        <button
                                            className="delete-section-btn"
                                            onClick={(e) => deleteGalleryPhoto(photo.id, e)}
                                            style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#ff4d4f', opacity: 0.5, cursor: 'pointer' }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </aside>

                    <main className="editor-canvas editor-canvas-flat">
                        {selectedPhotoId !== null && photoForm.id !== undefined ? (
                            <div className="editor-workspace">
                                <div className="canvas-header canvas-header-block">
                                    <h2 style={{ fontSize: '2rem' }}>Şəkil Redaktəsi</h2>
                                    <p style={{ color: '#64748b' }}>{photoForm.title} // ID: {photoForm.id}</p>
                                </div>

                                <div className="edit-grid grid-1">
                                    <div className="form-group">
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '12px', color: '#64748b' }}>ŞƏKİL BAŞLIĞI</label>
                                        <input
                                            type="text"
                                            value={photoForm.title}
                                            onChange={(e) => handlePhotoChange('title', e.target.value)}
                                            style={{ width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold' }}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '12px', color: '#64748b' }}>ALBOM</label>
                                        <input
                                            type="text"
                                            value={photoForm.album || ''}
                                            onChange={(e) => handlePhotoChange('album', e.target.value)}
                                            placeholder="Məs: Bakı Ralli 2026"
                                            style={{ width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px' }}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '12px', color: '#64748b' }}>EVENT BAĞLANTISI (İSTƏYƏ BAĞLI)</label>
                                        <select
                                            value={selectedPhotoEventId}
                                            onChange={(e) => handlePhotoEventLinkChange(e.target.value)}
                                            style={{ width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px' }}
                                        >
                                            <option value="">Event seçilməyib</option>
                                            {events.map((event) => (
                                                <option key={event.id} value={String(event.id)}>
                                                    {event.title}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '12px', color: '#64748b' }}>FOTO</label>
                                        <div style={{ width: '100%', minHeight: '300px', borderRadius: '12px', overflow: 'hidden', background: '#f8fafc', border: '1px dashed #cbd5e1', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
                                            {photoForm.url ? (
                                                <img src={photoForm.url} alt="" style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain' }} />
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
                                                    <ImageIcon size={48} style={{ opacity: 0.1 }} />
                                                    <p style={{ color: '#64748b', fontSize: '12px' }}>Şəkil seçilməyib</p>
                                                </div>
                                            )}
                                            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
                                                <input
                                                    type="file"
                                                    id="gallery-photo-upload"
                                                    style={{ display: 'none' }}
                                                    accept="image/*"
                                                    onChange={handlePhotoUpload}
                                                />
                                                <button
                                                    onClick={() => document.getElementById('gallery-photo-upload')?.click()}
                                                    className="btn-primary"
                                                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                                                >
                                                    <Plus size={18} /> Şəkil Yüklə
                                                </button>
                                                <input
                                                    type="text"
                                                    value={photoForm.url || ''}
                                                    onChange={(e) => handlePhotoChange('url', e.target.value)}
                                                    placeholder="URL və ya yol..."
                                                    style={{ padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', width: '250px' }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="editor-savebar">
                                    <button className="btn-primary" onClick={saveChanges} disabled={isSaving}>
                                        {isSaving ? 'Gözləyin...' : 'Yadda Saxla'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="editor-empty">
                                <ImageIcon size={48} style={{ opacity: 0.2 }} />
                                <p>Redaktə etmək üçün sol tərəfdən şəkil seçin və ya yeni əlavə edin.</p>
                            </div>
                        )}
                    </main>
                </div>
            ) : (
                <div className="editor-layout">
                    <main className="editor-canvas" style={{ width: '100%' }}>
                        {isGroupedTabView ? (
                            <div className="edit-fields" style={{ width: '100%' }}>
                                {isHomeGroupedView && (
                                    <div className="canvas-header">
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                                            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                                                Ana Səhifə Blokları
                                            </h2>
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                {HOME_EDIT_TABS.map((tab) => (
                                                    <button
                                                        key={tab.id}
                                                        type="button"
                                                        className={`mode-btn ${homeEditTab === tab.id ? 'active' : ''}`}
                                                        onClick={() => setHomeEditTab(tab.id)}
                                                        style={{ minWidth: '120px' }}
                                                    >
                                                        {tab.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {pageParam === 'abouttab' && (
                                    <div className="canvas-header">
                                        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                                            HAQQIMIZDA
                                        </h2>
                                    </div>
                                )}
                                {groupedPagesToRender.length === 0 && (
                                    <div className="empty-fields-tip" style={{ textAlign: 'center', padding: '1rem', border: '1px dashed #cbd5e1', borderRadius: '10px', color: '#64748b' }}>
                                        Seçilən sekmədə göstəriləcək məzmun tapılmadı.
                                    </div>
                                )}
                                {groupedPagesToRender.map(({ page, pageIdx }) => {
                                    const isMarqueePage = page.id === 'marquee';
                                    const isMarqueeCollapsed = isMarqueePage && Boolean(groupedPageCollapsed[page.id]);
                                    const pageSections = (page.sections || [])
                                        .filter((section) => {
                                            if (!isSectionVisibleInAdmin(section) || shouldSkipSectionInEditor(section)) return false;
                                            if (page.id === 'about' && isStatSectionId(section.id)) return false;
                                            if (page.id === 'partners') return false;
                                            if (page.id === 'rulespage' && RULE_TAB_SECTION_REGEX.test(section.id)) return false;
                                            if (page.id === 'rulespage' && section.id.startsWith('RULES_')) return false;
                                            if (page.id === 'rulespage' && section.id === 'BTN_DOWNLOAD_PDF') return false;
                                            return matchesSearch(section.id, section.label, section.value, section.url);
                                        })
                                        .sort((a, b) => normalizeOrder(a.order, 0) - normalizeOrder(b.order, 0));
                                    const pageImages = (page.images || [])
                                        .filter((img) => matchesSearch(img.id, img.alt, img.path))
                                        .sort((a, b) => normalizeOrder(a.order, 0) - normalizeOrder(b.order, 0));
                                    const pageAboutStats = page.id === 'about'
                                        ? (() => {
                                            const statsMap = new Map<string, { label: string; value: string }>();
                                            (page.sections || []).forEach((section) => {
                                                if (!isStatSectionId(section.id)) return;
                                                const suffix = getStatSuffix(section.id) || section.id;
                                                const current = statsMap.get(suffix) || { label: '', value: '' };
                                                if (section.id.startsWith(STAT_LABEL_PREFIX)) current.label = section.value || '';
                                                if (section.id.startsWith(STAT_VALUE_PREFIX)) current.value = section.value || '';
                                                statsMap.set(suffix, current);
                                            });
                                            return Array.from(statsMap.entries())
                                                .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
                                                .map(([suffix, data]) => ({ suffix, ...data }))
                                                .filter((row) => matchesSearch(row.suffix, row.label, row.value));
                                        })()
                                        : [];
                                    const pageRuleTabs = page.id === 'rulespage'
                                        ? getRulesTabRows(page).filter((row) =>
                                            matchesSearch(
                                                row.id,
                                                row.title,
                                                row.icon,
                                                ...(row.items || []).flatMap((item) => [item.title, item.desc])
                                            )
                                        )
                                        : [];
                                    const pagePartnerRows = page.id === 'partners'
                                        ? getPartnerRows(page).filter((row) => {
                                            const imageId = normalizePartnerImageId(row);
                                            const imageAsset = (page.images || []).find((img) => img.id === imageId);
                                            return matchesSearch(
                                                row.index,
                                                row.name,
                                                row.tag,
                                                row.icon,
                                                row.useImage,
                                                row.imageId,
                                                imageAsset?.path,
                                                imageAsset?.alt
                                            );
                                        })
                                        : [];

                                    if (searchQuery && pageSections.length === 0 && pageImages.length === 0 && pageAboutStats.length === 0 && pageRuleTabs.length === 0 && pagePartnerRows.length === 0) {
                                        return null;
                                    }

                                    return (
                                        <div key={page.id} className="field-group">
                                            <div className="canvas-header">
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                                                        {componentLabels[page.id] || page.title}
                                                    </h2>
                                                    {getPageEditHint(page.id) && (
                                                        <p className="page-help-note">{getPageEditHint(page.id)}</p>
                                                    )}
                                                </div>
                                            </div>

                                            {isMarqueePage && (
                                                <div className="marquee-control-panel">
                                                    <div className="marquee-control-item">
                                                        <div className="marquee-control-copy">
                                                            <div className="marquee-control-title">Marquee aktivdir</div>
                                                            <div className="marquee-control-desc">Frontenddə sürüşən yazı göstərilsin</div>
                                                        </div>
                                                        <label className="marquee-switch" aria-label="Marquee aktivdir">
                                                            <input
                                                                type="checkbox"
                                                                checked={page.active !== false}
                                                                onChange={(e) => {
                                                                    const newPages = [...pages];
                                                                    if (!newPages[pageIdx]) return;
                                                                    newPages[pageIdx].active = e.target.checked;
                                                                    setPages(newPages);
                                                                }}
                                                            />
                                                            <span className="marquee-switch-slider" />
                                                        </label>
                                                    </div>
                                                    <div className="marquee-control-item">
                                                        <div className="marquee-control-copy">
                                                            <div className="marquee-control-title">Paneldə gizlə</div>
                                                            <div className="marquee-control-desc">Bu kartı editorda daralt və yadda saxla</div>
                                                        </div>
                                                        <label className="marquee-switch" aria-label="Paneldə gizlə">
                                                            <input
                                                                type="checkbox"
                                                                checked={isMarqueeCollapsed}
                                                                onChange={(e) => {
                                                                    setGroupedPageCollapsed((prev) => ({ ...prev, [page.id]: e.target.checked }));
                                                                }}
                                                            />
                                                            <span className="marquee-switch-slider" />
                                                        </label>
                                                    </div>
                                                </div>
                                            )}

                                            {(page.id !== 'marquee' || !isMarqueeCollapsed) && (
                                                <>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                                                        {page.id === 'about' && (
                                                            <div className="field-item-wrapper" style={{ position: 'relative', background: '#fcfcfd', padding: '1rem', borderRadius: '12px', border: '1px solid #f0f0f2' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 800 }}>
                                                                        Statistikalar
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        className="add-field-minimal"
                                                                        onClick={() => addAboutStatRow(pageIdx)}
                                                                    >
                                                                        <Plus size={14} /> Yeni Statistika
                                                                    </button>
                                                                </div>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                    {pageAboutStats.map((row) => (
                                                                        <div key={row.suffix} style={{ display: 'grid', gridTemplateColumns: '1fr 180px auto', gap: '8px', alignItems: 'center' }}>
                                                                            <input
                                                                                type="text"
                                                                                value={row.label}
                                                                                onChange={(e) => updateAboutStatField(row.suffix, 'label', e.target.value, pageIdx)}
                                                                                placeholder="Statistika adı"
                                                                                style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: 700 }}
                                                                            />
                                                                            <input
                                                                                type="text"
                                                                                value={row.value}
                                                                                onChange={(e) => updateAboutStatField(row.suffix, 'value', e.target.value, pageIdx)}
                                                                                placeholder="Dəyər"
                                                                                style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: 700 }}
                                                                            />
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => removeAboutStatRow(row.suffix, pageIdx)}
                                                                                style={{ background: '#fff', border: '1px solid #fee2e2', color: '#ef4444', borderRadius: '8px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                                                            >
                                                                                <Trash2 size={14} />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {page.id === 'rulespage' && (
                                                            <div className="field-item-wrapper" style={{ position: 'relative', background: '#fcfcfd', padding: '1rem', borderRadius: '12px', border: '1px solid #f0f0f2' }}>
                                                                {(() => {
                                                                    const pdfState = getRulesGeneralPdfState(page);
                                                                    const uploadInputId = `rules-global-doc-upload-${pageIdx}`;
                                                                    return (
                                                                        <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px', background: '#fff', marginBottom: '10px' }}>
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                                                <div style={{ fontSize: '12px', color: '#334155', fontWeight: 800, textTransform: 'uppercase' }}>
                                                                                    Ümumi Təlimat PDF
                                                                                </div>
                                                                                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>
                                                                                    {pdfState.fileName || 'PDF faylı seçilməyib'}
                                                                                </div>
                                                                            </div>
                                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: '8px', marginBottom: '8px' }}>
                                                                                <input
                                                                                    type="text"
                                                                                    value={pdfState.url}
                                                                                    onChange={(e) => updateRulesGeneralPdf({ url: e.target.value }, pageIdx)}
                                                                                    placeholder="Ümumi sənəd linki (Məs: /uploads/rules.pdf və ya https://...)"
                                                                                    style={{ padding: '9px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                                                                                />
                                                                                <input
                                                                                    type="text"
                                                                                    value={pdfState.buttonText}
                                                                                    onChange={(e) => updateRulesGeneralPdf({ buttonText: e.target.value }, pageIdx)}
                                                                                    placeholder="Düymə mətni (Məs: PDF YÜKLƏ)"
                                                                                    style={{ padding: '9px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                                                                                />
                                                                            </div>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                <input
                                                                                    id={uploadInputId}
                                                                                    type="file"
                                                                                    accept=".pdf,application/pdf"
                                                                                    ref={(node) => {
                                                                                        rulesPdfInputRefs.current[uploadInputId] = node;
                                                                                    }}
                                                                                    style={{ display: 'none' }}
                                                                                    onChange={async (e) => {
                                                                                        const f = e.target.files?.[0];
                                                                                        if (!f) return;
                                                                                        await handleRulesGeneralPdfUpload(f, pageIdx);
                                                                                        e.target.value = '';
                                                                                    }}
                                                                                />
                                                                                <button
                                                                                    type="button"
                                                                                    className="btn-secondary"
                                                                                    onClick={() => rulesPdfInputRefs.current[uploadInputId]?.click()}
                                                                                >
                                                                                    PDF Yüklə
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })()}
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 800 }}>
                                                                        Qaydalar Sekmələri
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        className="add-field-minimal"
                                                                        onClick={() => addRulesTab(pageIdx)}
                                                                    >
                                                                        <Plus size={14} /> Yeni Sekmə
                                                                    </button>
                                                                </div>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                                    {pageRuleTabs.map((row, rowIndex) => {
                                                                        const canMoveUp = rowIndex > 0;
                                                                        const canMoveDown = rowIndex < pageRuleTabs.length - 1;
                                                                        return (
                                                                            <div key={`rules-tab-group-${row.index}-${row.id}`} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px', background: '#fff' }}>
                                                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 160px auto', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                                                                                    <input
                                                                                        type="text"
                                                                                        value={row.title}
                                                                                        onChange={(e) => updateRulesTabField(rowIndex, 'title', e.target.value, pageIdx)}
                                                                                        placeholder="Sekmə başlığı"
                                                                                        style={{ padding: '9px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', fontWeight: 700 }}
                                                                                    />
                                                                                    <input
                                                                                        type="text"
                                                                                        value={row.id}
                                                                                        onChange={(e) => updateRulesTabField(rowIndex, 'id', e.target.value, pageIdx)}
                                                                                        placeholder="Sekmə ID"
                                                                                        style={{ padding: '9px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                                                                                    />
                                                                                    <select
                                                                                        value={row.icon}
                                                                                        onChange={(e) => updateRulesTabField(rowIndex, 'icon', e.target.value, pageIdx)}
                                                                                        style={{ padding: '9px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                                                                                    >
                                                                                        {RULE_TAB_ICON_PRESETS.map((opt) => (
                                                                                            <option key={opt} value={opt}>{opt}</option>
                                                                                        ))}
                                                                                    </select>
                                                                                    <div style={{ display: 'flex', gap: '6px' }}>
                                                                                        <button
                                                                                            type="button"
                                                                                            title="Yuxarı"
                                                                                            onClick={() => moveRulesTab(rowIndex, 'up', pageIdx)}
                                                                                            disabled={!canMoveUp}
                                                                                            style={{ width: '30px', height: '30px', border: '1px solid #e2e8f0', background: '#fff', borderRadius: '8px', color: canMoveUp ? '#334155' : '#cbd5e1' }}
                                                                                        >
                                                                                            <ChevronUp size={14} />
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            title="Aşağı"
                                                                                            onClick={() => moveRulesTab(rowIndex, 'down', pageIdx)}
                                                                                            disabled={!canMoveDown}
                                                                                            style={{ width: '30px', height: '30px', border: '1px solid #e2e8f0', background: '#fff', borderRadius: '8px', color: canMoveDown ? '#334155' : '#cbd5e1' }}
                                                                                        >
                                                                                            <ChevronDown size={14} />
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            title="Sekməni sil"
                                                                                            onClick={() => removeRulesTab(rowIndex, pageIdx)}
                                                                                            style={{ width: '30px', height: '30px', border: '1px solid #fee2e2', background: '#fff', borderRadius: '8px', color: '#ef4444' }}
                                                                                        >
                                                                                            <Trash2 size={14} />
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                                    {(row.items || []).map((item, itemIndex) => (
                                                                                        <div key={`rules-tab-item-group-${row.index}-${item.index}`} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px' }}>
                                                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', marginBottom: '8px' }}>
                                                                                                <input
                                                                                                    type="text"
                                                                                                    value={item.title}
                                                                                                    onChange={(e) => updateRulesTabItemField(rowIndex, itemIndex, 'title', e.target.value, pageIdx)}
                                                                                                    placeholder="Maddə başlığı"
                                                                                                    style={{ padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', fontWeight: 700 }}
                                                                                                />
                                                                                                <button
                                                                                                    type="button"
                                                                                                    title="Maddəni sil"
                                                                                                    onClick={() => removeRulesTabItem(rowIndex, itemIndex, pageIdx)}
                                                                                                    style={{ width: '30px', height: '30px', border: '1px solid #fee2e2', background: '#fff', borderRadius: '8px', color: '#ef4444' }}
                                                                                                >
                                                                                                    <Trash2 size={14} />
                                                                                                </button>
                                                                                            </div>
                                                                                            <textarea
                                                                                                rows={3}
                                                                                                value={item.desc}
                                                                                                onChange={(e) => updateRulesTabItemField(rowIndex, itemIndex, 'desc', e.target.value, pageIdx)}
                                                                                                onKeyDown={(e) => e.stopPropagation()}
                                                                                                placeholder="Maddə təsviri"
                                                                                                style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', lineHeight: 1.4, resize: 'vertical' }}
                                                                                            />
                                                                                        </div>
                                                                                    ))}
                                                                                    <button
                                                                                        type="button"
                                                                                        className="add-field-minimal"
                                                                                        onClick={() => addRulesTabItem(rowIndex, pageIdx)}
                                                                                    >
                                                                                        <Plus size={14} /> Maddə Əlavə Et
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {page.id === 'partners' && renderPartnersEditor(page, pageIdx)}

                                                        {pageSections.map((section, visibleIndex) =>
                                                            renderTextSectionCard(section, visibleIndex, pageIdx, page)
                                                        )}
                                                    </div>

                                                    {page.id !== 'partners' && (
                                                        <div style={{ marginTop: '1rem' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>
                                                                    Şəkillər
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    className="add-field-minimal"
                                                                    onClick={() => {
                                                                        const newPages = [...pages];
                                                                        const target = newPages[pageIdx];
                                                                        if (!target) return;
                                                                        target.images.push({
                                                                            id: `img-${target.images.length}-${Date.now()}`,
                                                                            path: '',
                                                                            alt: '',
                                                                            type: 'local',
                                                                            order: target.images.length
                                                                        });
                                                                        setPages(newPages);
                                                                    }}
                                                                >
                                                                    <Plus size={14} /> Yeni Şəkil
                                                                </button>
                                                            </div>
                                                            <div className="images-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
                                                                {pageImages.length === 0 && (
                                                                    <div className="empty-fields-tip" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '1rem', border: '1px dashed #cbd5e1', borderRadius: '10px', color: '#64748b' }}>
                                                                        Bu bölmədə şəkil yoxdur.
                                                                    </div>
                                                                )}
                                                                {pageImages.map((img) => (
                                                                    <div key={`${page.id}-${img.id}`} className="image-edit-card" style={{ border: '1px solid #eee', borderRadius: '12px', padding: '0.75rem', background: '#fff' }}>
                                                                        <div style={{ height: '120px', background: '#f8fafc', borderRadius: '8px', marginBottom: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                            {img.path ? (
                                                                                <img src={img.path} alt={img.alt || img.id} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                            ) : (
                                                                                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Önizləmə yoxdur</span>
                                                                            )}
                                                                        </div>
                                                                        <input
                                                                            type="text"
                                                                            value={img.path}
                                                                            placeholder="Tam şəkil linki"
                                                                            onChange={(e) => {
                                                                                const newPages = [...pages];
                                                                                const target = newPages[pageIdx];
                                                                                if (!target) return;
                                                                                const idx = target.images.findIndex((i) => i.id === img.id);
                                                                                if (idx === -1) return;
                                                                                target.images[idx].path = e.target.value;
                                                                                setPages(newPages);
                                                                            }}
                                                                            style={{ width: '100%', fontSize: '12px', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', marginBottom: '8px' }}
                                                                        />
                                                                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                                                            <input
                                                                                id={`group-file-up-${page.id}-${img.id}`}
                                                                                type="file"
                                                                                accept="image/*"
                                                                                style={{ display: 'none' }}
                                                                                onChange={async (e) => {
                                                                                    const f = e.target.files?.[0];
                                                                                    if (!f) return;
                                                                                    const url = await uploadImage(f);
                                                                                    if (!url) return;
                                                                                    const newPages = [...pages];
                                                                                    const target = newPages[pageIdx];
                                                                                    if (!target) return;
                                                                                    const idx = target.images.findIndex((i) => i.id === img.id);
                                                                                    if (idx === -1) return;
                                                                                    target.images[idx].path = url;
                                                                                    target.images[idx].type = 'local';
                                                                                    setPages(newPages);
                                                                                }}
                                                                            />
                                                                            <button
                                                                                type="button"
                                                                                className="btn-secondary"
                                                                                onClick={() => document.getElementById(`group-file-up-${page.id}-${img.id}`)?.click()}
                                                                                style={{ fontSize: '11px', padding: '6px 10px' }}
                                                                            >
                                                                                Fayldan yüklə
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                className="btn-secondary"
                                                                                onClick={() => openImageSelector(pageIdx, img.id)}
                                                                                style={{ fontSize: '11px', padding: '6px 10px' }}
                                                                            >
                                                                                Kitabxanadan seç
                                                                            </button>
                                                                        </div>
                                                                        <input
                                                                            type="text"
                                                                            value={img.alt}
                                                                            placeholder="Alt mətni"
                                                                            onChange={(e) => handleImageAltChange(pageIdx, img.id, e.target.value)}
                                                                            style={{ width: '100%', fontSize: '12px', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '6px' }}
                                                                        />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            )}

                                            {isMarqueeCollapsed && (
                                                <div className="empty-fields-tip" style={{ textAlign: 'center', padding: '1rem', border: '1px dashed #cbd5e1', borderRadius: '10px', color: '#64748b' }}>
                                                    Marquee bölməsi paneldə gizlədildi. Yuxarıdakı checkbox ilə geri aça bilərsiniz.
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : currentPage ? (
                            <>
                                <div className="canvas-header">
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                                            {componentLabels[currentPage.id] || currentPage.title}
                                        </h2>
                                        {getPageEditHint(currentPage.id) && (
                                            <p className="page-help-note">{getPageEditHint(currentPage.id)}</p>
                                        )}
                                    </div>
                                    <div className="canvas-actions">
                                        {currentPage.id === 'about' && (
                                            <button className="add-field-minimal" onClick={() => addAboutStatRow()} style={{ background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe' }}>
                                                <Trophy size={14} /> Statistika Əlavə Et
                                            </button>
                                        )}
                                        {(currentPage.id === 'about' || currentPage.id === 'values') && (
                                            <button className="add-field-minimal" onClick={() => addCoreValueRow()} style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>
                                                <Plus size={14} /> Yeni Dəyər Əlavə Et
                                            </button>
                                        )}
                                        <div style={{ width: '1px', height: '24px', background: '#e2e8f0', margin: '0 4px' }}></div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '4px 12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b' }}>VƏZİYYƏT:</span>
                                            <button
                                                onClick={() => {
                                                    const newPages = [...pages];
                                                    newPages[selectedPageIndex].active = currentPage?.active === false ? true : false;
                                                    setPages(newPages);
                                                    toast.success(newPages[selectedPageIndex].active ? 'Bölmə aktivləşdirildi' : 'Bölmə deaktiv edildi');
                                                }}
                                                style={{
                                                    width: '36px',
                                                    height: '18px',
                                                    borderRadius: '9px',
                                                    background: currentPage?.active !== false ? '#10b981' : '#cbd5e1',
                                                    position: 'relative',
                                                    cursor: 'pointer',
                                                    border: 'none',
                                                    transition: 'background 0.3s'
                                                }}
                                            >
                                                <div style={{
                                                    width: '14px',
                                                    height: '14px',
                                                    borderRadius: '50%',
                                                    background: 'white',
                                                    position: 'absolute',
                                                    top: '2px',
                                                    left: currentPage?.active !== false ? '20px' : '2px',
                                                    transition: 'left 0.3s'
                                                }} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="edit-fields">
                                    {currentPage.id === 'contactpage' && (
                                        <div className="field-group">
                                            <div className="field-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <label><List size={16} /> Müraciət İstiqaməti Seçimləri</label>
                                                <button className="add-field-minimal" onClick={() => addContactTopicOption()}>
                                                    <Plus size={14} /> Yeni Seçim
                                                </button>
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>
                                                Bu seçimlər əlaqə formundakı dropdown içində göstərilir.
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                {contactTopicOptionRows.length > 0 ? (
                                                    contactTopicOptionRows.map((row) => (
                                                        <div
                                                            key={`contact-topic-option-${row.id}`}
                                                            style={{
                                                                display: 'grid',
                                                                gridTemplateColumns: 'auto 1fr auto',
                                                                gap: '10px',
                                                                alignItems: 'center',
                                                                padding: '10px',
                                                                border: '1px solid #e2e8f0',
                                                                borderRadius: '10px',
                                                                background: '#fff'
                                                            }}
                                                        >
                                                            <div style={{
                                                                fontSize: '11px',
                                                                fontWeight: 800,
                                                                color: '#475569',
                                                                background: '#f8fafc',
                                                                border: '1px solid #e2e8f0',
                                                                borderRadius: '8px',
                                                                padding: '6px 10px',
                                                                whiteSpace: 'nowrap'
                                                            }}>
                                                                Seçim {row.optionNumber}
                                                            </div>
                                                            <input
                                                                type="text"
                                                                value={row.value}
                                                                onChange={(e) => updateContactTopicOptionValue(row.id, row.optionNumber, e.target.value)}
                                                                placeholder={`Seçim ${row.optionNumber}`}
                                                                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: 700 }}
                                                            />
                                                            <button
                                                                type="button"
                                                                className="delete-section-btn"
                                                                onClick={() => removeContactTopicOption(row.id)}
                                                                disabled={contactTopicOptionRows.length <= 1}
                                                                title={contactTopicOptionRows.length <= 1 ? 'Ən azı bir seçim qalmalıdır' : 'Seçimi sil'}
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div style={{ padding: '1rem', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#64748b', fontSize: '13px' }}>
                                                        Axtarışa uyğun seçim tapılmadı.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {LEGAL_PAGE_IDS.has(currentPage.id) && (
                                        <div className="field-group">
                                            <div className="field-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <label><List size={16} /> Bölmə Maddələri</label>
                                                <button className="add-field-minimal" onClick={() => addLegalSectionPair()}>
                                                    <Plus size={14} /> Bölmə Əlavə Et
                                                </button>
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>
                                                Privacy Policy və Terms of Service səhifələrindəki kart bölmələrini buradan əlavə edin, redaktə edin və silin.
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {legalSectionRows.length > 0 ? (
                                                    legalSectionRows.map((row) => {
                                                        const selectedIconToken = String(row.iconSection?.value || '').trim();
                                                        const selectedIconKey = LEGAL_SECTION_ICON_PRESETS.find((token) => token.toLowerCase() === selectedIconToken.toLowerCase()) || '';
                                                        const SelectedLegalIcon = selectedIconKey ? LEGAL_SECTION_ICON_COMPONENTS[selectedIconKey] : null;

                                                        return (
                                                            <div
                                                                key={`legal-section-row-${row.sectionNo}`}
                                                                ref={(el) => {
                                                                    legalSectionCardRefs.current[row.sectionNo] = el;
                                                                }}
                                                                style={{
                                                                    border: '1px solid #e2e8f0',
                                                                    borderRadius: '12px',
                                                                    background: '#fff',
                                                                    padding: '12px'
                                                                }}
                                                            >
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                                                    <div style={{
                                                                        fontSize: '11px',
                                                                        fontWeight: 900,
                                                                        color: '#475569',
                                                                        background: '#f8fafc',
                                                                        border: '1px solid #e2e8f0',
                                                                        borderRadius: '8px',
                                                                        padding: '6px 10px',
                                                                        textTransform: 'uppercase',
                                                                        letterSpacing: '0.04em'
                                                                    }}>
                                                                        Bölmə {row.sectionNo}
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        className="delete-section-btn"
                                                                        onClick={() => removeLegalSectionPair(row.sectionNo)}
                                                                        disabled={legalSectionRows.length <= 1}
                                                                        title={legalSectionRows.length <= 1 ? 'Ən azı bir bölmə qalmalıdır' : 'Bölməni sil'}
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                                    <div>
                                                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#64748b', marginBottom: '6px' }}>
                                                                            Başlıq
                                                                        </label>
                                                                        <input
                                                                            type="text"
                                                                            value={row.titleSection?.value || ''}
                                                                            onChange={(e) => updateLegalSectionFieldValue(row.sectionNo, 'TITLE', e.target.value)}
                                                                            placeholder={`${row.sectionNo}. Bölmə başlığı`}
                                                                            style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: 700 }}
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#64748b', marginBottom: '6px' }}>
                                                                            İkon (opsional)
                                                                        </label>
                                                                        <details className="legal-icon-dropdown">
                                                                            <summary className="legal-icon-dropdown-summary">
                                                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                                                                    <span className="legal-icon-preview-box">
                                                                                        {SelectedLegalIcon ? <SelectedLegalIcon size={14} /> : <X size={12} />}
                                                                                    </span>
                                                                                    <span>{selectedIconKey || 'İkon yoxdur'}</span>
                                                                                </span>
                                                                                <ChevronDown size={14} />
                                                                            </summary>
                                                                            <div className="legal-icon-dropdown-menu">
                                                                                {LEGAL_SECTION_ICON_PRESETS.map((token) => {
                                                                                    const IconComponent = token ? LEGAL_SECTION_ICON_COMPONENTS[token] : null;
                                                                                    const isActive = token.toLowerCase() === selectedIconKey.toLowerCase();
                                                                                    return (
                                                                                        <button
                                                                                            key={`legal-icon-option-${row.sectionNo}-${token || 'none'}`}
                                                                                            type="button"
                                                                                            className={`legal-icon-option ${isActive ? 'active' : ''}`}
                                                                                            onClick={(e) => {
                                                                                                const details = (e.currentTarget.closest('details') as HTMLDetailsElement | null);
                                                                                                updateLegalSectionFieldValue(row.sectionNo, 'ICON', token);
                                                                                                if (details) details.open = false;
                                                                                            }}
                                                                                        >
                                                                                            <span className="legal-icon-preview-box">
                                                                                                {IconComponent ? <IconComponent size={14} /> : <X size={12} />}
                                                                                            </span>
                                                                                            <span>{token || 'İkon yoxdur'}</span>
                                                                                        </button>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </details>
                                                                    </div>
                                                                    <div>
                                                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#64748b', marginBottom: '6px' }}>
                                                                            Mətn
                                                                        </label>
                                                                        <textarea
                                                                            rows={5}
                                                                            value={row.bodySection?.value || ''}
                                                                            onChange={(e) => updateLegalSectionFieldValue(row.sectionNo, 'BODY', e.target.value)}
                                                                            onKeyDown={(e) => e.stopPropagation()}
                                                                            placeholder="Bölmə mətni"
                                                                            style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', lineHeight: 1.45, resize: 'vertical' }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div style={{ padding: '1rem', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#64748b', fontSize: '13px' }}>
                                                        Axtarışa uyğun bölmə tapılmadı.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {currentPage.id === 'about' && (
                                        <div className="field-group">
                                            <div className="field-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <label><Trophy size={16} /> Statistikalar</label>
                                                <button className="add-field-minimal" onClick={() => addAboutStatRow()}>
                                                    <Plus size={14} /> Yeni Statistika
                                                </button>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                {aboutStats.length > 0 ? (
                                                    aboutStats.map((row) => (
                                                        <div key={row.suffix} style={{ display: 'grid', gridTemplateColumns: '1fr 180px auto', gap: '8px', alignItems: 'center', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '10px', background: '#fff' }}>
                                                            <input
                                                                type="text"
                                                                value={row.label}
                                                                onChange={(e) => updateAboutStatField(row.suffix, 'label', e.target.value)}
                                                                placeholder="Statistika adı (Məs: PİLOTLAR)"
                                                                style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: 700 }}
                                                            />
                                                            <input
                                                                type="text"
                                                                value={row.value}
                                                                onChange={(e) => updateAboutStatField(row.suffix, 'value', e.target.value)}
                                                                placeholder="Dəyər (Məs: 140+)"
                                                                style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: 700 }}
                                                            />
                                                            <button
                                                                onClick={() => removeAboutStatRow(row.suffix)}
                                                                title="Statistikanı sil"
                                                                style={{ background: '#fff', border: '1px solid #fee2e2', color: '#ef4444', borderRadius: '8px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div style={{ padding: '1rem', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#64748b', fontSize: '13px' }}>
                                                        {searchTerm ? 'Axtarışa uyğun statistika tapılmadı.' : 'Hələ statistika yoxdur. "Yeni Statistika" ilə əlavə edin.'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {(currentPage.id === 'about' || currentPage.id === 'values') && (
                                        <div className="field-group">
                                            <div className="field-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <label><Shield size={16} /> Əsas Dəyərlər</label>
                                                <button className="add-field-minimal" onClick={() => addCoreValueRow(selectedPageIndex)}>
                                                    <Plus size={14} /> Yeni Dəyər
                                                </button>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                {coreValueRows.length > 0 ? (
                                                    coreValueRows.map((row) => (
                                                        <div key={`core-value-${row.suffix}`} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', background: '#fff', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                                                                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>
                                                                    Dəyər ID: {row.suffix}
                                                                </div>
                                                                <button
                                                                    title="Dəyəri sil"
                                                                    onClick={() => removeCoreValueRow(row.suffix, selectedPageIndex)}
                                                                    style={{ background: '#fff', border: '1px solid #fee2e2', color: '#ef4444', borderRadius: '8px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>

                                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(54px, 1fr))', gap: '8px' }}>
                                                                {CORE_VALUE_ICON_PRESETS.map((opt) => {
                                                                    const IconComponent = CORE_VALUE_ICON_COMPONENTS[opt];
                                                                    const selected = row.icon === opt;
                                                                    return (
                                                                    <button
                                                                        key={`core-${row.suffix}-${opt}`}
                                                                        type="button"
                                                                        title={opt}
                                                                        onClick={() => updateCoreValueField(row.suffix, 'icon', opt, selectedPageIndex)}
                                                                            style={{
                                                                                height: '44px',
                                                                                border: selected ? '1px solid #f97316' : '1px solid #e2e8f0',
                                                                                borderRadius: '10px',
                                                                                background: selected ? '#fff7ed' : '#fff',
                                                                                color: selected ? '#ea580c' : '#475569',
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'center',
                                                                                cursor: 'pointer'
                                                                            }}
                                                                        >
                                                                            <IconComponent size={18} />
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>

                                                            <input
                                                                type="text"
                                                                value={row.title}
                                                                onChange={(e) => updateCoreValueField(row.suffix, 'title', e.target.value, selectedPageIndex)}
                                                                placeholder="Dəyər başlığı (Məs: TƏHLÜKƏSİZLİK)"
                                                                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: 700 }}
                                                            />
                                                            <textarea
                                                                rows={3}
                                                                value={row.desc}
                                                                onChange={(e) => updateCoreValueField(row.suffix, 'desc', e.target.value, selectedPageIndex)}
                                                                onKeyDown={(e) => e.stopPropagation()}
                                                                placeholder="Dəyər təsviri"
                                                                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', lineHeight: 1.4, resize: 'vertical' }}
                                                            />
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div style={{ padding: '1rem', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#64748b', fontSize: '13px' }}>
                                                        {searchTerm ? 'Axtarışa uyğun dəyər tapılmadı.' : 'Hələ dəyər yoxdur. "Yeni Dəyər" ilə əlavə edin.'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {currentPage.id === 'partners' && renderPartnersEditor(currentPage, selectedPageIndex)}

                                    {currentPage.id === 'rulespage' && (
                                        <div className="field-group">
                                            {(() => {
                                                const pdfState = getRulesGeneralPdfState(currentPage);
                                                const uploadInputId = 'rules-global-doc-upload-current';
                                                return (
                                                    <div className="field-item-wrapper" style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', background: '#fff', marginBottom: '10px' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                            <div style={{ fontSize: '12px', color: '#334155', fontWeight: 900, textTransform: 'uppercase' }}>
                                                                Ümumi Təlimat PDF
                                                            </div>
                                                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>
                                                                {pdfState.fileName || 'PDF faylı seçilməyib'}
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: '8px', marginBottom: '8px' }}>
                                                            <input
                                                                type="text"
                                                                value={pdfState.url}
                                                                onChange={(e) => updateRulesGeneralPdf({ url: e.target.value })}
                                                                placeholder="Ümumi sənəd linki (Məs: /uploads/rules.pdf və ya https://...)"
                                                                style={{ padding: '9px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                                                            />
                                                            <input
                                                                type="text"
                                                                value={pdfState.buttonText}
                                                                onChange={(e) => updateRulesGeneralPdf({ buttonText: e.target.value })}
                                                                placeholder="Düymə mətni (Məs: PDF YÜKLƏ)"
                                                                style={{ padding: '9px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                                                            />
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <input
                                                                id={uploadInputId}
                                                                type="file"
                                                                accept=".pdf,application/pdf"
                                                                ref={(node) => {
                                                                    rulesPdfInputRefs.current[uploadInputId] = node;
                                                                }}
                                                                style={{ display: 'none' }}
                                                                onChange={async (e) => {
                                                                    const f = e.target.files?.[0];
                                                                    if (!f) return;
                                                                    await handleRulesGeneralPdfUpload(f);
                                                                    e.target.value = '';
                                                                }}
                                                            />
                                                            <button
                                                                type="button"
                                                                className="btn-secondary"
                                                                onClick={() => rulesPdfInputRefs.current[uploadInputId]?.click()}
                                                            >
                                                                PDF Yüklə
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                            <div className="field-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <label><Layout size={16} /> Qaydalar Sekmələri</label>
                                                <button className="add-field-minimal" onClick={() => addRulesTab()}>
                                                    <Plus size={14} /> Yeni Sekmə
                                                </button>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                {rulesTabRows.map((row, rowIndex) => {
                                                    const canMoveUp = rowIndex > 0;
                                                    const canMoveDown = rowIndex < rulesTabRows.length - 1;
                                                    return (
                                                        <div key={`rules-tab-${row.index}-${row.id}`} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', background: '#fff' }}>
                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 170px auto', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                                                                <input
                                                                    type="text"
                                                                    value={row.title}
                                                                    onChange={(e) => updateRulesTabField(rowIndex, 'title', e.target.value)}
                                                                    placeholder="Sekmə başlığı"
                                                                    style={{ padding: '9px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', fontWeight: 700 }}
                                                                />
                                                                <input
                                                                    type="text"
                                                                    value={row.id}
                                                                    onChange={(e) => updateRulesTabField(rowIndex, 'id', e.target.value)}
                                                                    placeholder="Sekmə ID"
                                                                    style={{ padding: '9px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                                                                />
                                                                <select
                                                                    value={row.icon}
                                                                    onChange={(e) => updateRulesTabField(rowIndex, 'icon', e.target.value)}
                                                                    style={{ padding: '9px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                                                                >
                                                                    {RULE_TAB_ICON_PRESETS.map((opt) => (
                                                                        <option key={opt} value={opt}>{opt}</option>
                                                                    ))}
                                                                </select>
                                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                                    <button
                                                                        title="Yuxarı"
                                                                        onClick={() => moveRulesTab(rowIndex, 'up')}
                                                                        disabled={!canMoveUp}
                                                                        style={{ width: '30px', height: '30px', border: '1px solid #e2e8f0', background: '#fff', borderRadius: '8px', color: canMoveUp ? '#334155' : '#cbd5e1' }}
                                                                    >
                                                                        <ChevronUp size={14} />
                                                                    </button>
                                                                    <button
                                                                        title="Aşağı"
                                                                        onClick={() => moveRulesTab(rowIndex, 'down')}
                                                                        disabled={!canMoveDown}
                                                                        style={{ width: '30px', height: '30px', border: '1px solid #e2e8f0', background: '#fff', borderRadius: '8px', color: canMoveDown ? '#334155' : '#cbd5e1' }}
                                                                    >
                                                                        <ChevronDown size={14} />
                                                                    </button>
                                                                    <button
                                                                        title="Sekməni sil"
                                                                        onClick={() => removeRulesTab(rowIndex)}
                                                                        style={{ width: '30px', height: '30px', border: '1px solid #fee2e2', background: '#fff', borderRadius: '8px', color: '#ef4444' }}
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                {(row.items || []).map((item, itemIndex) => (
                                                                    <div key={`rules-item-${row.index}-${item.index}`} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px' }}>
                                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', marginBottom: '8px' }}>
                                                                            <input
                                                                                type="text"
                                                                                value={item.title}
                                                                                onChange={(e) => updateRulesTabItemField(rowIndex, itemIndex, 'title', e.target.value)}
                                                                                placeholder="Maddə başlığı"
                                                                                style={{ padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', fontWeight: 700 }}
                                                                            />
                                                                            <button
                                                                                title="Maddəni sil"
                                                                                onClick={() => removeRulesTabItem(rowIndex, itemIndex)}
                                                                                style={{ width: '30px', height: '30px', border: '1px solid #fee2e2', background: '#fff', borderRadius: '8px', color: '#ef4444' }}
                                                                            >
                                                                                <Trash2 size={14} />
                                                                            </button>
                                                                        </div>
                                                                        <textarea
                                                                            rows={3}
                                                                            value={item.desc}
                                                                            onChange={(e) => updateRulesTabItemField(rowIndex, itemIndex, 'desc', e.target.value)}
                                                                            onKeyDown={(e) => e.stopPropagation()}
                                                                            placeholder="Maddə təsviri"
                                                                            style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', lineHeight: 1.4, resize: 'vertical' }}
                                                                        />
                                                                    </div>
                                                                ))}
                                                                <button className="add-field-minimal" onClick={() => addRulesTabItem(rowIndex)}>
                                                                    <Plus size={14} /> Maddə Əlavə Et
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {currentPage.id !== 'rulespage' && currentPage.id !== 'partners' && (
                                        <div className="field-group">
                                            <div className="field-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <label><Type size={16} /> Mətn Sahələri</label>
                                                {showAdvancedEditor && !LEGAL_PAGE_IDS.has(currentPage.id) && (
                                                    <button className="add-field-minimal" onClick={() => addField('text')}>
                                                        <Plus size={14} /> Mətn Əlavə Et
                                                    </button>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                                {displayedSections.length === 0 && searchTerm ? (
                                                    <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem', border: '1px dashed #e2e8f0', borderRadius: '8px' }}>
                                                        Bu səhifədə sorğuya uyğun mətn tapılmadı.
                                                    </div>
                                                ) : currentPage?.id === 'contactpage' ? (
                                                    contactGroupedSections.map((group) => (
                                                        <div key={group.title} style={{ display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#f8fafc', padding: '12px' }}>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', padding: '4px 2px 8px 2px', borderBottom: '1px solid #e2e8f0' }}>
                                                                <div style={{ fontSize: '12px', color: '#334155', fontWeight: 900, textTransform: 'uppercase' }}>
                                                                    {group.title}
                                                                </div>
                                                                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                                                                    {group.subtitle}
                                                                </div>
                                                            </div>
                                                            {group.sections.map((section, index) => renderTextSectionCard(section, index))}
                                                        </div>
                                                    ))
                                                ) : (currentPage?.id === 'privacypolicypage' || currentPage?.id === 'termsofservicepage') ? (
                                                    legalGroupedSections
                                                        .filter((group) => group.kind !== 'legal-sections')
                                                        .map((group) => (
                                                        <div key={group.title} style={{ display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#f8fafc', padding: '12px' }}>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', padding: '4px 2px 8px 2px', borderBottom: '1px solid #e2e8f0' }}>
                                                                <div style={{ fontSize: '12px', color: '#334155', fontWeight: 900, textTransform: 'uppercase' }}>
                                                                    {group.title}
                                                                </div>
                                                                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                                                                    {group.subtitle}
                                                                </div>
                                                            </div>
                                                            {group.sections.map((section, index) => renderTextSectionCard(section, index))}
                                                        </div>
                                                    ))
                                                ) : (
                                                    displayedSections.map((section, visibleIndex) => renderTextSectionCard(section, visibleIndex))
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {currentPage.id !== 'partners' && (
                                        <div className="field-group">
                                            <div className="field-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <label><ImageIcon size={16} /> Bölmədəki Şəkillər</label>
                                                <button className="add-field-minimal" onClick={() => addField('image')}>
                                                    <Plus size={14} /> Yeni Şəkil Yeri
                                                </button>
                                            </div>
                                            {displayedImages.length > 0 && (
                                                <div style={{ marginBottom: '1rem' }}>
                                                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', marginBottom: '8px' }}>
                                                        Komponent Daxili Önizləmə (Sıra ilə)
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
                                                        {displayedImages.map((img, idx) => (
                                                            <div key={`preview-${img.id}`} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', background: '#fff' }}>
                                                                <div style={{ height: '84px', background: '#f8fafc' }}>
                                                                    {img.path ? (
                                                                        <img src={img.path} alt={img.alt || `Preview ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                    ) : (
                                                                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '11px' }}>
                                                                            Şəkil yoxdur
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div style={{ padding: '6px 8px', fontSize: '10px', color: '#475569', fontWeight: 700 }}>
                                                                    #{idx + 1}{showAdvancedEditor ? ` • ${img.id}` : ''}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            <div className="images-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.5rem' }}>
                                                {displayedImages.length > 0 ? (
                                                    displayedImages.map((img, visibleIndex) => {
                                                        const realImages = currentPage?.images || [];
                                                        const realIndex = realImages.findIndex(i => i.id === img.id);
                                                        const canMoveUp = realIndex > 0;
                                                        const canMoveDown = realIndex >= 0 && realIndex < realImages.length - 1;
                                                        return (
                                                            <div key={img.id} className="image-edit-card" style={{ border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden', background: '#fff', position: 'relative' }}>
                                                                {showAdvancedEditor && (
                                                                    <>
                                                                        <button
                                                                            className="field-delete-btn"
                                                                            onClick={() => removeField('image', img.id)}
                                                                            style={{ position: 'absolute', right: '8px', top: '8px', zIndex: 10, background: 'rgba(255,255,255,0.9)', border: '1px solid #fee2e2', color: '#ef4444', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                                                        >
                                                                            <Trash2 size={12} />
                                                                        </button>
                                                                        <div style={{ position: 'absolute', right: '40px', top: '8px', zIndex: 10, display: 'flex', gap: '6px' }}>
                                                                            <button
                                                                                title="Yuxarı daşı"
                                                                                onClick={() => moveField('image', img.id, 'up')}
                                                                                disabled={!canMoveUp}
                                                                                style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid #e2e8f0', color: canMoveUp ? '#334155' : '#cbd5e1', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canMoveUp ? 'pointer' : 'not-allowed' }}
                                                                            >
                                                                                <ChevronUp size={12} />
                                                                            </button>
                                                                            <button
                                                                                title="Aşağı daşı"
                                                                                onClick={() => moveField('image', img.id, 'down')}
                                                                                disabled={!canMoveDown}
                                                                                style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid #e2e8f0', color: canMoveDown ? '#334155' : '#cbd5e1', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canMoveDown ? 'pointer' : 'not-allowed' }}
                                                                            >
                                                                                <ChevronDown size={12} />
                                                                            </button>
                                                                        </div>
                                                                    </>
                                                                )}
                                                                <div style={{ height: '120px', background: '#f8fafc', position: 'relative', overflow: 'hidden' }}>
                                                                    {img.path && (img.path.startsWith('http') || img.path.startsWith('/')) ? (
                                                                        <img src={img.path} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                    ) : (
                                                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
                                                                            <ImageIcon size={32} style={{ opacity: 0.1 }} />
                                                                            <span style={{ fontSize: '10px', color: '#999', position: 'absolute', bottom: '10px' }}>Yol yoxdur</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div style={{ padding: '0.75rem' }}>
                                                                    <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, marginBottom: '6px' }}>
                                                                        Sıra: {visibleIndex + 1}
                                                                    </div>
                                                                    <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '4px' }}>
                                                                        <input
                                                                            type="text"
                                                                            placeholder="Resur yolu..."
                                                                            value={img.path}
                                                                            onChange={(e) => {
                                                                                if (selectedPageIndex < 0 || selectedPageIndex >= pages.length) return;
                                                                                const newPages = [...pages];
                                                                                const targetPage = newPages[selectedPageIndex];
                                                                                if (!targetPage) return;
                                                                                const realIdx = targetPage.images.findIndex(i => i.id === img.id);
                                                                                if (realIdx !== -1) {
                                                                                    targetPage.images[realIdx].path = e.target.value;
                                                                                    setPages(newPages);
                                                                                }
                                                                            }}
                                                                            style={{ fontSize: '0.75rem', flex: 1, padding: '0.4rem', border: '1px solid #eee', borderRadius: '4px' }}
                                                                        />
                                                                        <button
                                                                            onClick={() => openImageSelector(selectedPageIndex, img.id)}
                                                                            title="Sistemdən seç"
                                                                            style={{ padding: '0 8px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: 'pointer' }}
                                                                        >
                                                                            <Globe size={14} />
                                                                        </button>
                                                                        <div style={{ position: 'relative' }}>
                                                                            <input
                                                                                type="file"
                                                                                id={`file-up-${img.id}`}
                                                                                style={{ display: 'none' }}
                                                                                accept="image/*"
                                                                                onChange={(e) => handleFileUpload(e, selectedPageIndex, img.id)}
                                                                            />
                                                                            <button
                                                                                onClick={() => document.getElementById(`file-up-${img.id}`)?.click()}
                                                                                title="Kompüterdən yüklə"
                                                                                style={{ padding: '0 8px', height: '100%', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                                                            >
                                                                                <Plus size={14} />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Alt mətni..."
                                                                        value={img.alt}
                                                                        onChange={(e) => handleImageAltChange(selectedPageIndex, img.id, e.target.value)}
                                                                        style={{ fontSize: '0.75rem', width: '100%', padding: '0.4rem', border: '1px solid #eee', borderRadius: '4px' }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )
                                                    })) : (
                                                    <div className="empty-fields-tip" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '2rem', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
                                                        {searchTerm ? 'Sorğuya uyğun şəkil tapılmadı.' : 'Bu bölmədə redaktə ediləcək şəkil yoxdur.'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {currentPage.id !== 'partners' && (
                                        <div className="field-group">
                                            <label><ImageIcon size={16} /> Yeni Şəkil Yüklə</label>
                                            <div className="upload-dropzone">
                                                <Plus size={24} />
                                                <p>Şəkil yükləmək üçün seçin</p>
                                                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                                    <button className="btn-secondary" onClick={() => {
                                                        const input = document.createElement('input');
                                                        input.type = 'file';
                                                        input.accept = 'image/*';
                                                        input.onchange = async (e) => {
                                                            const file = (e.target as HTMLInputElement).files?.[0];
                                                            if (!file) return;
                                                            const url = await uploadImage(file);
                                                            if (url && selectedPageIndex >= 0 && selectedPageIndex < pages.length) {
                                                                const newPages = [...pages];
                                                                const targetPage = newPages[selectedPageIndex];
                                                                if (targetPage) {
                                                                    const newId = `img-${targetPage.images.length}-${Date.now()}`;
                                                                    targetPage.images.push({ id: newId, path: url, alt: '', type: 'local' });
                                                                    setPages(newPages);
                                                                    toast.success('Yeni şəkil əlavə edildi');
                                                                }
                                                            }
                                                        };
                                                        input.click();
                                                    }}>Cihazdan Yüklə</button>
                                                    <button className="btn-secondary" onClick={() => {
                                                        const dummyId = `img-${(currentPage.images || []).length}`;
                                                        setActiveImageField({ pageIdx: selectedPageIndex, imgId: dummyId }); // Temporary for next add
                                                        setIsAddingNewFromSystem(true);
                                                        setIsImageSelectorOpen(true);
                                                    }}>Kitabxanadan Seç</button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', gap: '1rem' }}>
                                <Layout size={48} style={{ opacity: 0.2 }} />
                                <p>Redaktə etmək üçün sol tərəfdən bir komponent seçin.</p>
                            </div>
                        )}
                    </main>
                </div>
            )
            }

            {
                isModalOpen && (
                    <div className="modal-overlay">
                        <div className="modal-card fade-in">
                            <div className="modal-header">
                                <h3>Yeni Bölmə Əlavə Et</h3>
                                <button onClick={() => setIsModalOpen(false)}><X size={20} /></button>
                            </div>
                            <div className="modal-body">
                                <div className="field-group">
                                    <label>Bölmə Başlığı</label>
                                    <input
                                        type="text"
                                        value={newSectionTitle}
                                        onChange={(e) => setNewSectionTitle(e.target.value)}
                                        placeholder="Məs: Xidmətlərimiz, Kampaniyalar..."
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn-secondary" onClick={() => setIsModalOpen(false)}>Ləğv et</button>
                                <button className="btn-primary" onClick={addNewSection}>Əlavə et</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                isImageSelectorOpen && (
                    <div className="modal-overlay">
                        <div className="modal-card fade-in" style={{ maxWidth: '800px' }}>
                            <div className="modal-header">
                                <h3>Sistem Şəkilləri</h3>
                                <button onClick={() => setIsImageSelectorOpen(false)}><X size={20} /></button>
                            </div>
                            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                                <div className="image-selector-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '1rem' }}>
                                    {allAvailableImages.length > 0 ? allAvailableImages.map((path, idx) => (
                                        <div
                                            key={idx}
                                            className="selector-image-card"
                                            onClick={() => selectImage(path)}
                                            style={{ cursor: 'pointer', border: '2px solid #f1f5f9', borderRadius: '12px', overflow: 'hidden', transition: 'all 0.2s' }}
                                        >
                                            <div style={{ aspectRatio: '1/1', background: '#f8fafc' }}>
                                                <img src={path} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            </div>
                                            <div style={{ padding: '0.5rem', fontSize: '10px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center' }}>
                                                {path.split('/').pop()}
                                            </div>
                                        </div>
                                    )) : (
                                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                                            Sistemdə heç bir şəkil tapılmadı.
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn-secondary" onClick={() => setIsImageSelectorOpen(false)}>Bağla</button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default VisualEditor;
