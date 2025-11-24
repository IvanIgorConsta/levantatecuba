// src/components/Separator.jsx
export default function Separator({ className = "" }) {
  return (
    <div className={`w-full h-[1px] bg-gradient-to-r from-transparent via-zinc-600 to-transparent ${className}`} />
  );
}
