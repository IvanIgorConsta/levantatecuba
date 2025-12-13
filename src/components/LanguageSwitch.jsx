import { useState, useEffect } from 'react';

/**
 * Switch de idioma ES/EN usando Google Translate
 * Posición: esquina superior derecha del componente padre
 */
export default function LanguageSwitch({ className = "" }) {
  const [isEnglish, setIsEnglish] = useState(false);

  useEffect(() => {
    // Cargar Google Translate script si no existe
    if (!document.getElementById('google-translate-script')) {
      const script = document.createElement('script');
      script.id = 'google-translate-script';
      script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      document.body.appendChild(script);

      // Callback global para inicializar Google Translate
      window.googleTranslateElementInit = () => {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: 'es',
            includedLanguages: 'en,es',
            autoDisplay: false,
          },
          'google_translate_element'
        );
      };
    }

    // Verificar estado actual del idioma
    const checkLanguage = () => {
      const frame = document.querySelector('.goog-te-menu-frame');
      if (frame) {
        const lang = document.documentElement.lang || 'es';
        setIsEnglish(lang === 'en');
      }
    };
    
    const interval = setInterval(checkLanguage, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleLanguage = () => {
    const newLang = isEnglish ? 'es' : 'en';
    
    // Buscar el selector de Google Translate y cambiar idioma
    const selectElement = document.querySelector('.goog-te-combo');
    if (selectElement) {
      selectElement.value = newLang;
      selectElement.dispatchEvent(new Event('change'));
      setIsEnglish(!isEnglish);
    } else {
      // Fallback: recargar con parámetro de traducción
      if (newLang === 'en') {
        window.location.href = window.location.href.split('#')[0] + '#googtrans(es|en)';
        window.location.reload();
      } else {
        // Remover traducción
        document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        window.location.reload();
      }
    }
  };

  return (
    <>
      {/* Elemento oculto de Google Translate */}
      <div id="google_translate_element" className="hidden" />
      
      {/* Switch visual ES/EN */}
      <button
        onClick={toggleLanguage}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
          isEnglish 
            ? 'bg-blue-600 text-white' 
            : 'bg-white/10 text-white/80 hover:bg-white/20'
        } backdrop-blur border border-white/20 ${className}`}
        aria-label={isEnglish ? 'Cambiar a Español' : 'Switch to English'}
        title={isEnglish ? 'Cambiar a Español' : 'Switch to English'}
      >
        <span className={!isEnglish ? 'font-bold' : 'opacity-60'}>ES</span>
        <span className="text-white/40">|</span>
        <span className={isEnglish ? 'font-bold' : 'opacity-60'}>EN</span>
      </button>
    </>
  );
}
