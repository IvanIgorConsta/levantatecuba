// src/components/BackButton.jsx
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";

export default function BackButton({ label = "Volver", fallbackTo = "/" }) {
  const navigate = useNavigate();
  
  const handleClick = (e) => {
    e.preventDefault();
    
    // Intentar ir atrás en el historial
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      // Fallback si no hay historial
      navigate(fallbackTo);
    }
  };
  
  return (
    <button 
      onClick={handleClick} 
      className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:text-white transition-all duration-200"
    >
      <ArrowLeft size={16} />
      {label}
    </button>
  );
}

BackButton.propTypes = {
  label: PropTypes.string,
  fallbackTo: PropTypes.string,
};

