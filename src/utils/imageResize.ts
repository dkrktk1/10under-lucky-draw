/**
 * Resizes and compresses an uploaded image file via an offscreen Canvas
 * so it fits comfortably in localStorage without QuotaExceededError.
 */
export function resizeImageFileToDataUrl(
  file: File,
  options: {
    maxSize: number;
    quality?: number;
    squareCrop?: boolean;
  }
): Promise<string> {
  const { maxSize, quality = 0.82, squareCrop = false } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('이미지 파일을 읽을 수 없습니다.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('지원되지 않는 이미지 형식입니다.'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('브라우저 캔버스를 초기화할 수 없습니다.'));
          return;
        }

        if (squareCrop) {
          const side = Math.min(img.width, img.height);
          const sx = (img.width - side) / 2;
          const sy = (img.height - side) / 2;
          const target = Math.min(maxSize, side);
          canvas.width = target;
          canvas.height = target;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, sx, sy, side, side, 0, 0, target, target);
        } else {
          let { width, height } = img;
          if (width > maxSize || height > maxSize) {
            if (width >= height) {
              height = Math.round((height * maxSize) / width);
              width = maxSize;
            } else {
              width = Math.round((width * maxSize) / height);
              height = maxSize;
            }
          }
          canvas.width = width;
          canvas.height = height;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
        }

        try {
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        } catch {
          reject(new Error('이미지 압축 처리 중 오류가 발생했습니다.'));
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
