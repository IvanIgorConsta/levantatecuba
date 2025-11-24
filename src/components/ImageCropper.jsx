// src/components/ImageCropper.jsx
import React, { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import getCroppedImg from "./utils/cropImage";
import { Button } from "@/components/ui/button";

export default function ImageCropper({ imageSrc, onCropComplete, onCancel }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  const handleCropComplete = useCallback(async (croppedArea, croppedPixels) => {
    const croppedImage = await getCroppedImg(imageSrc, croppedPixels);
    onCropComplete(croppedImage);
  }, [imageSrc, onCropComplete]);

  return (
    <div className="relative w-full h-[400px] bg-black">
      <Cropper
        image={imageSrc}
        crop={crop}
        zoom={zoom}
        aspect={16 / 9}
        onCropChange={setCrop}
        onZoomChange={setZoom}
        onCropComplete={handleCropComplete}
      />
      <div className="flex justify-center mt-4 gap-4">
        <Button onClick={() => handleCropComplete()} variant="default">Usar recorte</Button>
        <Button onClick={onCancel} variant="destructive">Cancelar</Button>
      </div>
    </div>
  );
}
