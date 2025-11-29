import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import useTrackPage from "../utils/useTrackPage";
import DOMPurify from "dompurify";
import { 
  UploadCloud, 
  FileVideo2, 
  Loader2, 
  X, 
  AlertCircle,
  CheckCircle,
  Image as ImageIcon,
  User,
  FileText,
  Shield,
  Eye,
  EyeOff,
  Plus,
  Paperclip,
  Megaphone,
  ListChecks
} from "lucide-react";
import { FaPaperPlane } from "react-icons/fa";
import PageHeader from "../components/PageHeader";

export default function Romper() {
  const { t } = useTranslation();
  useTrackPage();
  const navigate = useNavigate();

  const formRef = useRef(null);
  const fileInputRef = useRef(null);

  const [enviando, setEnviando] = useState(false);
  const [files, setFiles] = useState([]); // Array de archivos
  const [contenido, setContenido] = useState("");
  const [nombre, setNombre] = useState("");
  const [anonimo, setAnonimo] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState("");
  
  // Estados de validación
  const [touched, setTouched] = useState({
    contenido: false
  });

  const contenidoLen = contenido.trim().length;
  const contenidoValid = contenidoLen >= 10;
  const contenidoError = touched.contenido && !contenidoValid;
  
  // Verificar si el usuario está logueado
  const token = localStorage.getItem("token");
  const isLoggedIn = !!token;

  // Limpiar URLs de objetos al desmontar o cambiar archivos
  useEffect(() => {
    return () => {
      files.forEach(file => {
        if (file.preview) URL.revokeObjectURL(file.preview);
      });
    };
  }, [files]);

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFiles = (newFiles) => {
    setFileError("");
    
    // Validar límite total (máx 5 archivos)
    if (files.length + newFiles.length > 5) {
      setFileError("❌ Máximo 5 archivos permitidos por denuncia");
      return;
    }
    
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];
    const processedFiles = [];
    
    for (const file of newFiles) {
      // Validar tipo
      if (!validTypes.includes(file.type)) {
        setFileError(`❌ "${file.name}" - Tipo no permitido. Solo imágenes y videos.`);
        continue;
      }
      
      // Validar tamaño
      if (file.size > 15 * 1024 * 1024) {
        setFileError(`❌ "${file.name}" supera el límite de 15MB.`);
        continue;
      }
      
      // Crear preview
      const fileWithPreview = {
        file,
        preview: URL.createObjectURL(file),
        type: file.type.startsWith('image/') ? 'image' : 'video',
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(2)
      };
      
      processedFiles.push(fileWithPreview);
    }
    
    if (processedFiles.length > 0) {
      setFiles(prev => [...prev, ...processedFiles]);
    }
  };

  const removeFile = (index) => {
    setFiles(prev => {
      const newFiles = [...prev];
      // Liberar URL del preview
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
    setFileError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Marcar todos los campos como tocados
    setTouched({ contenido: true });
    
    // Verificar token
    if (!isLoggedIn) {
      toast.error("❌ Debes iniciar sesión para hacer una denuncia.");
      setTimeout(() => {
        navigate("/login?redirect=/romper");
      }, 1500);
      return;
    }

    // Validación
    if (!contenidoValid) {
      toast.error("❌ Describe tu denuncia con al menos 10 caracteres.");
      return;
    }

    const formData = new FormData();
    
    // Sanitizar y agregar datos
    const nombreFinal = anonimo ? "" : DOMPurify.sanitize(nombre.trim());
    formData.set("nombre", nombreFinal);
    formData.set("contenido", DOMPurify.sanitize(contenido.trim()));
    
    // Agregar archivos múltiples con el campo "files"
    files.forEach((fileObj) => {
      formData.append("files", fileObj.file);
    });

    try {
      setEnviando(true);
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData,
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(errorData.error || "Error al enviar denuncia");
      }

      // Limpiar formulario
      formRef.current?.reset();
      files.forEach(f => {
        if (f.preview) URL.revokeObjectURL(f.preview);
      });
      setFiles([]);
      setContenido("");
      setNombre("");
      setAnonimo(false);
      setTouched({ contenido: false });
      
      toast.success("✅ Tu denuncia fue enviada correctamente. Será revisada pronto.");
      
      // Redirigir a denuncias después de 2 segundos
      setTimeout(() => {
        navigate("/denuncias");
      }, 2000);
      
    } catch (err) {
      console.error(err);
      toast.error(err.message || "❌ Hubo un error al enviar la denuncia. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <main className="min-h-screen bg-transparent px-4 py-10 md:px-8">
        <div className="mx-auto max-w-2xl">
          <BackLink to="/" label="Volver al inicio" />
          
          <div className="mt-12 rounded-2xl border border-red-500/20 bg-red-500/10 p-8 text-center">
            <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-3">
              Acceso Restringido
            </h2>
            <p className="text-zinc-400 mb-6">
              Debes iniciar sesión para poder enviar una denuncia
            </p>
            <button
              onClick={() => navigate("/login?redirect=/romper")}
              className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition"
            >
              Iniciar Sesión
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-transparent">
      {/* Cabecera unificada */}
      <PageHeader
        breadcrumb={[
          { label: 'Inicio', href: '/' },
          { label: 'Denuncias', href: '/denuncias' },
          { label: 'Nueva denuncia' }
        ]}
        icon={Megaphone}
        title="Haz tu denuncia"
        titleHighlight="ciudadana"
        subtitle="Tu voz importa. Reporta situaciones irregulares de forma segura y anónima si lo deseas."
        bannerEmoji="📝"
        bannerTitle="Ver todas las denuncias"
        bannerText="Explora las denuncias publicadas por otros ciudadanos."
        ctaLabel="Ver denuncias"
        ctaHref="/denuncias"
        ctaIcon={ListChecks}
      />

      <div className="max-w-6xl mx-auto px-4 md:px-6 pb-10">

        {/* Formulario con diseño moderno */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 md:p-8 shadow-xl">
          <form
            id="form-report"
            ref={formRef}
            className="space-y-6"
            onSubmit={handleSubmit}
            noValidate
          >
            {/* Identificación */}
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
                <User className="w-5 h-5" />
                Identificación
              </h3>
              
              {/* Toggle anónimo */}
              <div className="flex items-center justify-between p-4 rounded-lg border border-zinc-800 bg-zinc-900/50">
                <div className="flex items-center gap-3">
                  {anonimo ? (
                    <EyeOff className="w-5 h-5 text-zinc-400" />
                  ) : (
                    <Eye className="w-5 h-5 text-zinc-400" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-white">
                      {anonimo ? "Denuncia Anónima" : "Denuncia con Nombre"}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {anonimo 
                        ? "Tu identidad permanecerá oculta" 
                        : "Tu nombre será visible en la denuncia"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAnonimo(!anonimo)}
                  className={`relative w-12 h-6 rounded-full transition ${
                    anonimo ? 'bg-red-500' : 'bg-zinc-700'
                  }`}
                >
                  <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    anonimo ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Campo nombre (solo si no es anónimo) */}
              {!anonimo && (
                <div className="grid gap-2">
                  <label htmlFor="nombre" className="text-sm font-medium text-white">
                    Tu nombre
                  </label>
                  <input
                    id="nombre"
                    name="nombre"
                    type="text"
                    placeholder="Ej: Juan Pérez"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-500 outline-none transition focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  />
                  <p className="text-xs text-zinc-500">
                    Este nombre aparecerá públicamente en tu denuncia
                  </p>
                </div>
              )}
            </div>

            {/* Descripción de la denuncia */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="contenido" className="flex items-center gap-2 text-sm font-medium text-white">
                  <FileText className="w-4 h-4" />
                  Descripción detallada
                  <span className="text-red-400">*</span>
                </label>
                <span className={`text-xs ${
                  contenidoLen === 0 
                    ? 'text-zinc-500'
                    : contenidoValid 
                      ? 'text-green-400' 
                      : 'text-yellow-400'
                }`}>
                  {contenidoLen} caracteres {contenidoLen < 10 && `(mínimo 10)`}
                </span>
              </div>
              
              <textarea
                id="contenido"
                name="contenido"
                placeholder="Describe detalladamente la situación: ¿Qué sucedió? ¿Dónde? ¿Cuándo? ¿Quiénes están involucrados? Incluye todos los detalles relevantes..."
                required
                minLength={10}
                value={contenido}
                onChange={(e) => setContenido(e.target.value)}
                onBlur={() => setTouched({ ...touched, contenido: true })}
                rows={8}
                className={`w-full resize-y rounded-lg border bg-zinc-900 px-4 py-3 text-white placeholder-zinc-500 outline-none transition ${
                  contenidoError 
                    ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                    : 'border-zinc-800 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                }`}
                aria-invalid={contenidoError}
                aria-describedby="contenido-help"
              />
              
              {contenidoError && (
                <p className="flex items-center gap-1 text-xs text-red-400">
                  <AlertCircle className="w-3 h-3" />
                  La descripción debe tener al menos 10 caracteres
                </p>
              )}
              
              <p id="contenido-help" className="text-xs text-zinc-500">
                Sé específico y objetivo. No incluyas información personal sensible que no desees hacer pública.
              </p>
            </div>

            {/* Subida de archivos múltiples */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-medium text-white">
                  <Paperclip className="w-4 h-4" />
                  Evidencia multimedia (opcional)
                </label>
                <span className="text-xs text-zinc-500">
                  {files.length}/5 archivos
                </span>
              </div>

              {/* Lista de archivos adjuntos */}
              {files.length > 0 && (
                <div className="space-y-2 mb-3">
                  {files.map((fileObj, index) => (
                    <div key={index} className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                      {/* Vista previa para imágenes */}
                      {fileObj.type === 'image' && (
                        <div className="mb-2 rounded-lg overflow-hidden bg-zinc-800">
                          <img 
                            src={fileObj.preview} 
                            alt={`Vista previa ${index + 1}`}
                            className="w-full h-32 object-cover"
                          />
                        </div>
                      )}
                      
                      {/* Vista previa para videos */}
                      {fileObj.type === 'video' && (
                        <div className="mb-2 rounded-lg overflow-hidden bg-zinc-800">
                          <video 
                            src={fileObj.preview} 
                            className="w-full h-32"
                            muted
                          />
                        </div>
                      )}
                      
                      {/* Info del archivo */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          {fileObj.type === 'video' ? (
                            <FileVideo2 className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                          ) : (
                            <ImageIcon className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-xs text-white truncate">{fileObj.name}</p>
                            <p className="text-xs text-zinc-500">{fileObj.size} MB</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="p-1 text-zinc-400 hover:text-red-400 transition"
                          title="Eliminar archivo"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Zona de drag & drop */}
              {files.length < 5 && (
                <div
                  className={`relative rounded-xl border-2 border-dashed transition-all ${
                    dragActive 
                      ? 'border-red-500 bg-red-500/10' 
                      : fileError
                        ? 'border-red-500/50 bg-red-500/5'
                        : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    name="files"
                    accept="image/*,video/*"
                    multiple
                    className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                    onChange={(e) => {
                      const newFiles = Array.from(e.target.files || []);
                      if (newFiles.length > 0) handleFiles(newFiles);
                    }}
                  />
                  
                  <div className="pointer-events-none flex flex-col items-center justify-center p-6 text-center">
                    <UploadCloud className={`h-10 w-10 mb-2 ${
                      dragActive ? 'text-red-500' : 'text-zinc-600'
                    }`} />
                    <p className="text-sm font-medium text-white mb-1">
                      {dragActive 
                        ? 'Suelta los archivos aquí' 
                        : files.length > 0
                          ? 'Agregar más archivos'
                          : 'Arrastra y suelta tus archivos aquí'}
                    </p>
                    <p className="text-xs text-zinc-500 mb-2">o haz clic para seleccionar</p>
                    <p className="text-xs text-zinc-600">
                      JPG, PNG, GIF, WEBP, MP4, MOV • Máx 15MB por archivo
                    </p>
                  </div>
                </div>
              )}
              
              {fileError && (
                <p className="flex items-center gap-1 text-xs text-red-400">
                  <AlertCircle className="w-3 h-3" />
                  {fileError}
                </p>
              )}
            </div>

            {/* Nota de privacidad */}
            <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/50">
              <div className="flex gap-3">
                <Shield className="w-5 h-5 text-zinc-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-white">Nota de privacidad</p>
                  <p className="text-xs text-zinc-500">
                    Tu denuncia será revisada por nuestros moderadores antes de ser publicada.
                    Solo se mostrarán las denuncias que cumplan con nuestras políticas de contenido.
                    {anonimo && " Tu identidad permanecerá completamente anónima."}
                  </p>
                </div>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => navigate("/denuncias")}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition"
              >
                Cancelar
              </button>
              
              <button
                type="submit"
                disabled={enviando || !contenidoValid}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition ${
                  enviando || !contenidoValid
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
              >
                {enviando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <FaPaperPlane className="h-4 w-4" />
                    Enviar Denuncia
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Footer motivacional */}
        <div className="mt-8 text-center">
          <p className="text-sm text-zinc-500 italic">
            "La injusticia en cualquier lugar es una amenaza a la justicia en todas partes"
          </p>
          <p className="text-xs text-zinc-600 mt-1">- Martin Luther King Jr.</p>
        </div>
      </div>
    </main>
  );
}