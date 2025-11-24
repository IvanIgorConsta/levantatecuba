import { useState } from "react";

export default function Suscribete() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.includes("@")) {
      setError("Correo no válido");
      return;
    }

    try {
      // Aquí puedes conectar con MongoDB usando /api/subscribers
      // await fetch("/api/subscribers", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ email }),
      // });

      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setError("No se pudo enviar tu suscripción.");
    }
  };

  if (submitted) {
    return (
      <main className="min-h-screen p-6 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-md border border-white/20 text-white p-8 rounded-2xl shadow-md max-w-md text-center">
          <h2 className="text-2xl font-bold text-green-400 mb-2">¡Gracias por suscribirte!</h2>
          <p>Recibirás actualizaciones directamente en tu correo electrónico.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 flex items-center justify-center">
      <div className="bg-white/10 backdrop-blur-md border border-white/20 text-white p-8 rounded-2xl shadow-md max-w-md w-full animate-fade-in">
        <h1 className="text-3xl font-bold text-red-400 mb-4">Suscríbete</h1>
        <p className="mb-6 text-lg">
          Regístrate para recibir noticias, denuncias y actualizaciones sin censura directamente en tu correo electrónico.
        </p>

        {error && (
          <p className="text-red-300 text-sm mb-4">{error}</p>
        )}

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Tu correo electrónico"
            className="w-full px-4 py-3 border border-white/20 rounded-md bg-white/10 text-white placeholder-gray-300 mb-4"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button
            type="submit"
            className="w-full bg-red-600 hover:bg-red-700 text-black py-3 rounded-md font-semibold transition"
          >
            Suscribirme
          </button>
        </form>

        <p className="mt-6 text-sm text-gray-300">
          *Tu correo está protegido. No compartimos tu información con terceros.
        </p>
      </div>
    </main>
  );
}
