import React from "react";
import { Trash2, Edit, MessageSquareText } from "lucide-react";

export default function NewsCard({
  news,
  expanded,
  comments,
  onDelete,
  onEdit,
  onToggleExpand,
  renderNestedComments,
  onDeleteComment,
}) {
  return (
    <article className="flex flex-col sm:flex-row gap-3 sm:gap-4 p-3 rounded-xl border border-zinc-800 bg-zinc-900/60">
      {news.imagen && (
        <div className="shrink-0 self-start sm:self-center w-16 h-16 sm:w-24 sm:h-24 rounded-md overflow-hidden border border-zinc-800">
          <img
            src={news.imagen}
            alt={news.titulo}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Bloque de contenido con min-w-0 para permitir truncado */}
      <div className="min-w-0 flex-1">
        {/* Badge de categoría */}
        {news.categoria && (
          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium mb-2 ${
            news.categoria === 'Política' ? 'bg-red-600/20 text-red-300 border border-red-700/40' :
            news.categoria === 'Economía' ? 'bg-green-600/20 text-green-300 border border-green-700/40' :
            news.categoria === 'Internacional' ? 'bg-blue-600/20 text-blue-300 border border-blue-700/40' :
            news.categoria === 'Socio político' ? 'bg-rose-700/20 text-rose-300 border border-rose-700/40' :
            news.categoria === 'Tecnología' ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-700/40' :
            news.categoria === 'Tendencia' ? 'bg-orange-600/20 text-orange-300 border border-orange-700/40' :
            'bg-sky-600/15 text-sky-300 border border-sky-700/40'
          }`}>
            {news.categoria}
          </span>
        )}

        <h4 
          className="text-zinc-100 font-semibold text-base sm:text-lg leading-tight line-clamp-2 mb-1"
          title={news.titulo}
        >
          {news.titulo}
        </h4>

        <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] sm:text-xs text-zinc-400">
          <time dateTime={news.createdAt}>
            {new Date(news.createdAt).toLocaleDateString("es-ES", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        </div>

        {/* Etiquetas */}
        {!!news?.etiquetas?.length && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {news.etiquetas.map((tag, idx) => (
              <span
                key={idx}
                className="inline-flex items-center rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 px-2 py-0.5 text-[11px]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Bloque de botones separado con flex-shrink-0 para mantener posición fija */}
      <div className="flex-shrink-0 flex flex-wrap items-start gap-2 text-sm sm:flex-col sm:items-end">
        <button
          onClick={() => onEdit(news)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-colors"
        >
          <Edit size={14} />
          <span className="hidden sm:inline">Editar</span>
        </button>
        <button
          onClick={() => onToggleExpand(news._id)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
            (comments[news._id]?.length || 0) > 0
              ? "bg-blue-600 hover:bg-blue-700 text-white"
              : "bg-zinc-700 hover:bg-zinc-600 text-zinc-300"
          }`}
        >
          <MessageSquareText size={14} />
          <span className="hidden sm:inline">
            {expanded[news._id] ? "Ocultar" : `Comentarios (${(comments[news._id] || []).length})`}
          </span>
          <span className="sm:hidden">{(comments[news._id] || []).length}</span>
        </button>
        <button
          onClick={() => onDelete(news._id)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors"
        >
          <Trash2 size={14} />
          <span className="hidden sm:inline">Eliminar</span>
        </button>
      </div>

      {expanded[news._id] && comments[news._id]?.length > 0 && (
        <div className="mt-4 border-t border-zinc-700 pt-3 sm:col-span-full">
          {renderNestedComments(comments[news._id], news._id)}
        </div>
      )}
    </article>
  );
}
