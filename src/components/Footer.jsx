import React from "react";

export default function Footer() {
  return (
    <footer className="bg-red-800 text-white py-6">
      <div className="max-w-6xl mx-auto px-4">
        <p className="text-sm text-center font-medium">
          © {new Date().getFullYear()} LevántateCuba. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
