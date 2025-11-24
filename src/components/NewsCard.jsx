export default function NewsCard({ noticia }) {
  return (
    <div className="bg-white border shadow rounded p-4 md:hover:shadow-lg md:transition-shadow">
      <h2 className="text-lg font-bold text-gray-900 mb-2">{noticia.titulo}</h2>
      <p className="text-sm text-gray-700">{noticia.descripcion}</p>
      <div className="text-xs text-gray-500 mt-3">
        {noticia.autor?.trim() || "Autor verificado"} · {new Date(noticia.fecha).toLocaleDateString()}
      </div>
    </div>
  );
}
