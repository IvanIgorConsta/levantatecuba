import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./translations/en.json";
import es from "./translations/es.json";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: "es", // idioma por defecto
  fallbackLng: "es", // si no encuentra traducción
  interpolation: {
    escapeValue: false, // react ya hace escaping
  },
});

export default i18n;
