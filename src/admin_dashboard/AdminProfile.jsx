import { useEffect, useState } from "react";

export default function AdminProfile() {
  const [perfil, setPerfil] = useState({
    firstName: "",
    lastName: "",
    nickname: "",
    role: "",
    email: "",
    profileImage: "",
  });
  const [mensaje, setMensaje] = useState("");
  const [nuevaImagen, setNuevaImagen] = useState(null);
  const [preview, setPreview] = useState(null);

  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) return;

    const fetchPerfil = async () => {
      try {
        const res = await fetch(`/api/users/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("❌ Error al obtener perfil");

        const data = await res.json();
        setPerfil({
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          nickname: data.nickname || "",
          role: data.role || "",
          email: data.email || "",
          profileImage: data.profileImage || "",
        });
        setPreview(data.profileImage || null);
      } catch (err) {
        console.error("❌ Error al cargar perfil", err);
      }
    };

    fetchPerfil();
  }, [token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setPerfil((prev) => ({ ...prev, [name]: value }));
  };

  const handleImagenChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNuevaImagen(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const guardarPerfil = async () => {
    try {
      const formData = new FormData();
      Object.entries(perfil).forEach(([key, value]) => {
        if (value) formData.append(key, value);
      });
      if (nuevaImagen) formData.append("profileImage", nuevaImagen);

      const res = await fetch(`/api/users/profile`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const result = await res.json();
      if (!res.ok) {
        console.error("❌ Backend response:", result);
        throw new Error("Error al actualizar perfil");
      }

      setMensaje("✅ Perfil actualizado correctamente.");
      setTimeout(() => setMensaje(""), 3000);
    } catch (err) {
      console.error(err);
      setMensaje("❌ Hubo un error al guardar.");
    }
  };

  return (
    <div className="p-4 sm:p-6 text-white text-base min-h-screen">
      <h2 className="text-3xl font-bold mb-6 text-red-500">👤 Mi Perfil</h2>

      {/* Avatar + Información */}
      <div className="admin-card p-6 max-w-2xl mx-auto space-y-4 text-center">
        <div className="w-28 h-28 mx-auto rounded-full border border-zinc-700 overflow-hidden bg-zinc-900">
          <img
            src={preview || "https://cdn-icons-png.flaticon.com/512/149/149071.png"}
            alt="Avatar"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="space-y-1">
          <p className="text-sm text-gray-300">✍️ Tus publicaciones serán firmadas como:</p>
          <p className="text-xl font-semibold text-white">
            {perfil.nickname
              ? `"${perfil.nickname}"`
              : `${perfil.firstName} ${perfil.lastName}`.trim() || "Tu nombre"}
          </p>
          {perfil.nickname && <p className="text-sm text-gray-400">(Sobrenombre activado)</p>}
          <p className="text-sm text-gray-400">📧 {perfil.email}</p>
          <p className="text-sm text-gray-400">🔐 <strong className="text-yellow-400">{perfil.role}</strong></p>
        </div>
      </div>

      {/* Formulario */}
      <div className="admin-card p-6 space-y-5 max-w-2xl mx-auto mt-6">
        <div>
          <label className="block text-gray-300 font-semibold mb-2">📷 Foto de perfil (opcional):</label>
          <label className="inline-block btn-ghost cursor-pointer">
            📁 Seleccionar foto
            <input type="file" accept="image/*" onChange={handleImagenChange} className="hidden" />
          </label>
        </div>

        <div>
          <label className="block text-gray-300 font-semibold mb-1">Nombre:</label>
          <input
            type="text"
            name="firstName"
            value={perfil.firstName}
            onChange={handleChange}
            className="admin-input"
            placeholder="Tu nombre real"
          />
        </div>

        <div>
          <label className="block text-gray-300 font-semibold mb-1">Apellidos:</label>
          <input
            type="text"
            name="lastName"
            value={perfil.lastName}
            onChange={handleChange}
            className="admin-input"
            placeholder="Tus apellidos"
          />
        </div>

        <div>
          <label className="block text-gray-300 font-semibold mb-1">Sobrenombre (opcional):</label>
          <input
            type="text"
            name="nickname"
            value={perfil.nickname}
            onChange={handleChange}
            className="admin-input"
            placeholder="Alias público"
          />
          <p className="text-sm text-gray-500 mt-1">
            Si lo llenas, verás este nombre en lugar del real en tus publicaciones.
          </p>
        </div>

        <button
          onClick={guardarPerfil}
          className="btn-primary w-full"
        >
          Guardar Cambios
        </button>

        {mensaje && <p className="mt-4 text-sm font-semibold text-center">{mensaje}</p>}
      </div>
    </div>
  );
}
