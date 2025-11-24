import { useTranslation } from "react-i18next";

export default function Podcast() {
  const { t } = useTranslation();

  return (
    <main className="p-6 md:p-12 min-h-screen bg-transparent">
      <div className="bg-white/60 backdrop-blur-md rounded-xl p-6 md:p-12 max-w-4xl mx-auto animate-fade-in">
        <h1 className="text-3xl font-bold text-red-700 mb-6 text-center">
          🎙️ {t("sections.podcast.title", "Podcast")}
        </h1>
        <p className="text-gray-700 mb-4 text-center">
          {t("sections.podcast.text", "Audio stories, analysis, and voices from exile.")}
        </p>

        {/* CONTENIDO INICIAL */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow mt-6 text-center">
          <p className="text-sm text-gray-600">
            Pronto podrás escuchar nuestros primeros episodios. ¡Estamos trabajando en ello!
          </p>
        </div>
      </div>
    </main>
    
  );
}
