import React from "react";
import { Edit, Trash2, MessageCircle, Share, Circle, ExternalLink, RefreshCw } from "lucide-react";

export default function NewsListPanel({
  newsList,
  comments,
  expanded,
  onEdit,
  onDelete,
  onShare,
  onRescrape,
  onViewComments,
  onDeleteComment,
  countTotalComments,
  currentPage,
  totalPages,
  totalItems,
  uiTotalPages,
  setCurrentPage,
  filtros,
  setFiltros,
  onFilter,
  pageSize,
  setPageSize,
  counts,
  loadingList,
  loadingCounts,
}) {
  // Helper: Determina si una noticia está publicada en Facebook
  const isFacebookPublished = (news) => {
    return news.publishedToFacebook === true || news.facebook_status === 'published';
  };

  // IMPORTANTE: No usar lógica local para determinar si es candidato
  // El backend ya calcula esto correctamente usando buildFacebookCandidatesFilter()
  // y lo envía en el campo news.isFacebookCandidate
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFiltros((prev) => ({ ...prev, [name]: value }));
  };

  const handleStatusFilterChange = (newStatusFilter) => {
    const newFiltros = { ...filtros, statusFilter: newStatusFilter };
    setFiltros(newFiltros);
    // Resetear página a 1 cuando cambia el filtro
    onFilter({ statusFilter: newStatusFilter, fbStatus: newStatusFilter === "fbPending" ? "pending" : "all", page: 1 });
  };

  const handleBuscar = () => {
    onFilter({ ...filtros, page: 1 });
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= uiTotalPages && !loadingList) {
      setCurrentPage(newPage);
      onFilter({ ...filtros, page: newPage });
    }
  };

  // Obtener contador de FB pendientes desde counts (ya viene del backend)
  const facebookPendingCount = counts?.fbPending ?? 0;

  // Filtrado en cliente como refuerzo visual defensivo (el backend ya filtró)
  const baseList = React.useMemo(() => {
    let list = newsList || [];
    
    // Refuerzo visual por estado (el backend ya filtró correctamente)
    // Solo aplicar para scheduled y published, NO para fbPending
    if (filtros?.statusFilter === "scheduled") {
      list = list.filter((n) => n?.status === "scheduled");
    } else if (filtros?.statusFilter === "published") {
      list = list.filter((n) => n?.status === "published");
    }
    // Para FB pendientes, confiar COMPLETAMENTE en el backend
    // El backend usa buildFacebookCandidatesFilter() que coincide con candidatesCount
    
    return list;
  }, [newsList, filtros?.statusFilter]);

  const noticiasPorCategoria = React.useMemo(() => {
    const agrupadas = baseList.reduce((acc, noticia) => {
      const cat = noticia.categoria || "General";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(noticia);
      return acc;
    }, {});
    Object.keys(agrupadas).forEach((cat) => {
      if (filtros?.statusFilter === "scheduled") {
        agrupadas[cat].sort((a, b) => new Date(a.publishAt || 0) - new Date(b.publishAt || 0));
      } else {
        agrupadas[cat].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
    });
    return agrupadas;
  }, [baseList, filtros?.statusFilter]);

  const noHayResultados = !loadingList && baseList.length === 0;

  // Total visible según pestaña (desde counts del backend)
  const totalVisible =
    filtros?.statusFilter === "published"
      ? (counts?.published ?? totalItems)
      : filtros?.statusFilter === "scheduled"
      ? (counts?.scheduled ?? totalItems)
      : filtros?.statusFilter === "fbPending"
      ? (counts?.fbPending ?? totalItems)
      : (counts?.all ?? totalItems);

  // Helper para determinar el estado del semáforo de compartido
  const getShareStatus = (noticia) => {
    // Verde: ya publicada en Facebook
    if (isFacebookPublished(noticia)) {
      return "green";
    }
    
    // Amarillo: en proceso de publicación
    const fbStatus = noticia.facebook_status || noticia.share?.fb?.status;
    if (fbStatus === "sharing") {
      return "yellow";
    }
    
    // Rojo: error en publicación
    if (fbStatus === "error") {
      return "red";
    }
    
    // Gris: pendiente de publicación en Facebook
    return "gray";
  };

  // Helper para tooltip del semáforo
  const getShareTooltip = (noticia) => {
    const fbStatus = noticia.facebook_status || noticia.share?.fb?.status;
    const lastError = noticia.facebook_last_error || noticia.share?.fb?.error;
    
    switch (fbStatus) {
      case "published":
      case "posted":
      case "confirmed":
        return "✅ Compartido en Facebook";
      case "sharing":
        return "⏳ Publicando en Facebook...";
      case "error":
        return `❌ Error: ${lastError || "Error al compartir"}`;
      default:
        return "⚫ Pendiente de compartir en Facebook";
    }
  };

  return (
    <div className="mt-6 sm:mt-10">
      {/* Encabezado: filtros + total */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-3 sm:gap-4 mb-4">
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-4 flex-1 min-w-0">
          <input
            type="text"
            name="search"
            value={filtros.search}
            onChange={handleChange}
            onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
            placeholder="Buscar por título"
            className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2"
          />
          <select
            name="categoria"
            value={filtros.categoria}
            onChange={handleChange}
            className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2"
          >
            <option value="">Categorías</option>
            <option value="General">General</option>
            <option value="Política">Política</option>
            <option value="Economía">Economía</option>
            <option value="Internacional">Internacional</option>
            <option value="Socio político">Socio político</option>
            <option value="Tecnología">Tecnología</option>
            <option value="Tendencia">Tendencia</option>
          </select>
          <input
            type="date"
            name="fechaDesde"
            value={filtros.fechaDesde}
            onChange={handleChange}
            className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2"
          />
          <input
            type="date"
            name="fechaHasta"
            value={filtros.fechaHasta}
            onChange={handleChange}
            className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2"
          />
        </div>

        <button
          onClick={handleBuscar}
          className="h-11 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white font-medium transition-colors w-full sm:w-auto"
        >
          Aplicar filtros
        </button>
      </div>

      {/* Selector de estado (segmented control) */}
      <div className="mb-4 sticky top-0 z-30 bg-[#0d0d0d]/95 backdrop-blur-sm py-3 -mx-3 sm:-mx-4 px-3 sm:px-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-700 w-full sm:w-fit overflow-x-auto no-scrollbar">
            {[
              { key: "all", label: "Todas" },
              { key: "published", label: "Publicadas" },
              { key: "scheduled", label: "Programadas" },
              { key: "fbPending", label: "FB pendientes" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleStatusFilterChange(key)}
                className={`flex-shrink-0 px-4 py-2 text-sm rounded-md transition-all duration-200 ${
                  filtros?.statusFilter === key
                    ? "bg-red-600 text-white"
                    : "text-white/70 hover:text-white hover:bg-zinc-800"
                }`}
                role="tab"
                aria-selected={filtros?.statusFilter === key}
                aria-current={filtros?.statusFilter === key ? "true" : undefined}
                aria-label={`${label} - ${counts ? (loadingCounts ? 'cargando' : counts[key] || 0) : ''} noticias`}
              >
                <span className="whitespace-nowrap">
                  {label}
                  {key === "fbPending" ? (
                    facebookPendingCount > 0 && (
                      <span className="ml-1.5 text-xs opacity-75">
                        ({facebookPendingCount})
                      </span>
                    )
                  ) : counts && (
                    <span className="ml-1.5 text-xs opacity-75">
                      ({loadingCounts ? "…" : counts[key] || 0})
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Total */}
      <div className="mb-4 text-white/80">
        Total de noticias: <span className="font-semibold text-white">{totalVisible}</span>
      </div>

      {/* Listado */}
      {loadingList ? (
        <div className="space-y-4">
          {/* Skeleton loading */}
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="border border-zinc-700 rounded-lg p-4 bg-zinc-900 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-20 h-16 bg-zinc-700 rounded"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-zinc-700 rounded w-3/4"></div>
                  <div className="h-3 bg-zinc-700 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : noHayResultados ? (
        <div className="p-6 border border-zinc-800 rounded-lg bg-zinc-900 text-center text-white/70">
          {filtros?.statusFilter === "scheduled"
            ? "No hay noticias programadas con los filtros aplicados."
            : filtros?.statusFilter === "published"
            ? "No hay noticias publicadas con los filtros aplicados."
            : filtros?.statusFilter === "fbPending"
            ? "No hay noticias pendientes de publicación en Facebook."
            : "No hay resultados para los filtros aplicados."}
        </div>
      ) : (
        Object.entries(noticiasPorCategoria).map(([categoria, noticias]) => (
          <div key={categoria} className="mb-8">
            <h3 className="text-lg font-semibold text-red-400 mb-3">
              Categoría: {categoria}
            </h3>
            <div className="space-y-4">
              {noticias.map((noticia) => {
                const isScheduled = noticia.status === "scheduled";
                const publishAtLocal = noticia.publishAt ? new Date(noticia.publishAt).toLocaleString() : "";
                const publishedAtLocal = (noticia.publishedAt || noticia.createdAt)
                  ? new Date(noticia.publishedAt || noticia.createdAt).toLocaleString()
                  : "";

                return (
                  <div
                    key={noticia._id}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur p-3 sm:p-4"
                  >
                    <div className="grid grid-cols-[56px,1fr,auto] sm:grid-cols-[72px,1fr,auto] gap-3 items-start">
                      {noticia.imagen && (
                        <div className="w-14 h-14 sm:w-18 sm:h-18 flex-shrink-0">
                          <img
                            src={noticia.imagen}
                            alt={noticia.titulo}
                            className="w-full h-full object-cover rounded-lg border border-zinc-800"
                          />
                        </div>
                      )}
                      
                      {/* Bloque de contenido con min-width-0 para forzar truncado */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2 mb-1">
                          <h4 
                            className="flex-1 min-w-0 text-base sm:text-[15px] font-medium text-gray-50 line-clamp-2 leading-tight"
                            title={noticia.titulo}
                          >
                            {noticia.titulo}
                          </h4>
                          
                          {/* Badges de estado */}
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {isScheduled && (
                              <span className="inline-flex items-center px-2 py-0.5 text-[11px] rounded-full border border-yellow-500/30 bg-yellow-500/10 text-yellow-300 whitespace-nowrap">
                                Programada
                              </span>
                            )}
                            
                            {/* Badge de Facebook - usar campo del backend que aplica buildFacebookCandidatesFilter() */}
                            {noticia.isFacebookCandidate && (
                              <span className="inline-flex items-center px-2 py-0.5 text-[11px] rounded-full border border-blue-500/40 bg-blue-500/10 text-blue-300 whitespace-nowrap">
                                FB pendiente
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-[13px] text-zinc-400">
                          {isScheduled ? (
                            <span>Programada: {publishAtLocal}</span>
                          ) : (
                            <span>Publicada: {publishedAtLocal}</span>
                          )}
                          <span>·</span>
                          <span>Autor: {noticia.autor || "Anónimo"}</span>
                          <span>·</span>
                          <span>({noticia.categoria || "General"})</span>
                        </div>
                      </div>

                      {/* Bloque de botones con flex-shrink-0 para mantener posición fija */}
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-2">
                          {/* Semáforo de estado de compartido */}
                          <div title={getShareTooltip(noticia)} aria-label={getShareTooltip(noticia)}>
                            <Circle 
                              size={12} 
                              className={`fill-current transition-colors ${
                                getShareStatus(noticia) === "green" 
                                  ? "text-green-500" 
                                  : getShareStatus(noticia) === "yellow"
                                  ? "text-yellow-500 animate-pulse"
                                  : getShareStatus(noticia) === "red"
                                  ? "text-red-500"
                                  : "text-gray-500"
                              }`} 
                            />
                          </div>

                          {/* Botón compartir automático / Reintentar */}
                          {(noticia.facebook_status === "error" || noticia.share?.fb?.status === "error") ? (
                          <button 
                            onClick={() => onShare && onShare(noticia._id)} 
                            title="Reintentar publicación en Facebook"
                            aria-label="Reintentar publicación en Facebook"
                            className="h-10 w-10 grid place-items-center rounded-xl hover:bg-zinc-800/70 text-yellow-400 hover:text-yellow-300 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M1 4v6h6M23 20v-6h-6"/>
                              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                            </svg>
                          </button>
                        ) : (
                          <button 
                            onClick={() => onShare && onShare(noticia._id)} 
                            title={
                              noticia.status === "scheduled" 
                                ? "No se puede compartir - noticia programada" 
                                : noticia.facebook_status === "published" || noticia.share?.fb?.status === "posted"
                                ? "Ya compartido en Facebook"
                                : noticia.facebook_status === "sharing"
                                ? "Publicando en Facebook..."
                                : "Compartir en Facebook"
                            }
                            aria-label={
                              noticia.status === "scheduled" 
                                ? "No se puede compartir - noticia programada" 
                                : noticia.facebook_status === "published" || noticia.share?.fb?.status === "posted"
                                ? "Ya compartido en Facebook"
                                : "Compartir en Facebook"
                            }
                            disabled={
                              noticia.status === "scheduled" || 
                              noticia.facebook_status === "sharing" ||
                              noticia.facebook_status === "published" ||
                              noticia.share?.fb?.status === "posted"
                            }
                            className="h-10 w-10 grid place-items-center rounded-xl hover:bg-zinc-800/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-sky-500"
                          >
                            <Share size={16} className={
                              noticia.facebook_status === "published" || noticia.share?.fb?.status === "posted"
                                ? "text-gray-400"
                                : "text-blue-500"
                            } />
                          </button>
                        )}

                        {/* Botón Ver en Facebook */}
                        {(noticia.facebook_permalink_url || noticia.share?.fb?.permalink) && (
                          <a 
                            href={noticia.facebook_permalink_url || noticia.share.fb.permalink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            title="Ver publicación en Facebook"
                            aria-label="Ver publicación en Facebook"
                            className="h-10 w-10 grid place-items-center rounded-xl hover:bg-zinc-800/70 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <ExternalLink size={16} className="text-blue-400" />
                          </a>
                        )}
                        
                        {/* Botón Re-scrapear (solo para noticias publicadas) */}
                        {noticia.status === "published" && (
                          <button
                            onClick={() => onRescrape && onRescrape(noticia._id)}
                            title="Re-scrapear en Facebook (actualiza la miniatura)"
                            aria-label="Re-scrapear en Facebook"
                            className="h-10 w-10 grid place-items-center rounded-xl hover:bg-zinc-800/70 text-purple-400 hover:text-purple-300 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500"
                          >
                            <RefreshCw size={16} />
                          </button>
                        )}

                        <button 
                          onClick={() => onEdit(noticia)} 
                          title="Editar"
                          aria-label="Editar noticia"
                          className="h-10 w-10 grid place-items-center rounded-xl hover:bg-zinc-800/70 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        >
                          <Edit size={16} className="text-yellow-400" />
                        </button>
                        <button 
                          onClick={() => onDelete(noticia._id)} 
                          title="Eliminar"
                          aria-label="Eliminar noticia"
                          className="h-10 w-10 grid place-items-center rounded-xl hover:bg-zinc-800/70 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                        >
                          <Trash2 size={16} className="text-red-500" />
                        </button>
                        <button
                          onClick={() => onViewComments(noticia._id)}
                          title="Ver comentarios"
                          aria-label={`Ver comentarios (${comments[noticia._id] ? countTotalComments(comments[noticia._id]) : 0})`}
                          className="h-10 min-w-[44px] px-2 grid place-items-center rounded-xl hover:bg-zinc-800/70 text-white/70 hover:text-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <div className="flex items-center gap-1.5">
                            <MessageCircle size={16} />
                            {comments[noticia._id] && (
                              <span className="text-xs font-semibold">
                                {countTotalComments(comments[noticia._id])}
                              </span>
                            )}
                          </div>
                        </button>
                        </div>
                      </div>
                    </div>

                    {comments[noticia._id] && (
                      <p className="text-sm text-gray-400 mt-2">
                        Comentarios: {comments[noticia._id].length}
                      </p>
                    )}

                    {expanded?.[noticia._id] &&
                      comments[noticia._id]?.length > 0 && (
                        <div className="mt-4 border-top border-white/10 pt-4">
                          {/* Hilo de comentarios (si aplica) */}
                        </div>
                      )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Paginación y controles */}
      <div className="flex flex-col sm:flex-row justify-between items-center mt-8 gap-4">
        <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1 || loadingList}
            className="h-11 px-4 bg-zinc-800 rounded-lg hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-1 sm:flex-none"
            aria-label="Página anterior"
          >
            Anterior
          </button>
          <span className="text-white text-sm sm:text-base whitespace-nowrap">
            Página {Math.min(currentPage, uiTotalPages)} de {uiTotalPages}
          </span>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= uiTotalPages || loadingList}
            className="h-11 px-4 bg-zinc-800 rounded-lg hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-1 sm:flex-none"
            aria-label="Página siguiente"
          >
            Siguiente
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-white/70 text-sm">Por página:</span>
          <select
            className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1"
            value={pageSize}
            onChange={(e) => {
              const n = Number(e.target.value) || 10;
              setPageSize(n);
              onFilter({ page: 1 });
            }}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>
    </div>
  );
}
