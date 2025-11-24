import { Link } from "react-router-dom";

export default function BackLink({ to = "/", label = "Volver", className = "" }) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-2 text-white/80 hover:text-white transition-all duration-200 mb-6 font-semibold bg-white/10 border border-white/10 px-4 py-2 rounded-lg hover:bg-white/20 ${className}`}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      {label}
    </Link>
  );
}
