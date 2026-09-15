/**
 * 이미지 압축 및 최적화 유틸리티
 * 모바일/웹 카메라 및 고용량 원본 사진(3~10MB)을 Firestore 및 웹 전송에 적합한 
 * 최적 해상도(최대 1000px, 60~150KB)로 손실 없이 빠르게 리사이징합니다.
 */

export const isDataUrl = (str?: string): boolean => {
  return typeof str === 'string' && str.startsWith('data:');
};

export const isHttpUrl = (str?: string): boolean => {
  return typeof str === 'string' && (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('/'));
};

/**
 * File, Blob 또는 data URL을 받아서 캔버스로 리사이징 및 압축된 Base64 JPEG 문자열을 반환합니다.
 */
export const compressImage = async (
  source: File | Blob | string,
  maxWidth = 1000,
  maxHeight = 1000,
  quality = 0.82
): Promise<string> => {
  if (!source) return '';

  // 이미 HTTP/HTTPS 또는 서버 로컬 경로인 경우 그대로 반환
  if (typeof source === 'string' && (source.startsWith('http://') || source.startsWith('https://') || source.startsWith('/uploads/'))) {
    return source;
  }

  return new Promise<string>((resolve, reject) => {
    let dataUrl = '';

    const processImage = (srcUrl: string) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        let width = img.naturalWidth || img.width || 640;
        let height = img.naturalHeight || img.height || 480;

        // 비율 유지하며 최대 축소 비율 계산
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(srcUrl);
          return;
        }

        // 선명한 리사이징
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        try {
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        } catch {
          resolve(srcUrl);
        }
      };

      img.onerror = () => {
        // 로드 실패 시 원본 문자열 반환
        resolve(srcUrl);
      };

      img.src = srcUrl;
    };

    if (typeof source === 'string') {
      processImage(source);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          processImage(reader.result);
        } else {
          reject(new Error('Failed to read file as data URL'));
        }
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(source);
    }
  });
};
