// src/components/PageHeader.jsx
// Componente de cabecera unificada para páginas internas
// Patrón visual consistente con Noticias y Tienda

import { Link } from 'react-router-dom';
import { ChevronRight, ArrowLeft } from 'lucide-react';

/**
 * PageHeader - Cabecera unificada para páginas internas
 * 
 * @param {Object} props
 * @param {Array<{label: string, href?: string}>} props.breadcrumb - Items del breadcrumb
 * @param {React.ComponentType} props.icon - Icono lucide para el título
 * @param {string} props.title - Título principal
 * @param {string} [props.titleHighlight] - Parte del título a mostrar en gris
 * @param {string} [props.subtitle] - Subtítulo/descripción
 * @param {string} [props.ctaLabel] - Texto del botón CTA
 * @param {string} [props.ctaHref] - Ruta del botón CTA
 * @param {React.ComponentType} [props.ctaIcon] - Icono para el botón CTA
 * @param {string} [props.bannerEmoji] - Emoji para el banner (default: ❤️)
 * @param {string} [props.bannerTitle] - Título del banner
 * @param {string} [props.bannerText] - Texto del banner
 */
export default function PageHeader({
  breadcrumb = [],
  icon: Icon,
  title,
  titleHighlight,
  subtitle,
  ctaLabel,
  ctaHref,
  ctaIcon: CtaIcon,
  bannerEmoji = '❤️',
  bannerTitle = 'Apoya la causa',
  bannerText = 'Cada acción cuenta para construir un mejor futuro.',
}) {
  // El primer item del breadcrumb es para el botón móvil de "Volver"
  const backLink = breadcrumb.length > 1 ? breadcrumb[breadcrumb.length - 2] : breadcrumb[0];
  const backHref = backLink?.href || '/';

  return (
    <>
      {/* Header moderno - mismo diseño que Noticias/Tienda */}
      <header className="max-w-6xl mx-auto px-4 md:px-6 pt-[calc(var(--nav-h,64px)+12px)] mb-4 md:mb-6">
        {/* Botón Volver (solo móvil) */}
        <div className="flex sm:hidden items-center justify-between mb-3">
          <Link
            to={backHref}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Volver
          </Link>
        </div>

        {/* Breadcrumb simple (solo desktop) */}
        <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-2 text-sm text-zinc-400 mb-2">
          {breadcrumb.map((item, index) => (
            <span key={index} className="flex items-center gap-2">
              {index > 0 && <ChevronRight className="w-4 h-4" aria-hidden="true" />}
              {item.href ? (
                <Link to={item.href} className="hover:text-zinc-300 transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span className="text-zinc-300">{item.label}</span>
              )}
            </span>
          ))}
        </nav>

        {/* Title row */}
        <div className="flex items-center gap-3">
          {/* Ícono moderno */}
          {Icon && (
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-zinc-900/70 border border-zinc-800/60">
              <Icon className="w-5 h-5 text-zinc-300" strokeWidth={1.5} aria-hidden="true" />
            </span>
          )}

          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-100">
            {title}
            {titleHighlight && (
              <span className="text-zinc-400"> {titleHighlight}</span>
            )}
          </h1>
        </div>

        {/* Subtítulo */}
        {subtitle && (
          <p className="mt-2 text-zinc-400 text-sm md:text-base max-w-2xl">
            {subtitle}
          </p>
        )}
      </header>

      {/* Banner con CTA */}
      {(ctaLabel && ctaHref) && (
        <div className="max-w-6xl mx-auto px-4 md:px-6 mb-6">
          <div className="rounded-xl border border-zinc-800 bg-gradient-to-r from-zinc-900/80 to-zinc-900/60 backdrop-blur-sm p-4 md:p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-white font-semibold mb-1">
                  {bannerEmoji} {bannerTitle}
                </p>
                <p className="text-zinc-400 text-sm">
                  {bannerText}
                </p>
              </div>
              <Link
                to={ctaHref}
                className="inline-flex items-center justify-center rounded-lg bg-red-600 hover:bg-red-700 px-6 py-2.5 text-white font-semibold transition-all duration-200 shadow-lg hover:shadow-red-600/20 whitespace-nowrap"
              >
                {CtaIcon && <CtaIcon className="w-4 h-4 mr-2" />}
                {ctaLabel}
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
