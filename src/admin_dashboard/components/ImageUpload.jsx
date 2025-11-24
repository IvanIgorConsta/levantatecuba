import React, { useState } from "react";
import Cropper from "react-easy-crop";
import { getCroppedImg } from "@utils/cropImage"; // ✅ Alias corregido

export default function ImageUpload({
  fileInputRef,
  optionalImageRef,
  imagenPreview,
  imagenOpcionalPreview,
  onImageChange,
  onOptionalImageChange,
  onRemoveOptionalImage,
}) {
  const isPrincipal = !!fileInputRef;
  const label = isPrincipal ? "Imagen principal" : "Imagen opcional";
  const preview = isPrincipal ? imagenPreview : imagenOpcionalPreview;

  const [showCrop, setShowCrop] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);

  const handleClick = () => {
    const input = isPrincipal ? fileInputRef?.current : optionalImageRef?.current;
    if (input) input.click();
  };

  const handleCropComplete = (_, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleCropConfirm = async () => {
    if (!selectedImage || !croppedAreaPixels) return;
    const { file, url } = await getCroppedImg(selectedImage, croppedAreaPixels, "cropped.jpg");
    onImageChange({ target: { files: [file] } });
    setSelectedImage(null);
    setShowCrop(false);
  };

  const handleImageInput = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);

    if (isPrincipal) {
      setSelectedImage(url);
      setShowCrop(true);
    } else {
      onOptionalImageChange(e);
    }
  };

  return (
    <div className="mb-4">
      <p className="mb-1 text-sm text-white font-semibold">{label}</p>

      {preview ? (
        <div className="relative w-full max-w-xs aspect-video border border-zinc-700 rounded overflow-hidden shadow-md">
          <div className="absolute top-2 right-2 flex gap-2 z-10">
            <button
              type="button"
              onClick={handleClick}
              className="bg-zinc-600 hover:bg-zinc-500 text-white px-3 py-1 text-xs rounded shadow"
            >
              Reemplazar
            </button>
            {!isPrincipal && (
              <button
                type="button"
                onClick={onRemoveOptionalImage}
                className="bg-zinc-600 hover:bg-zinc-500 text-white px-3 py-1 text-xs rounded shadow"
              >
                Quitar
              </button>
            )}
          </div>

          <img
            src={preview}
            alt="preview"
            className="w-full h-full object-contain bg-black"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-2 rounded shadow text-sm"
        >
          Subir {label}
        </button>
      )}

      <input
        type="file"
        accept="image/*"
        ref={isPrincipal ? fileInputRef : optionalImageRef}
        onChange={handleImageInput}
        className="hidden"
      />

      {/* Crop modal solo para imagen principal */}
      {showCrop && selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex justify-center items-center z-50">
          <div className="bg-zinc-900 p-4 rounded shadow-lg max-w-lg w-full space-y-4">
            <div className="relative w-full aspect-video bg-black">
              <Cropper
                image={selectedImage}
                crop={crop}
                zoom={zoom}
                aspect={16 / 9}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={handleCropComplete}
              />
            </div>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowCrop(false)}
                className="px-4 py-2 bg-zinc-700 text-white rounded"
              >
                Cancelar
              </button>
              <button
                onClick={handleCropConfirm}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded"
              >
                Usar imagen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
