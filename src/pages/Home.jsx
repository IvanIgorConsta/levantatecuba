import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import useTrackPage from "../utils/useTrackPage";
import PropTypes from "prop-types";
import { Newspaper, Megaphone, ShoppingBag, ArrowRight } from "lucide-react";
import PuenteLibreHero from "../components/PuenteLibreHero";
import HeroLevantateCuba from "../components/HeroLevantateCuba";
import SectionDivider from "../components/ui/SectionDivider";
import TasasMercado from "../components/TasasMercado";
import DonateButton from "../components/DonateButton";

const SectionCardModern = ({ to, icon, title, text, onClick, className = "" }) => (
  <Link
    to={to}
    onClick={onClick}
    className={`group relative block rounded-2xl border border-zinc-800 bg-zinc-900/60 hover:border-red-500/40 transition p-6 text-center ${className}`}
  >
    <span
      className="pointer-events-none absolute inset-0 rounded-2xl bg-red-500/15 blur-xl opacity-0 transition group-hover:opacity-100"
      aria-hidden="true"
    />
    <div className="relative z-10">
      <div className="mb-4 flex justify-center">{icon}</div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  </Link>
);

SectionCardModern.propTypes = {
  to: PropTypes.string.isRequired,
  icon: PropTypes.node.isRequired,
  title: PropTypes.string.isRequired,
  text: PropTypes.string.isRequired,
  onClick: PropTypes.func,
  className: PropTypes.string,
};

export default function Home() {
  const { t } = useTranslation();

  useTrackPage();

  return (
    <main className="flex flex-col items-center w-full bg-zinc-950 text-white overflow-x-hidden">
      {/* Hero */}
      <HeroLevantateCuba />

      {/* Línea */}
      <SectionDivider className="py-6" variant="strong" />

      {/* Tasas */}
      <motion.section
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        viewport={{ once: true }}
        className="px-4 sm:px-6 md:px-20 py-12 md:py-16"
      >
        <div className="max-w-5xl mx-auto">
          <div className="my-8">
            <TasasMercado sharePath="/tasas" />
          </div>
        </div>
      </motion.section>

      {/* Línea */}
      <SectionDivider className="py-6" variant="strong" />

      {/* Explora */}
      <motion.section
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        viewport={{ once: true }}
        className="px-4 sm:px-6 md:px-20 py-20 md:py-24"
      >
        <h2 className="text-2xl md:text-3xl font-semibold text-white tracking-tight text-center mb-10">
          Explora la plataforma
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 gap-y-10 max-w-3xl mx-auto">
          <SectionCardModern
            to="/noticias"
            icon={<Newspaper size={40} className="text-red-500" />}
            title={t("sections.news.title")}
            text={t("sections.news.text")}
          />
          <SectionCardModern
            to="/denuncias"
            icon={<Megaphone size={40} className="text-red-500" />}
            title={t("sections.reports.title")}
            text={t("sections.reports.text")}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
          viewport={{ once: true }}
          className="mt-16 max-w-2xl mx-auto"
        >
          <Link
            to="/tienda"
            className="group relative block bg-zinc-900/70 rounded-2xl border border-zinc-800/40 p-8 shadow-xl backdrop-blur-md hover:scale-[1.02] transition-all duration-300"
            aria-label="Ir a la tienda de productos exclusivos"
          >
            <div className="text-center">
              <div className="inline-flex items-center gap-3 px-5 py-2 bg-gradient-to-r from-red-600 to-orange-500 rounded-full mb-4">
                <ShoppingBag size={24} className="text-white" aria-hidden="true" />
                <h3 className="text-xl font-bold text-white">Tienda</h3>
              </div>

              <p className="text-gray-400 text-base mb-6 max-w-md mx-auto">
                Apoya la plataforma con camisetas,<br />
                tazas y otros artículos exclusivos.
              </p>

              <div className="inline-block">
                <span className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2 rounded-full shadow-md transition-all duration-200">
                  Ver productos
                  <ArrowRight
                    size={20}
                    className="transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </span>
              </div>
            </div>
          </Link>
        </motion.div>
      </motion.section>

      <SectionDivider className="py-6" variant="strong" />

      {/* Puente Libre */}
      <PuenteLibreHero />

      <SectionDivider className="py-6" variant="strong" />

      {/* Mensaje + Donar (sin franja ni fondo) */}
      <section className="text-center py-8">
        <div className="mx-auto max-w-2xl px-6">
          <p className="text-lg md:text-xl text-white/90 font-medium leading-relaxed mb-6">
            Cada aporte cuenta. Tu apoyo impulsa a{" "}
            <span className="text-red-500 font-semibold">LevántateCuba</span>{" "}
            para seguir informando, inspirando y defendiendo la verdad desde el exilio.
          </p>
          <div className="flex justify-center">
            <DonateButton />
          </div>
        </div>
      </section>
    </main>
  );
}
