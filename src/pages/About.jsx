export default function About() {
  return (
    <main className="p-6 md:p-12 min-h-screen bg-transparent text-gray-800">
      <div className="max-w-3xl mx-auto bg-white shadow-md rounded-xl p-8">
        <h1 className="text-3xl md:text-4xl font-bold text-red-700 mb-6">
          Sobre el creador
        </h1>

        <p className="mb-4 text-lg">
          Este sitio web, <strong>levantatecuba.com</strong>, ha sido creado y desarrollado por mí,
          <strong> Ivan Igor Constantin</strong>, como una plataforma de activismo y denuncia
          contra la dictadura cubana.
        </p>

        <p className="mb-4 text-lg">
          Mi intención es visibilizar las injusticias, amplificar las voces del pueblo oprimido y
          documentar los abusos del régimen en tiempo real. Esta página forma parte de mi esfuerzo
          por defender la libertad de expresión y los derechos humanos.
        </p>

        <p className="mb-4 text-lg">
          Soy el autor legítimo del código fuente, diseño, contenido visual y estrategia de
          comunicación de este sitio web. Puedo demostrar su autoría técnica y conceptual ante
          cualquier instancia legal.
        </p>

        <p className="mb-4 text-lg italic text-gray-600">
          “Mientras exista opresión, existirán voces que se levanten.”
        </p>

        <p className="text-sm text-gray-500">
          Última actualización: {new Date().toLocaleDateString()}
        </p>
      </div>
    </main>
  );
}
