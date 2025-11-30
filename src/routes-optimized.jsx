// src/routes-optimized.jsx
// ✅ VERSIÓN OPTIMIZADA con Lazy Loading y Code Splitting
import { Routes, Route, lazy, Suspense } from "react-router-dom";
import { getStoreMode } from "./lib/runtimeConfig";

// ========================================================================
// PÁGINAS CRÍTICAS (Carga inmediata - bundle principal)
// ========================================================================
// Solo Home y componentes de fallback se cargan inmediatamente
import Home from "./pages/Home";
import PrivateRoute from "./components/PrivateRoute";

// ========================================================================
// LAZY LOADING - Páginas públicas
// ========================================================================
const About = lazy(() => import("./pages/About"));
// Suscribete eliminado
const Denuncias = lazy(() => import("./pages/Denuncias"));
const Noticias = lazy(() => import("./pages/Noticias"));
const NoticiaDetalle = lazy(() => import("./pages/NoticiaDetalle"));
const HacerDenuncia = lazy(() => import("./pages/HacerDenuncia"));
// Contacto eliminado
const Donar = lazy(() => import("./pages/Donar"));
const DonateSuccess = lazy(() => import("./pages/DonateSuccess"));
const DonateCancel = lazy(() => import("./pages/DonateCancel"));
const Tienda = lazy(() => import("./pages/Tienda"));
const ProductoDetalle = lazy(() => import("./pages/ProductoDetalle"));
const Gone410 = lazy(() => import("./pages/Gone410"));

// ========================================================================
// LAZY LOADING - Autenticación
// ========================================================================
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const LoginUsuario = lazy(() => import("./pages/LoginUsuario"));
const RegisterUsuario = lazy(() => import("./pages/RegisterUsuario"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

// ========================================================================
// LAZY LOADING - Admin (chunk separado)
// ========================================================================
const Login = lazy(() => import("./admin_dashboard/Login"));
const Dashboard = lazy(() => import("./admin_dashboard/Dashboard"));

// ========================================================================
// LAZY LOADING CONDICIONAL - Debug (solo en desarrollo)
// ========================================================================
const EnvDebug = import.meta.env.DEV 
  ? lazy(() => import("./pages/EnvDebug"))
  : null;

// ========================================================================
// COMPONENTE DE LOADING (Fallback mientras carga lazy)
// ========================================================================
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-950">
      <div className="flex flex-col items-center gap-4">
        {/* Spinner animado */}
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-zinc-400 text-sm">Cargando...</p>
      </div>
    </div>
  );
}

// ========================================================================
// ROUTER PRINCIPAL CON SUSPENSE
// ========================================================================
export default function AppRoutes() {
  const storeMode = getStoreMode();
  
  // Solo log en desarrollo
  if (import.meta.env.DEV) {
    console.log("[routes] storeMode =", storeMode);
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Home - Carga inmediata (crítica) */}
        <Route path="/" element={<Home />} />
        
        {/* Páginas públicas - Lazy load */}
        <Route path="/about" element={<About />} />
        {/* /suscribete eliminado */}
        <Route path="/denuncias" element={<Denuncias />} />
        <Route path="/noticias" element={<Noticias />} />
        <Route path="/noticias/:id" element={<NoticiaDetalle />} />
        <Route path="/denuncias/nueva" element={<HacerDenuncia />} />
        
        {/* Rutas 410 - Contenido retirado permanentemente */}
        <Route 
          path="/videos" 
          element={
            <Gone410 
              title="Videos" 
              message="La sección de videos ha sido retirada de la plataforma."
            />
          } 
        />
        <Route 
          path="/podcast" 
          element={
            <Gone410 
              title="Podcast" 
              message="La sección de podcast ha sido retirada de la plataforma."
            />
          } 
        />
        
        {/* Tienda - Lazy load */}
        <Route path="/tienda" element={<Tienda />} />
        <Route path="/tienda/:handle" element={<ProductoDetalle />} />
        
        {/* Debug - Solo en desarrollo */}
        {import.meta.env.DEV && EnvDebug && (
          <Route path="/__env" element={<EnvDebug />} />
        )}
        
        {/* Contacto y Donaciones */}
        {/* /contacto eliminado */}
        <Route path="/donar" element={<Donar />} />
        <Route path="/donar/success" element={<DonateSuccess />} />
        <Route path="/donar/cancel" element={<DonateCancel />} />

        {/* Auth pública - Lazy load */}
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/login" element={<LoginUsuario />} />
        <Route path="/registro" element={<RegisterUsuario />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        
        {/* Admin - Lazy load con PrivateRoute */}
        <Route path="/admin/login" element={<Login />} />
        <Route
          path="/admin/*"
          element={
            <PrivateRoute requireAdmin={true}>
              <Dashboard />
            </PrivateRoute>
          }
        />
      </Routes>
    </Suspense>
  );
}
