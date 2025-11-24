import { useEffect, useState } from "react";

export default function AdminPasswordRequests() {
  const [requests, setRequests] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem("token");

      try {
        const res = await fetch("/api/password/all", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            localStorage.removeItem("token");
            localStorage.removeItem("role");
            localStorage.removeItem("user");
            window.dispatchEvent(new Event("auth:changed"));
            window.location.href = "/admin/login";
          }
          return;
        }

        const data = await res.json();
        setRequests(data);
      } catch (err) {
        console.error("❌ Error al obtener solicitudes:", err);
      }
    };

    fetchData();
  }, []);

  // ✅ Eliminar solicitud (POST por email)
  const handleDelete = async (email) => {
    const token = localStorage.getItem("token");

    try {
      const res = await fetch(`/api/password/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.email !== email));
      } else {
        console.error("❌ No se pudo eliminar la solicitud");
      }
    } catch (err) {
      console.error("❌ Error al eliminar solicitud:", err);
    }
  };

  const handleChangePassword = (email) => {
    setSelectedEmail(email);
    setNewPassword("");
  };

  // ✅ Cambiar contraseña desde esta sección
  const handleConfirmChange = async () => {
    if (!newPassword.trim()) return;

    const token = localStorage.getItem("token");

    try {
      const res = await fetch(`/api/password/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: selectedEmail, newPassword }),
      });

      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.email !== selectedEmail));
        setSelectedEmail(null);
        alert(`✅ Contraseña actualizada para ${selectedEmail}`);
      } else {
        const err = await res.json();
        alert("❌ " + (err.error || "Error al cambiar contraseña."));
      }
    } catch (err) {
      console.error("❌ Error al cambiar contraseña:", err);
    }
  };

  if (requests.length === 0)
    return (
      <div className="p-10">
        <div className="admin-card p-6 text-center text-white/70">
          No hay solicitudes pendientes. 🙌
        </div>
      </div>
    );

  return (
    <div className="text-white p-6 md:p-10">
      <h2 className="text-3xl md:text-4xl font-bold mb-2 text-white text-center">
        🛠 Solicitudes de Recuperación
      </h2>

      <ul className="space-y-6 max-w-2xl mx-auto">
        {requests.map((req) => (
          <li
            key={req._id}
            className="admin-card p-5 flex justify-between items-center"
          >
            <span className="text-white text-sm">{req.email}</span>
            <div className="flex gap-3">
              <button
                onClick={() => handleChangePassword(req.email)}
                className="btn-primary text-sm"
              >
                Cambiar contraseña
              </button>
              <button
                onClick={() => handleDelete(req.email)}
                className="btn-danger text-sm"
              >
                Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>

      {selectedEmail && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="admin-panel p-8 w-full max-w-md space-y-5">
            <h3 className="text-xl font-bold">🔐 Nueva contraseña para:</h3>
            <p className="text-red-400">{selectedEmail}</p>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Escribe la nueva contraseña"
              className="admin-input"
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setSelectedEmail(null)}
                className="btn-ghost"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmChange}
                className="btn-primary"
              >
                Confirmar cambio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
