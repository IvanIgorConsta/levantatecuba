// src/admin_dashboard/components/NewsForm.jsx
import React, { useState } from "react";
import { RichTextEditor } from "@mantine/rte";
import ImageUpload from "./ImageUpload";
import Cropper from "react-easy-crop";
import { getCroppedImg } from "@utils/cropImage"; // ✅ usando alias definido en vite.config.js
import { v4 as uuidv4 } from "uuid";
import URLDraftGenerator from "./URLDraftGenerator";

export default function NewsForm({
  form,
  setForm,
  editId,
  autorVisible,
  fileInputRef,
  optionalImageRef,
  imagenOpcionalPreview,
  handleInputChange,
  handleImageChange,
  handleOptionalImageChange,
  handleRemoveOptionalImage,
  handleContentChange,
  handleSubmit,
  handleCancelEdit,
  isUploadingAIMain = false,
  isUploadingAIOptional = false,
}) {
  const [cropData, setCropData] = useState({
    imageSrc: null,
    crop: { x: 0, y: 0 },
    zoom: 1,
    croppedAreaPixels: null,
    cropping: false,
  });

  const formularioActivo = () =>
    form.titulo !== "" ||
    form.contenido !== "" ||
    form.imagen !== null ||
    form.imagenPreview !== null ||
    imagenOpcionalPreview !== null ||
    form.destacada;

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCropData((prev) => ({
          ...prev,
          imageSrc: reader.result,
          cropping: true,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = (_, croppedAreaPixels) => {
    setCropData((prev) => ({ ...prev, croppedAreaPixels }));
  };

  const handleCropConfirm = async () => {
    const croppedImage = await getCroppedImg(
      cropData.imageSrc,
      cropData.croppedAreaPixels,
      uuidv4() + ".jpeg"
    );
    setForm((prev) => ({
      ...prev,
      imagen: croppedImage.file,
      imagenPreview: croppedImage.url,
    }));
    setCropData({
      imageSrc: null,
      crop: { x: 0, y: 0 },
      zoom: 1,
      croppedAreaPixels: null,
      cropping: false,
    });
  };

  const handleCropCancel = () => {
    setCropData({
      imageSrc: null,
      crop: { x: 0, y: 0 },
      zoom: 1,
      croppedAreaPixels: null,
      cropping: false,
    });
  };

  const handleDraftGenerated = (draft) => {
    // Actualizar solo campos de texto, NO tocar imágenes
    setForm((prev) => ({
      ...prev,
      titulo: draft.titulo || prev.titulo,
      categoria: draft.categoria || prev.categoria,
      contenido: draft.contenidoHtml || prev.contenido,
      // Si hay bajada/lead, podrías agregarlo al inicio del contenido o ignorarlo
    }));
    
    // Mostrar confirmación visual
    console.log("[NewsForm] Borrador desde URL aplicado:", draft.titulo);
  };

  return (
    <>
      {cropData.cropping && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center z-50">
          <div className="relative w-80 h-80 bg-zinc-900 rounded border border-zinc-800 shadow">
            <Cropper
              image={cropData.imageSrc}
              crop={cropData.crop}
              zoom={cropData.zoom}
              aspect={16 / 9}
              onCropChange={(crop) =>
                setCropData((prev) => ({ ...prev, crop }))
              }
              onZoomChange={(zoom) =>
                setCropData((prev) => ({ ...prev, zoom }))
              }
              onCropComplete={handleCropComplete}
            />
          </div>
          <div className="mt-4 flex gap-4">
            <button
              onClick={handleCropConfirm}
              className="btn-primary"
            >
              Confirmar recorte
            </button>
            <button
              onClick={handleCropCancel}
              className="btn-ghost"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <form
        id="form-news"
        onSubmit={handleSubmit}
        className="admin-card p-5 mb-10 space-y-4"
      >
        <div className="grid md:grid-cols-2 gap-4">
          <input
            type="text"
            name="titulo"
            value={form.titulo}
            onChange={handleInputChange}
            placeholder="Título"
            className="admin-input"
            required
          />
          <select
            name="categoria"
            value={form.categoria}
            onChange={handleInputChange}
            className="admin-select"
          >
            <option value="" disabled hidden>
              Categorías
            </option>
            <option value="General">General</option>
            <option value="Política">Política</option>
            <option value="Economía">Economía</option>
            <option value="Internacional">Internacional</option>
            <option value="Socio político">Socio político</option>
            <option value="Tecnología">Tecnología</option>
            <option value="Tendencia">Tendencia</option>
            <option value="Deporte">Deporte</option>
          </select>
        </div>

        <p className="text-zinc-400 text-base">
          Por: <span className="text-white">{form.autor || autorVisible}</span>
          {form.categoria && (
            <span className="ml-2 text-white/50">· Categoría: <span className={`${
              form.categoria === "Socio político" ? "text-red-600" :
              form.categoria === "Tecnología" ? "text-cyan-500" :
              form.categoria === "Tendencia" ? "text-orange-500" :
              form.categoria === "Deporte" ? "text-green-500" :
              "text-white/80"
            }`}>{form.categoria}</span></span>
          )}
        </p>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="destacada"
            checked={form.destacada}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, destacada: e.target.checked }))
            }
          />
          Marcar como noticia destacada
        </label>

        {/* Generador desde URL */}
        <URLDraftGenerator onDraftGenerated={handleDraftGenerated} />

       {/* Imagen principal con crop */}
        <div className="flex flex-col gap-2">
          <label className="text-white">Imagen principal (ajustar miniatura)</label>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-ghost text-sm w-fit"
          >
            Subir imagen principal
          </button>
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageUpload}
            className="hidden"
          />

          {form.imagenPreview && (
            <img
              src={form.imagenPreview}
              alt="Miniatura"
              className="w-full max-w-xl max-h-64 object-cover rounded border border-zinc-700 shadow"
              style={{ marginTop: "0.5rem" }}
            />
          )}
        </div>

        {/* Imagen opcional */}
        <ImageUpload
          fileInputRef={null}
          optionalImageRef={optionalImageRef}
          imagenPreview={null}
          imagenOpcionalPreview={imagenOpcionalPreview}
          onImageChange={() => {}}
          onOptionalImageChange={handleOptionalImageChange}
          onRemoveOptionalImage={handleRemoveOptionalImage}
        />

        <RichTextEditor
          value={form.contenido}
          onChange={handleContentChange}
          className="bg-zinc-900 text-white rounded border border-zinc-800"
        />
        {/* Programación de publicación */}
        <div className="grid gap-2 border-t border-zinc-800 pt-4">
          <label className="inline-flex items-center gap-2 text-sm text-white/90">
            <input
              type="checkbox"
              name="programar"
              checked={Boolean(form.programar)}
              onChange={handleInputChange}
              className="accent-red-600"
            />
            Publicar más tarde
          </label>

          <div className="flex items-center gap-2">
            <input
              type="datetime-local"
              name="publicarEl"
              value={form.publicarEl || ""}
              onChange={handleInputChange}
              disabled={!form.programar}
              className="admin-input disabled:opacity-50"
              style={{ textAlign: "center" }}
            />
          </div>

          <p className="text-xs text-white/50 text-center">
            La hora se toma según tu navegador (el backend guarda en UTC).
          </p>
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={!formularioActivo() || isUploadingAIMain || isUploadingAIOptional}
            className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploadingAIMain || isUploadingAIOptional 
              ? "Procesando imágenes IA..." 
              : editId ? "Actualizar" : "Publicar"}
          </button>
          {formularioActivo() && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="btn-ghost text-sm"
            >
              {editId ? "Cancelar edición" : "Cancelar publicación"}
            </button>
          )}
        </div>
      </form>
    </>
  );
}
