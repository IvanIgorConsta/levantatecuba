import { useState } from "react";

export default function Contacto() {
  const [form, setForm] = useState({ nombre: "", correo: "", mensaje: "" });
  const [enviado, setEnviado] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Mensaje de contacto:", form); // Aquí conectas con backend
    setEnviado(true);
  };

  if (enviado) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-cover bg-fixed bg-[url('/fondo-contacto.jpg')] p-6">
        <div className="bg-white/60 backdrop-blur-lg p-8 rounded-xl shadow-md text-center max-w-md w-full animate-fade-in">
          <h2 className="text-2xl font-bold text-green-700 mb-4">¡Gracias por contactarnos!</h2>
          <p className="text-gray-700">Pronto responderemos a tu mensaje.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-cover bg-fixed bg-[url('/fondo-contacto.jpg')] p-6">
      <form
        onSubmit={handleSubmit}
        className="bg-white/60 backdrop-blur-lg p-8 rounded-xl shadow-md w-full max-w-md space-y-4 animate-fade-in"
      >
        <h1 className="text-3xl font-bold text-red-700 text-center">💬 Contáctanos</h1>

        <input
          type="text"
          name="nombre"
          placeholder="Tu nombre"
          className="w-full p-3 border rounded bg-white/80 placeholder-gray-600"
          onChange={handleChange}
          required
        />

        <input
          type="email"
          name="correo"
          placeholder="Tu correo electrónico"
          className="w-full p-3 border rounded bg-white/80 placeholder-gray-600"
          onChange={handleChange}
          required
        />

        <textarea
          name="mensaje"
          placeholder="Escribe tu mensaje aquí..."
          rows={4}
          className="w-full p-3 border rounded bg-white/80 placeholder-gray-600"
          onChange={handleChange}
          required
        />

        <button
          type="submit"
          className="w-full bg-red-600 hover:bg-red-700 text-black py-3 rounded font-semibold transition"
        >
          Enviar mensaje
        </button>
      </form>
    </main>
  );
}
