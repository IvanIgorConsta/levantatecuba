import React from 'react';

export default function IdeaCentral({ text }) {
  if (!text) return null;
  return (
    <section
      aria-label="Idea central"
      className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-sm"
    >
      <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-sky-900/30 text-sky-300 border border-sky-800 px-2.5 py-0.5 text-xs font-medium">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-400" />
        Idea central
      </div>
      <p className="text-[15px] leading-7 text-zinc-200 italic">
        {text}
      </p>
    </section>
  );
}
