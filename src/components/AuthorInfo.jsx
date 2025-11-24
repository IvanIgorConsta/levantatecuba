// components/AuthorInfo.jsx
import React from "react";

export default function AuthorInfo({ name, nickname, imageUrl, fecha }) {
  const autor = nickname || name;

  return (
    <div className="flex items-center gap-3 text-sm text-gray-300">
      {imageUrl && (
        <img
          src={imageUrl}
          alt="Autor"
          className="w-8 h-8 rounded-full object-cover border border-gray-500"
        />
      )}
      <div>
        <p className="font-semibold text-white">{autor}</p>
        <p className="text-xs text-gray-400">{new Date(fecha).toLocaleDateString()}</p>
      </div>
    </div>
  );
}
