import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import zh from './locales/zh.json';
import zhTW from './locales/zh-TW.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import ru from './locales/ru.json';

i18n
    // detect user language
    // learn more: https://github.com/i18next/i18next-browser-languagedetector
    .use(LanguageDetector)
    // pass the i18n instance to react-i18next.
    .use(initReactI18next)
    // init i18next
    // for all options read: https://www.i18next.com/overview/configuration-options
    .init({
        resources: {
            en: { translation: en },
            zh: { translation: zh },
            'zh-TW': { translation: zhTW },
            ja: { translation: ja },
            ko: { translation: ko },
            ru: { translation: ru },
        },
        fallbackLng: 'en',
        debug: import.meta.env.DEV,

        interpolation: {
            escapeValue: false, // not needed for react as it escapes by default
        },

        detection: {
            order: ['localStorage', 'navigator'],
            lookupLocalStorage: 'kokoro_app_language',
            caches: ['localStorage'],
            convertDetectedLanguage: (lng: string) => {
                const normalized = lng.toLowerCase();
                if (
                    normalized.startsWith('zh-tw') ||
                    normalized.startsWith('zh-hant') ||
                    normalized.startsWith('zh-hk') ||
                    normalized.startsWith('zh-mo')
                ) {
                    return 'zh-TW';
                }
                if (normalized === 'zh-cn' || normalized === 'zh-sg') {
                    return 'zh';
                }
                return lng;
            },
        }
    });

export default i18n;
