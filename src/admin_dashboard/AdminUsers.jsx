import React, { useEffect, useMemo, useState, useRef } from "react";
import { FaTrashAlt, FaPlusCircle, FaEdit, FaUsersCog, FaGlobeAmericas, FaTimes, FaKey, FaShieldAlt, FaSearch, FaExclamationTriangle } from "react-icons/fa";
import toast from "react-hot-toast";

// Constante para el email del admin principal (protegido)
const PROTECTED_ADMIN_EMAIL = "soporte@levantatecuba.com";

// Dropdown minimalista para ordenamiento (custom, sin <select>)
function SortDropdown({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  // Cerrar al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);
  
  const options = [
    { value: "role", label: "Ordenar por Rol" },
    { value: "name", label: "Ordenar por Nombre" },
    { value: "email", label: "Ordenar por Email" },
  ];
  
  const selected = options.find(o => o.value === value) || options[0];
  
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-medium hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-colors duration-150"
      >
        <span>{selected.label}</span>
        <svg 
          className={`w-4 h-4 text-white/50 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <ul
          role="listbox"
          className="absolute right-0 mt-1 w-full min-w-[180px] rounded-lg bg-zinc-900 border border-white/10 shadow-lg shadow-black/40 z-50 py-1 origin-top"
          style={{ 
            animation: 'dropdownFade 0.12s ease-out',
          }}
        >
          {options.map((option) => (
            <li
              key={option.value}
              role="option"
              aria-selected={value === option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer transition-colors duration-100 ${
                value === option.value 
                  ? 'bg-white/5 text-white' 
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="font-medium">{option.label}</span>
              {value === option.value && (
                <svg className="w-3.5 h-3.5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
      
      <style>{`
        @keyframes dropdownFade {
          from { opacity: 0; transform: scale(0.98) translateY(-4px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [view, setView] = useState("team"); // "team" | "extern"
  const [errorMsg, setErrorMsg] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // "create" | "edit"
  const [currentUser, setCurrentUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("role"); // "role" | "name" | "email"
  const [confirmModal, setConfirmModal] = useState({ open: false, user: null });
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

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

  // Orden de roles para sorting
  const roleOrder = { admin: 0, editor: 1, user: 2 };

  // Función de ordenamiento
  const sortUsers = (list) => {
    return [...list].sort((a, b) => {
      if (sortBy === "role") return roleOrder[a.role] - roleOrder[b.role];
      if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
      if (sortBy === "email") return (a.email || "").localeCompare(b.email || "");
      return 0;
    });
  };

  // Función de búsqueda
  const filterBySearch = (list) => {
    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase();
    return list.filter(u => 
      (u.name || "").toLowerCase().includes(term) ||
      (u.email || "").toLowerCase().includes(term) ||
      (u.role || "").toLowerCase().includes(term)
    );
  };

  // Segmentación con búsqueda y ordenamiento
  const team = useMemo(() => {
    const filtered = users.filter(u => u.role === "admin" || u.role === "editor");
    return sortUsers(filterBySearch(filtered));
  }, [users, searchTerm, sortBy]);

  const extern = useMemo(() => {
    const filtered = users.filter(u => u.role === "user");
    return sortUsers(filterBySearch(filtered));
  }, [users, searchTerm, sortBy]);

  // Paginación para externos
  const paginatedExtern = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return extern.slice(start, start + ITEMS_PER_PAGE);
  }, [extern, page]);

  const totalPages = Math.ceil(extern.length / ITEMS_PER_PAGE);
  const listado = view === "team" ? team : paginatedExtern;

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

  // Verificar si es el admin protegido
  function isProtectedAdmin(user) {
    return user?.email === PROTECTED_ADMIN_EMAIL && user?.role === "admin";
  }

  // Abrir modal de confirmación para eliminar
  function confirmDelete(user) {
    if (isProtectedAdmin(user)) {
      toast.error("No puedes eliminar al administrador principal del sistema.");
      return;
    }
    const admins = users.filter(u => u.role === "admin");
    if (user?.role === "admin" && admins.length <= 1) {
      toast.error("No puedes eliminar al último administrador.");
      return;
    }
    setConfirmModal({ open: true, user });
  }

  // Eliminar usuario confirmado
  async function handleDelete() {
    const user = confirmModal.user;
    if (!user) return;
    
    try {
      const res = await fetch(`${API}/users/${user._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error al eliminar");
      toast.success(`Usuario ${user.name} eliminado`);
      setConfirmModal({ open: false, user: null });
      await fetchUsers();
    } catch (err) {
      console.error(err);
      toast.error("No se pudo eliminar el usuario.");
    }
  }

  // Enviar solicitud de reset de contraseña
  async function handleResetPassword(user) {
    if (!user?.email) {
      toast.error("Este usuario no tiene email configurado.");
      return;
    }
    
    try {
      const res = await fetch(`${API}/password/request`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ email: user.email }),
      });
      
      if (!res.ok) throw new Error("Error al enviar solicitud");
      toast.success(`Solicitud de restablecimiento enviada a ${user.email}`);
    } catch (err) {
      console.error(err);
      toast.error("No se pudo enviar la solicitud de restablecimiento.");
    }
  }

  return (
    <div className="text-white">
      <div className="mb-8">
        <h2 className="text-3xl md:text-4xl font-bold mb-2 text-white">👥 Usuarios</h2>
        <p className="text-white/60">Administra miembros del equipo y usuarios externos</p>
      </div>

      {/* Barra de búsqueda y filtros */}
      <div className="mb-6 space-y-4">
        {/* Search + Sort */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Buscar por nombre, email o rol..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition"
            />
          </div>
          <SortDropdown value={sortBy} onChange={setSortBy} />
        </div>

        {/* Selector de vista */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex gap-3">
            <button
              onClick={() => { setView("team"); setPage(1); }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 transition font-medium ${
                view === "team" ? "bg-red-600 text-white shadow-lg shadow-red-600/20" : "bg-white/10 hover:bg-white/15 text-white/80"
              }`}
              aria-pressed={view === "team"}
            >
              <FaUsersCog /> Equipo
              <span className="ml-1 rounded-full bg-black/30 px-2 py-0.5 text-xs font-bold">{team.length}</span>
            </button>
            <button
              onClick={() => { setView("extern"); setPage(1); }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 transition font-medium ${
                view === "extern" ? "bg-red-600 text-white shadow-lg shadow-red-600/20" : "bg-white/10 hover:bg-white/15 text-white/80"
              }`}
              aria-pressed={view === "extern"}
            >
              <FaGlobeAmericas /> Externos
              <span className="ml-1 rounded-full bg-black/30 px-2 py-0.5 text-xs font-bold">{extern.length}</span>
            </button>
          </div>

          {/* Botón crear solo en "Equipo" */}
          {view === "team" && (
            <button onClick={openCreateTeam} className="btn-primary">
              <FaPlusCircle />
              Agregar miembro
            </button>
          )}
        </div>
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
            {view === "extern" ? extern.length : listado.length} {(view === "extern" ? extern.length : listado.length) === 1 ? "registro" : "registros"}
            {view === "extern" && totalPages > 1 && ` (mostrando ${listado.length})`}
          </span>
        </div>

        {listado.length === 0 ? (
          <p className="text-white/60">
            {view === "team" ? "No hay miembros del equipo aún." : "No hay usuarios externos registrados."}
          </p>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {listado.map((u) => (
              <UserCard 
                key={u._id} 
                user={u} 
                isProtected={isProtectedAdmin(u)}
                onEdit={() => openEdit(u)} 
                onDelete={() => confirmDelete(u)}
                onResetPassword={() => handleResetPassword(u)}
                viewMode={view}
              />
            ))}
          </div>
        )}

        {/* Paginación para externos */}
        {view === "extern" && totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              ← Anterior
            </button>
            <span className="px-4 text-white/60">
              Página {page} de {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Siguiente →
            </button>
          </div>
        )}
      </section>

      {/* Modal crear/editar */}
      {modalOpen && (
        <CreateEditUserModal
          mode={modalMode}
          user={currentUser}
          isProtectedAdmin={isProtectedAdmin(currentUser)}
          onClose={() => setModalOpen(false)}
          onSaved={async () => { setModalOpen(false); await fetchUsers(); }}
        />
      )}

      {/* Modal confirmación eliminar */}
      {confirmModal.open && (
        <ConfirmDeleteModal
          user={confirmModal.user}
          onConfirm={handleDelete}
          onCancel={() => setConfirmModal({ open: false, user: null })}
        />
      )}
    </div>
  );
}

// Badge de rol con colores
function RoleBadge({ role }) {
  const config = {
    admin: { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/30", label: "Administrador" },
    editor: { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/30", label: "Editor" },
    user: { bg: "bg-gray-500/20", text: "text-gray-400", border: "border-gray-500/30", label: "Usuario" },
  };
  const c = config[role] || config.user;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}>
      {role === "admin" && <FaShieldAlt className="text-[10px]" />}
      {c.label}
    </span>
  );
}

function UserCard({ user, isProtected, onEdit, onDelete, onResetPassword, viewMode }) {
  const neverLoggedIn = !user.lastLogin && !user.lastActivity;
  
  return (
    <div className={`admin-card group hover:border-white/20 transition-all duration-200 ${isProtected ? 'ring-1 ring-red-500/30 bg-red-950/20' : ''}`}>
      <div className="flex justify-between items-start gap-4">
        {/* Info del usuario */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-lg font-bold text-white truncate">{user.name}</h4>
            {isProtected && (
              <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white">
                <FaShieldAlt /> PROTEGIDO
              </span>
            )}
          </div>
          <p className="text-sm text-white/70 truncate mb-2">{user.email}</p>
          <div className="flex flex-wrap items-center gap-2">
            <RoleBadge role={user.role} />
            {viewMode === "extern" && (
              <>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  🌐 Registrado vía Web
                </span>
                {neverLoggedIn && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                    ⚠️ Nunca inició sesión
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-col gap-2 shrink-0">
          <button 
            onClick={onEdit} 
            className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 transition" 
            title="Editar usuario"
          >
            <FaEdit />
          </button>
          <button 
            onClick={onResetPassword} 
            className="p-2 rounded-lg bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 hover:text-yellow-300 transition" 
            title="Restablecer contraseña"
          >
            <FaKey />
          </button>
          <button 
            onClick={onDelete} 
            disabled={isProtected}
            className={`p-2 rounded-lg transition ${
              isProtected 
                ? 'bg-gray-500/10 text-gray-600 cursor-not-allowed' 
                : 'bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300'
            }`}
            title={isProtected ? "No se puede eliminar" : "Eliminar usuario"}
          >
            <FaTrashAlt />
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal de confirmación para eliminar
function ConfirmDeleteModal({ user, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 p-6 rounded-2xl bg-zinc-900 border border-white/10 shadow-2xl">
        <div className="flex items-center gap-3 mb-4 text-red-400">
          <FaExclamationTriangle className="text-2xl" />
          <h3 className="text-xl font-bold">Confirmar eliminación</h3>
        </div>
        <p className="text-white/70 mb-2">
          ¿Estás seguro de que deseas eliminar a <strong className="text-white">{user?.name}</strong>?
        </p>
        <p className="text-sm text-red-400/80 mb-6">
          ⚠️ Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-3">
          <button 
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
          >
            Cancelar
          </button>
          <button 
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition"
          >
            Sí, eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

/** Modal único para crear/editar */
function CreateEditUserModal({ mode, user, isProtectedAdmin, onClose, onSaved }) {
  const isEdit = mode === "edit";
  const API = import.meta.env.VITE_API_BASE_URL || "/api";
  const token = localStorage.getItem("token");

  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    role: user?.role || "editor",
    password: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // No permitir cambiar rol del admin protegido
  const canChangeRole = !isProtectedAdmin;

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
            <div>
              <select
                name="role" 
                value={form.role} 
                onChange={handleChange}
                disabled={!canChangeRole}
                className={`admin-select w-full ${!canChangeRole ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <option value="user">Usuario externo</option>
                <option value="editor">Editor</option>
                <option value="admin">Administrador</option>
              </select>
              {!canChangeRole && (
                <p className="mt-1 text-xs text-yellow-500">⚠️ No se puede cambiar el rol del admin principal</p>
              )}
            </div>
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
