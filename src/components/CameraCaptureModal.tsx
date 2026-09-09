import React, { useState, useEffect, useRef } from 'react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageDataUrl: string) => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isInitializing, setIsInitializing] = useState(false);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const startCamera = async (facing: 'environment' | 'user') => {
    stopCamera();
    setPermissionError(null);
    setIsInitializing(true);

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err: any) {
      console.error('카메라 권한 및 스트림 에러:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionError('카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주셔야 직접 촬영이 가능합니다.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setPermissionError('사용 가능한 카메라 장치를 찾을 수 없습니다.');
      } else {
        setPermissionError('카메라를 작동할 수 없습니다: ' + (err.message || '알 수 없는 오류'));
      }
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  if (!isOpen) return null;

  const handleCapturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      stopCamera();
      onCapture(dataUrl);
      onClose();
    }
  };

  const toggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs animate-fade-in">
      <div className="bg-[#1E2619] border border-[#3E4C27] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl text-white flex flex-col">
        {/* 모달 헤더 */}
        <div className="p-4 bg-[#2A3423] border-b border-[#3E4C27] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#4A5833] flex items-center justify-center text-emerald-300">
              <i className="fa-solid fa-camera text-xs"></i>
            </div>
            <div>
              <h3 className="text-sm font-black text-white">카메라 직접 촬영</h3>
              <p className="text-[10px] text-gray-300">카메라 권한을 동의 후 촬영하실 수 있습니다.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-300 hover:text-white transition cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        {/* 카메라 뷰포트 / 에러 상태 */}
        <div className="relative aspect-4/3 bg-black flex items-center justify-center overflow-hidden">
          {permissionError ? (
            <div className="p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 mx-auto flex items-center justify-center text-xl">
                <i className="fa-solid fa-camera-rotate"></i>
              </div>
              <p className="text-xs text-red-300 font-bold leading-relaxed">{permissionError}</p>
              <button
                type="button"
                onClick={() => startCamera(facingMode)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow-md cursor-pointer"
              >
                <i className="fa-solid fa-rotate-right mr-1.5"></i> 권한 재요청 / 다시 시도
              </button>
            </div>
          ) : (
            <>
              {isInitializing && (
                <div className="absolute inset-0 z-10 bg-black/60 flex flex-col items-center justify-center gap-2">
                  <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs text-emerald-300 font-bold">카메라 준비 중...</span>
                </div>
              )}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
              />
            </>
          )}
        </div>

        {/* 컨트롤 버튼 */}
        <div className="p-4 bg-[#2A3423] border-t border-[#3E4C27] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={toggleFacingMode}
            disabled={!!permissionError || isInitializing}
            className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-40 cursor-pointer shrink-0"
          >
            <i className="fa-solid fa-repeat text-xs"></i>
            <span>{facingMode === 'environment' ? '전면 카메라' : '후면 카메라'}</span>
          </button>

          <button
            type="button"
            onClick={handleCapturePhoto}
            disabled={!stream || !!permissionError || isInitializing}
            className="flex-1 py-3 bg-[#88A386] hover:bg-[#728C70] text-[#1E2619] font-black text-sm rounded-xl transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-40 active:scale-98 cursor-pointer"
          >
            <i className="fa-solid fa-camera text-base"></i>
            <span>사진 촬영하기</span>
          </button>
        </div>
      </div>
    </div>
  );
};
