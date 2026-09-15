/**
 * API 요청 기본 URL 설정 및 헬퍼 함수
 * 
 * 1. Vercel 등 외부 배포 환경:
 *    - VITE_API_URL 또는 NEXT_PUBLIC_API_URL 환경 변수를 설정하여 백엔드 절대 경로 지정
 *      (예: https://ais-dev-6g2rzes7bihsrybhyuakhl-241925518437.asia-northeast1.run.app)
 * 
 * 2. 로컬 개발 또는 Vercel 단일 배포 (서버리스 함수 포함) 환경:
 *    - 환경 변수가 비어 있으면 기존과 동일하게 상대 경로('/api/...')를 사용하여 프록시/리라이트와 완벽 호환
 */

export const API_BASE_URL: string = (
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.NEXT_PUBLIC_API_URL) ||
  ''
).replace(/\/+$/, '');

/**
 * 상대 엔드포인트(예: '/api/auth/login')를 실제 호출할 URL로 변환합니다.
 */
export const getApiUrl = (endpoint: string): string => {
  if (!endpoint) return '';
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${cleanEndpoint}`;
};

/**
 * 업로드된 이미지 및 정적 에셋 경로를 변환합니다.
 */
export const getAssetUrl = (url?: string): string => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  if (url.startsWith('/uploads') || url.startsWith('/avatars')) {
    return `${API_BASE_URL}${url}`;
  }
  return url;
};

/**
 * JSON 파싱 에러 방지 헬퍼
 * - HTML 404/500 응답 수신 시 "SyntaxError: Unexpected token 'T'" 대신 명확한 에러 메시지를 제공합니다.
 */
export async function parseJsonResponse<T = any>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  const text = await res.text();
  const preview = text.slice(0, 100).trim();
  throw new Error(
    `서버에서 올바른 JSON 대신 상태 ${res.status} 응답을 반환했습니다. (${preview || '내용 없음'})\nVITE_API_URL 환경변수 및 백엔드 서버 상태를 확인해 주세요.`
  );
}
