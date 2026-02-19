import { useState, useRef, useCallback, useEffect } from 'react';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import styles from './ImageCropModal.module.css';

interface ImageCropModalProps {
  imageSrc: string;
  onCropComplete: (croppedImageBlob: Blob) => void;
  onClose: () => void;
}

type FillMode = 'transparent' | 'blur';

function centerFreeCrop(mediaWidth: number, mediaHeight: number): Crop {
  // Start with 80% of the smaller dimension, centered
  const size = Math.min(mediaWidth, mediaHeight) * 0.8;
  const widthPercent = (size / mediaWidth) * 100;
  const heightPercent = (size / mediaHeight) * 100;

  return {
    unit: '%',
    x: (100 - widthPercent) / 2,
    y: (100 - heightPercent) / 2,
    width: widthPercent,
    height: heightPercent,
  };
}

export function ImageCropModal({ imageSrc, onCropComplete, onClose }: ImageCropModalProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const mouseDownOnOverlay = useRef(false);
  const [crop, setCrop] = useState<Crop>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [fillMode, setFillMode] = useState<FillMode>('transparent');
  const [lockAspect, setLockAspect] = useState(false);
  const [padding, setPadding] = useState(0); // 0-50% padding around the logo

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerFreeCrop(width, height));
  }, []);

  // Track where mousedown started
  const handleOverlayMouseDown = (e: React.MouseEvent) => {
    // Check if the click is directly on the overlay (not on modal content)
    if (e.target === e.currentTarget) {
      mouseDownOnOverlay.current = true;
    } else {
      mouseDownOnOverlay.current = false;
    }
  };

  // Only close if mousedown AND mouseup both happened on overlay
  const handleOverlayMouseUp = (e: React.MouseEvent) => {
    if (mouseDownOnOverlay.current && e.target === e.currentTarget) {
      onClose();
    }
    mouseDownOnOverlay.current = false;
  };

  // Update preview canvas whenever crop or padding changes
  useEffect(() => {
    if (!crop || !imgRef.current || !previewCanvasRef.current) return;

    const image = imgRef.current;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Preview size
    const previewSize = 64;
    canvas.width = previewSize;
    canvas.height = previewSize;

    // Calculate pixel crop values from percentage
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const pixelCrop = {
      x: (crop.x / 100) * image.width * scaleX,
      y: (crop.y / 100) * image.height * scaleY,
      width: (crop.width / 100) * image.width * scaleX,
      height: (crop.height / 100) * image.height * scaleY,
    };

    // Clear canvas
    ctx.clearRect(0, 0, previewSize, previewSize);

    // Calculate how to fit the crop into a square, with padding
    const paddingFactor = 1 - (padding / 100);
    const cropAspect = pixelCrop.width / pixelCrop.height;
    let drawWidth: number, drawHeight: number, drawX: number, drawY: number;

    if (cropAspect > 1) {
      drawWidth = previewSize * paddingFactor;
      drawHeight = (previewSize * paddingFactor) / cropAspect;
    } else {
      drawHeight = previewSize * paddingFactor;
      drawWidth = (previewSize * paddingFactor) * cropAspect;
    }

    drawX = (previewSize - drawWidth) / 2;
    drawY = (previewSize - drawHeight) / 2;

    // Fill background based on mode
    if (fillMode === 'blur') {
      ctx.filter = 'blur(8px)';
      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        -8,
        -8,
        previewSize + 16,
        previewSize + 16
      );
      ctx.filter = 'none';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, previewSize, previewSize);
    }

    // Draw the cropped image
    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      drawX,
      drawY,
      drawWidth,
      drawHeight
    );
  }, [crop, padding, fillMode, imageSrc]);

  const handleCropComplete = async () => {
    if (!imgRef.current || !crop) return;

    setIsProcessing(true);

    try {
      const image = imgRef.current;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('No 2d context');
      }

      // Calculate pixel crop values from percentage
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;

      const pixelCrop = {
        x: (crop.x / 100) * image.width * scaleX,
        y: (crop.y / 100) * image.height * scaleY,
        width: (crop.width / 100) * image.width * scaleX,
        height: (crop.height / 100) * image.height * scaleY,
      };

      // Output size - 200x200 for a good quality logo
      const outputSize = 200;
      canvas.width = outputSize;
      canvas.height = outputSize;

      // Calculate how to fit the crop into a square, with padding
      const paddingFactor = 1 - (padding / 100);
      const cropAspect = pixelCrop.width / pixelCrop.height;
      let drawWidth: number, drawHeight: number, drawX: number, drawY: number;

      if (cropAspect > 1) {
        drawWidth = outputSize * paddingFactor;
        drawHeight = (outputSize * paddingFactor) / cropAspect;
      } else {
        drawHeight = outputSize * paddingFactor;
        drawWidth = (outputSize * paddingFactor) * cropAspect;
      }

      drawX = (outputSize - drawWidth) / 2;
      drawY = (outputSize - drawHeight) / 2;

      // Fill background based on mode
      if (fillMode === 'blur') {
        ctx.filter = 'blur(20px)';
        ctx.drawImage(
          image,
          pixelCrop.x,
          pixelCrop.y,
          pixelCrop.width,
          pixelCrop.height,
          -20,
          -20,
          outputSize + 40,
          outputSize + 40
        );
        ctx.filter = 'none';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(0, 0, outputSize, outputSize);
      }

      // Draw the cropped image centered with padding
      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        drawX,
        drawY,
        drawWidth,
        drawHeight
      );

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            onCropComplete(blob);
          }
          setIsProcessing(false);
        },
        'image/png',
        1
      );
    } catch (err) {
      console.error('Error cropping image:', err);
      setIsProcessing(false);
    }
  };

  return (
    <div
      className={styles.overlay}
      onMouseDown={handleOverlayMouseDown}
      onMouseUp={handleOverlayMouseUp}
    >
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>Crop Logo</h3>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close">
            x
          </button>
        </div>

        <div className={styles.content}>
          <p className={styles.instructions}>
            Select the logo area. Use padding to add space around it.
          </p>

          <div className={styles.cropContainer}>
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              aspect={lockAspect ? 1 : undefined}
              className={styles.cropper}
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Crop preview"
                onLoad={onImageLoad}
                className={styles.image}
              />
            </ReactCrop>
          </div>

          <div className={styles.options}>
            <label className={styles.optionLabel}>
              <input
                type="checkbox"
                checked={lockAspect}
                onChange={(e) => setLockAspect(e.target.checked)}
              />
              <span>Lock to square</span>
            </label>

            <div className={styles.fillModeGroup}>
              <span className={styles.fillModeLabel}>Fill:</span>
              <button
                type="button"
                className={`${styles.fillModeButton} ${fillMode === 'transparent' ? styles.fillModeActive : ''}`}
                onClick={() => setFillMode('transparent')}
              >
                Transparent
              </button>
              <button
                type="button"
                className={`${styles.fillModeButton} ${fillMode === 'blur' ? styles.fillModeActive : ''}`}
                onClick={() => setFillMode('blur')}
              >
                Blur
              </button>
            </div>
          </div>

          <div className={styles.paddingControl}>
            <label className={styles.paddingLabel}>
              <span>Padding: {padding}%</span>
              <input
                type="range"
                min="0"
                max="50"
                value={padding}
                onChange={(e) => setPadding(Number(e.target.value))}
                className={styles.paddingSlider}
              />
            </label>
          </div>

          <div className={styles.preview}>
            <span className={styles.previewLabel}>Preview:</span>
            <div className={`${styles.previewCircle} ${fillMode === 'transparent' ? styles.previewTransparent : ''}`}>
              <canvas
                ref={previewCanvasRef}
                className={styles.previewCanvas}
                width={64}
                height={64}
              />
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.confirmButton}
            onClick={handleCropComplete}
            disabled={isProcessing || !crop}
          >
            {isProcessing ? 'Processing...' : 'Apply Crop'}
          </button>
        </div>
      </div>
    </div>
  );
}
