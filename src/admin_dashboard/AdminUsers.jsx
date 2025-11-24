import { useEffect, useMemo, useState } from "react";
import { FaTrashAlt, FaPlusCircle, FaEdit, FaUsersCog, FaGlobeAmericas, FaTimes } from "react-icons/fa";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [view, setView] = useState("team"); // "team" | "extern"
  const [errorMsg, setErrorMsg] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // "create" | "edit"
  const [currentUser, setCurrentUser] = useState(null); // user a editar

  const API = import.meta.env.VITE_API_BASE_URL || "/api";
  const token = localStorage.getItem("token");

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    try {
      const res = await fetch(`${API}/users`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        setErrorMsg(error.message || "Error al obtener usuarios.");
        return;
      }
      setUsers(await res.json());
    } catch (err) {
      console.error("❌ Error al cargar usuarios:", err);
      setErrorMsg("Error al conectar con el servidor.");
    }
  }

  // Segmentación
  const team = useMemo(() => users.filter(u => u.role === "admin" || u.role === "editor"), [users]);
  const extern = useMemo(() => users.filter(u => u.role === "user"), [users]);
  const listado = view === "team" ? team : extern;

  // Abrir modal en modo crear (solo equipo)
  function openCreateTeam() {
    setModalMode("create");
    setCurrentUser(null);
    setModalOpen(true);
  }

  // Abrir modal en modo editar (equipo o externos)
  function openEdit(u) {
    setModalMode("edit");
    setCurrentUser(u);
    setModalOpen(true);
  }

  // Eliminar
  async function handleDelete(id) {
    const admins = users.filter(u => u.role === "admin");
    const target = users.find(u => u._id === id);
    if (target?.role === "admin" && admins.length <= 1) {
      alert("No puedes eliminar al último administrador.");
      return;
    }
    if (!confirm("¿Seguro que deseas eliminar este usuario?")) return;
    try {
      const res = await fetch(`${API}/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error al eliminar");
      await fetchUsers();
    } catch (err) {
      console.error(err);
      alert("No se pudo eliminar el usuario.");
    }
  }

  return (
    <div className="text-white">
      <div className="mb-8">
        <h2 className="text-3xl md:text-4xl font-bold mb-2 text-white">👥 Usuarios</h2>
        <p className="text-white/60">Administra miembros del equipo y usuarios externos</p>
      </div>

      {/* Selector de vista */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex gap-3">
          <button
            onClick={() => setView("team")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 transition ${
              view === "team" ? "bg-red-600 text-white" : "bg-white/10 hover:bg-white/15 text-white/80"
            }`}
            aria-pressed={view === "team"}
          >
            <FaUsersCog /> Equipo
            <span className="ml-1 rounded bg-black/30 px-2 py-0.5 text-xs">{team.length}</span>
          </button>
          <button
            onClick={() => setView("extern")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 transition ${
              view === "extern" ? "bg-red-600 text-white" : "bg-white/10 hover:bg-white/15 text-white/80"
            }`}
            aria-pressed={view === "extern"}
          >
            <FaGlobeAmericas /> Usuarios externos
            <span className="ml-1 rounded bg-black/30 px-2 py-0.5 text-xs">{extern.length}</span>
          </button>
        </div>

        {/* Botón crear solo en “Equipo” */}
        {view === "team" && (
          <button
            onClick={openCreateTeam}
            className="btn-primary"
          >
            <FaPlusCircle />
            Agregar miembro del equipo
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="mb-6 rounded-lg bg-red-900/40 border border-red-800/40 p-4 text-center text-red-200">{errorMsg}</div>
      )}

      {/* Lista (filtrada por la vista) */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-xl font-semibold">
            {view === "team" ? "👥 Miembros del equipo" : "🌐 Usuarios externos"}
          </h3>
          <span className="text-sm text-white/60">
            {listado.length} {listado.length === 1 ? "registro" : "registros"}
          </span>
        </div>

        {listado.length === 0 ? (
          <p className="text-white/60">
            {view === "team" ? "No hay miembros del equipo aún." : "No hay usuarios externos registrados."}
          </p>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {listado.map((u) => (
              <UserCard key={u._id} user={u} onEdit={() => openEdit(u)} onDelete={() => handleDelete(u._id)} />
            ))}
          </div>
        )}
      </section>

      {/* Modal crear/editar */}
      {modalOpen && (
        <CreateEditUserModal
          mode={modalMode}
          user={currentUser}
          onClose={() => setModalOpen(false)}
          onSaved={async () => { setModalOpen(false); await fetchUsers(); }}
        />
      )}
    </div>
  );
}

function UserCard({ user, onEdit, onDelete }) {
  return (
    <div className="admin-card">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="text-xl font-semibold">{user.name}</h4>
          <p className="text-sm text-white/70">{user.email}</p>
          <p className="text-sm italic text-gray-400">Rol: {user.role}</p>
        </div>
        <div className="flex gap-4 text-lg">
          <button onClick={onEdit} className="text-blue-400 hover:text-blue-600" title="Editar">
            <FaEdit />
          </button>
          <button onClick={onDelete} className="text-red-500 hover:text-red-700" title="Eliminar">
            <FaTrashAlt />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Modal único para crear/editar */
function CreateEditUserModal({ mode, user, onClose, onSaved }) {
  const isEdit = mode === "edit";
  const API = import.meta.env.VITE_API_BASE_URL || "/api";
  const token = localStorage.getItem("token");

  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    role: user?.role || "editor", // por defecto editor al crear
    password: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const url = isEdit ? `${API}/users/${user._id}` : `${API}/users`;
      const method = isEdit ? "PUT" : "POST";
      const body = {
        name: form.name,
        email: form.email,
        role: form.role,
        ...(form.password ? { password: form.password } : {}), // opcional
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo guardar");
        setSaving(false);
        return;
      }
      await onSaved();
    } catch (err) {
      console.error(err);
      setError("Error de red");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg admin-panel">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold">
            {isEdit ? "Editar usuario" : "Agregar miembro del equipo"}
          </h4>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <FaTimes />
          </button>
        </div>

        {error && <div className="mb-4 rounded-lg bg-red-900/40 border border-red-800/40 px-3 py-2 text-sm text-red-200">{error}</div>}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <input
            type="text" name="name" value={form.name} onChange={handleChange}
            placeholder="Nombre completo" className="admin-input" required
          />
          <input
            type="email" name="email" value={form.email} onChange={handleChange}
            placeholder="Correo electrónico" className="admin-input" required
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              name="role" value={form.role} onChange={handleChange}
              className="admin-select"
            >
              <option value="user">Usuario externo</option>
              <option value="editor">Editor</option>
              <option value="admin">Administrador</option>
            </select>
            <input
              type="password" name="password" value={form.password} onChange={handleChange}
              placeholder={isEdit ? "Nueva contraseña (opcional)" : "Contraseña"}
              className="admin-input"
              required={!isEdit}
            />
          </div>

        <div className="mt-6 flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancelar
            </button>
            <button
              type="submit" disabled={saving}
              className="btn-primary"
            >
              {saving ? "Guardando..." : (isEdit ? "Guardar cambios" : "Crear usuario")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
