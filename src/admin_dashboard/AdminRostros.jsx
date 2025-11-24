import { useEffect, useState } from "react";

export default function AdminRostros() {
  const [rostros, setRostros] = useState([]);
  const [imagen, setImagen] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    fetch("/api/rostros")
      .then((res) => res.json())
      .then((data) => setRostros(data))
      .catch(() => alert("Error al cargar los rostros."));
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImagen(file);
    setPreview(URL.createObjectURL(file));
  };

  const agregarRostro = async (e) => {
    e.preventDefault();
    if (!imagen) return alert("Debes subir una imagen");

    const formData = new FormData();
    formData.append("imagen", imagen);

    try {
      const res = await fetch("/api/rostros", {
        method: "POST",
        headers: {
          Authorization: localStorage.getItem("token"),
        },
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "No se pudo agregar rostro.");
      }

      const nuevo = await res.json();
      setRostros([nuevo, ...rostros]);
      setImagen(null);
      setPreview(null);
    } catch (err) {
      alert("❌ " + err.message);
    }
  };

  const eliminarRostro = async (id) => {
    try {
      const res = await fetch(`/api/rostros/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: localStorage.getItem("token"),
        },
      });

      if (!res.ok) throw new Error("No se pudo eliminar.");
      setRostros(rostros.filter((r) => r._id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="p-4 sm:p-6 text-white text-sm md:text-base min-h-screen">
      <h2 className="text-2xl md:text-3xl font-bold mb-6 text-red-500">🖼️ Publicar Rostro</h2>

      <form
        onSubmit={agregarRostro}
        className="admin-card p-5 space-y-4 mb-10"
        encType="multipart/form-data"
      >
        <div className="relative">
          <input
            id="upload"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <label
            htmlFor="upload"
            className="block btn-ghost text-center cursor-pointer px-4 py-2"
          >
            Subir Foto
          </label>
        </div>

        {preview && (
          <img
            src={preview}
            alt="Preview"
            className="w-40 rounded-lg mb-2 border border-zinc-700"
          />
        )}

        <button
          type="submit"
          className="btn-primary w-full"
        >
          Publicar Rostro
        </button>
      </form>

      <h3 className="text-xl sm:text-2xl font-semibold mb-4 text-white">📸 Rostros Publicados</h3>

      {rostros.length === 0 ? (
        <div className="admin-card text-center py-6 px-4 text-white/60">
          No hay rostros publicados aún. Agrega uno arriba.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rostros.map((rostro) => (
            <div
              key={rostro._id}
              className="admin-card p-4 relative space-y-3"
            >
              <img
                src={rostro.url}
                alt="Rostro"
                className="w-full h-48 object-cover rounded-lg"
              />
              <div className="absolute top-2 right-3 text-sm">
                <button
                  onClick={() => eliminarRostro(rostro._id)}
                  className="text-red-400 hover:underline"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
