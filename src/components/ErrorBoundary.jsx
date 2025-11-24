// src/components/ErrorBoundary.jsx
import { Component } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

/**
 * ErrorBoundary - Captura errores de React y muestra UI de fallback
 * 
 * Uso:
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    // Actualizar estado para mostrar fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log del error
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
      errorCount: this.state.errorCount + 1
    });

    // Enviar error a servicio de logging (opcional)
    if (import.meta.env.PROD) {
      this.logErrorToService(error, errorInfo);
    }
  }

  logErrorToService = (error, errorInfo) => {
    // Implementar logging a Sentry, LogRocket, etc.
    // Por ahora solo log en consola
    try {
      const errorData = {
        message: error.toString(),
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent
      };

      // Enviar a tu endpoint de logging
      fetch('/api/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorData)
      }).catch(err => console.error('Failed to log error:', err));
    } catch (loggingError) {
      console.error('Error while logging:', loggingError);
    }
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // UI de fallback personalizada
      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-zinc-900 rounded-xl border border-zinc-800 p-8 text-center">
            {/* Icono de error */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-red-600/10 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </div>

            {/* Título */}
            <h1 className="text-2xl font-bold text-zinc-100 mb-2">
              Algo salió mal
            </h1>

            {/* Mensaje */}
            <p className="text-zinc-400 mb-6">
              Lo sentimos, ocurrió un error inesperado. 
              {this.state.errorCount > 2 && (
                <span className="block mt-2 text-red-400 text-sm">
                  El error persiste. Por favor, recarga la página.
                </span>
              )}
            </p>

            {/* Detalles del error (solo en desarrollo) */}
            {import.meta.env.DEV && this.state.error && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-zinc-500 text-sm mb-2 hover:text-zinc-400">
                  Detalles técnicos (desarrollo)
                </summary>
                <div className="bg-zinc-950 rounded p-3 text-xs font-mono text-red-400 overflow-auto max-h-48">
                  <div className="mb-2">
                    <strong>Error:</strong> {this.state.error.toString()}
                  </div>
                  {this.state.error.stack && (
                    <div>
                      <strong>Stack:</strong>
                      <pre className="mt-1 whitespace-pre-wrap">
                        {this.state.error.stack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* Acciones */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Intentar de nuevo
              </button>
              
              <button
                onClick={this.handleGoHome}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium rounded-lg transition-colors"
              >
                <Home className="w-4 h-4" />
                Ir al inicio
              </button>
            </div>

            {/* Footer */}
            <p className="mt-6 text-xs text-zinc-600">
              Si el problema persiste, contacta al equipo de soporte.
            </p>
          </div>
        </div>
      );
    }

    // Si no hay error, renderizar children normalmente
    return this.props.children;
  }
}

/**
 * Hook para usar ErrorBoundary con renderizado condicional
 * (Alternativa funcional - requiere react-error-boundary package)
 */
export function useErrorHandler() {
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return setError;
}
