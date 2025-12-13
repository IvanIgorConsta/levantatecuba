// src/admin_dashboard/redactor_ia/RedactorIA.jsx
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, Sparkles, Settings } from 'lucide-react';
import ColaTemas from './ColaTemas';
import BorradoresIA from './BorradoresIA';
import ConfiguracionIA from './ConfiguracionIA';

export default function RedactorIA() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Leer tab inicial desde query param (?tab=borradores)
  const getInitialTab = () => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['cola', 'borradores', 'config'].includes(tabParam)) {
      return tabParam;
    }
    return 'cola';
  };
  
  const [activeTab, setActiveTab] = useState(getInitialTab);
  
  // Actualizar URL cuando cambia el tab
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    navigate(`/admin/redactor-ia?tab=${tabId}`, { replace: true });
  };

  const tabs = [
    { id: 'cola', label: 'Cola de Temas', icon: BookOpen },
    { id: 'borradores', label: 'Borradores IA', icon: Sparkles },
    { id: 'config', label: 'Configuración', icon: Settings }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-white">
      {/* Header */}
      <div className="sticky top-[0px] z-40 bg-zinc-900/85 backdrop-blur supports-[backdrop-filter]:bg-zinc-900/60 border-b border-zinc-800">
        <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 2xl:px-10 py-4 sm:py-6 lg:py-4">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
            <div className="flex items-center gap-3">
              <Sparkles className="text-cyan-400" size={28} />
              <h1 className="text-2xl sm:text-3xl font-bold">Redactor IA</h1>
            </div>
          </div>
          <p className="text-sm sm:text-base text-zinc-400">
            Automatizador de Noticias — Escaneo inteligente y generación asistida
          </p>
        </div>

        {/* Tabs */}
        <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 2xl:px-10 py-3">
          <div className="relative flex items-center gap-2 sm:gap-3 overflow-hidden overflow-x-auto lg:overflow-visible no-scrollbar px-1" role="tablist" aria-label="Pestañas Redactor IA">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={`shrink-0 rounded-xl px-3 sm:px-4 lg:px-5 xl:px-6 h-10 lg:h-11 xl:h-12 flex items-center justify-center gap-2 text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-cyan-600 text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/70'
                  }`}
                >
                  <Icon size={16} />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 2xl:px-10 pt-[96px] lg:pt-[104px] pb-6">
        {activeTab === 'cola' && <ColaTemas />}
        {activeTab === 'borradores' && <BorradoresIA />}
        {activeTab === 'config' && <ConfiguracionIA />}
      </div>
    </div>
  );
}
