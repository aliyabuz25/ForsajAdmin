import { useEffect, useRef } from 'react';
import { type AdminLanguage } from '../utils/adminLanguage';

interface AdminAutoTranslateProps {
  language: AdminLanguage;
}

declare global {
  interface Window {
    googleTranslateElementInitAdmin?: () => void;
    google?: any;
  }
}

const GOOGLE_TRANSLATE_SCRIPT_ID = 'forsaj-admin-google-translate-script';
const GOOGLE_TRANSLATE_CONTAINER_ID = 'forsaj-admin-google-translate-element';

const toGoogleLang = (lang: AdminLanguage) => {
  if (lang === 'ru') return 'ru';
  if (lang === 'en') return 'en';
  return 'az';
};

const ensureTranslateContainer = () => {
  let container = document.getElementById(GOOGLE_TRANSLATE_CONTAINER_ID);
  if (container) return container;
  container = document.createElement('div');
  container.id = GOOGLE_TRANSLATE_CONTAINER_ID;
  container.style.position = 'fixed';
  container.style.pointerEvents = 'none';
  container.style.opacity = '0';
  container.style.width = '0';
  container.style.height = '0';
  container.style.overflow = 'hidden';
  document.body.appendChild(container);
  return container;
};

const setGoogleTranslateCookie = (targetLang: string) => {
  const value = `/az/${targetLang}`;
  document.cookie = `googtrans=${value}; path=/`;

  const host = window.location.hostname;
  if (host && host !== 'localhost' && !/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const baseDomain = host.startsWith('.') ? host : `.${host}`;
    document.cookie = `googtrans=${value}; path=/; domain=${baseDomain}`;
  }
};

const applyGoogleTranslateLanguage = (lang: AdminLanguage) => {
  const googleLang = toGoogleLang(lang);
  setGoogleTranslateCookie(googleLang);
  document.documentElement.lang = googleLang;

  const combo = document.querySelector<HTMLSelectElement>('.goog-te-combo');
  if (!combo) return false;
  if (googleLang === 'az') {
    combo.value = '';
    combo.dispatchEvent(new Event('change'));
    return true;
  }
  if (combo.value === googleLang) return true;
  combo.value = googleLang;
  combo.dispatchEvent(new Event('change'));
  return true;
};

const initGoogleTranslate = (language: AdminLanguage) => {
  ensureTranslateContainer();
  const translateElement = window.google?.translate?.TranslateElement;
  if (!translateElement) return false;

  if (!document.getElementById(`${GOOGLE_TRANSLATE_CONTAINER_ID}-inner`)) {
    const inner = document.createElement('div');
    inner.id = `${GOOGLE_TRANSLATE_CONTAINER_ID}-inner`;
    ensureTranslateContainer().appendChild(inner);
    new window.google.translate.TranslateElement(
      {
        pageLanguage: 'az',
        includedLanguages: 'ru,en',
        autoDisplay: false,
        layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE
      },
      inner.id
    );
  }

  return applyGoogleTranslateLanguage(language);
};

const AdminAutoTranslate: React.FC<AdminAutoTranslateProps> = ({ language }) => {
  const retriesRef = useRef<number[]>([]);

  useEffect(() => {
    ensureTranslateContainer();

    const applyWithRetry = () => {
      retriesRef.current.forEach((id) => window.clearTimeout(id));
      retriesRef.current = [];

      const retrySteps = [0, 100, 300, 700, 1200, 2000];
      retrySteps.forEach((delay) => {
        const timerId = window.setTimeout(() => {
          applyGoogleTranslateLanguage(language);
        }, delay);
        retriesRef.current.push(timerId);
      });
    };

    if (window.google?.translate?.TranslateElement) {
      initGoogleTranslate(language);
      applyWithRetry();
      return () => {
        retriesRef.current.forEach((id) => window.clearTimeout(id));
        retriesRef.current = [];
      };
    }

    window.googleTranslateElementInitAdmin = () => {
      initGoogleTranslate(language);
      applyWithRetry();
    };

    const existingScript = document.getElementById(GOOGLE_TRANSLATE_SCRIPT_ID);
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = GOOGLE_TRANSLATE_SCRIPT_ID;
      script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInitAdmin';
      script.async = true;
      document.body.appendChild(script);
    }

    return () => {
      retriesRef.current.forEach((id) => window.clearTimeout(id));
      retriesRef.current = [];
    };
  }, []);

  useEffect(() => {
    const apply = () => {
      const done = applyGoogleTranslateLanguage(language);
      if (!done) {
        const tid = window.setTimeout(() => applyGoogleTranslateLanguage(language), 220);
        retriesRef.current.push(tid);
      }
    };
    apply();
    return () => {
      retriesRef.current.forEach((id) => window.clearTimeout(id));
      retriesRef.current = [];
    };
  }, [language]);

  useEffect(() => {
    return () => {
      retriesRef.current.forEach((id) => window.clearTimeout(id));
      retriesRef.current = [];
      if (window.googleTranslateElementInitAdmin) {
        delete window.googleTranslateElementInitAdmin;
      }
    };
  }, []);

  useEffect(() => {
    const styleId = 'forsaj-admin-google-translate-style';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      body { top: 0 !important; }
      .goog-te-banner-frame.skiptranslate { display: none !important; }
      .skiptranslate.goog-te-gadget { font-size: 0 !important; }
      #goog-gt-tt, .goog-tooltip, .goog-tooltip:hover,
      .VIpgJd-ZVi9od-aZ2wEe-wOHMyf,
      .VIpgJd-ZVi9od-ORHb-OEVmcd,
      .VIpgJd-ZVi9od-xl07Ob-OEVmcd { display: none !important; }
      .goog-text-highlight { background: transparent !important; box-shadow: none !important; }
    `;
    document.head.appendChild(style);
    return () => {
      const existing = document.getElementById(styleId);
      if (existing) existing.remove();
    };
  }, []);

  return null;
};

export default AdminAutoTranslate;
