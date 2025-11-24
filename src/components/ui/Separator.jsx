// src/components/ui/Separator.jsx
export default function Separator({ className = "" }) {
  return (
    <div
      className={
        "w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent " +
        "my-4 md:my-8 " + className
      }
      role="separator"
      aria-hidden="true"
    />
  );
}
