import React from "react";

export default function ConfirmModal({ visible, onCancel, onConfirm, mensaje }) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white text-gray-800 px-4 py-6 rounded-lg shadow-xl w-[90%] max-w-sm animate-fade-in">
        <h2 className="text-md font-semibold mb-4 text-center">
          {mensaje || "¿Estás seguro de eliminar?"}
        </h2>
        <div className="flex justify-center gap-3">
          <button
            onClick={onCancel}
            className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}
