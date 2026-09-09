import fs from 'fs';
import path from 'path';
import { Resvg } from '@resvg/resvg-js';

// 연세대학교 기숙사 리유즈 마켓 연근마켓 공식 배너
// "그거, 새로 살 거야? 사기 전에, 연근마켓부터!" + RC창의플랫폼 + 순환 박스 + 등록하기 버튼
const bannerSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 560" width="1200" height="560" style="background:#FAF7EE;">
  <defs>
    <!-- 배경 그림자 & 빛 효과 -->
    <filter id="boxShadow" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#4A3B32" flood-opacity="0.18" />
    </filter>
    
    <filter id="glowQ" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <linearGradient id="cyanTextGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <feStop offset="0%" stop-color="#00DFB6" />
      <feStop offset="100%" stop-color="#00EFCA" />
    </linearGradient>

    <!-- 박스 골판지 그라데이션 -->
    <linearGradient id="boxFront" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#BA9069" />
      <stop offset="100%" stop-color="#9C734D" />
    </linearGradient>
    <linearGradient id="boxRight" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#8E6641" />
      <stop offset="100%" stop-color="#6F4D2D" />
    </linearGradient>
    <linearGradient id="boxInside" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#4D331D" />
      <stop offset="100%" stop-color="#2D1D10" />
    </linearGradient>
    <linearGradient id="flapTop" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#D5AA82" />
      <stop offset="100%" stop-color="#AF855D" />
    </linearGradient>
  </defs>

  <!-- 배경 테두리 및 베이스 -->
  <rect x="2" y="2" width="1196" height="556" rx="16" fill="#FAF7EE" stroke="#EAE5D8" stroke-width="2" />

  <!-- ========================================== -->
  <!-- 1. 좌측 카피라이트 및 텍스트 영역 -->
  <!-- ========================================== -->
  <g transform="translate(75, 75)">
    <!-- RC 창의플랫폼 로고 -->
    <g transform="translate(0, 30)">
      <!-- 루트/체크 아이콘 -->
      <path d="M 0 16 L 8 16 L 14 26 L 22 2 L 32 2" fill="none" stroke="#2DD4BF" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="34" cy="5" r="2.5" fill="#2DD4BF" />
      <line x1="34" y1="12" x2="34" y2="24" stroke="#2DD4BF" stroke-width="4" stroke-linecap="round" />
      
      <!-- 텍스트: RC창의플랫폼 -->
      <text x="48" y="21" font-family="'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif" font-size="34" font-weight="900" fill="#0284C7" letter-spacing="-1">
        <tspan fill="#2DD4BF">RC</tspan><tspan fill="#0284C7">창의플랫폼</tspan>
      </text>
    </g>

    <!-- 대형 헤드카피: 그거, -->
    <text x="0" y="145" font-family="'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif" font-size="86" font-weight="900" fill="#1C1E21" letter-spacing="-3">
      그거,
    </text>
    
    <!-- 언더라인 강조선 -->
    <line x1="2" y1="165" x2="168" y2="165" stroke="#1C1E21" stroke-width="6.5" stroke-linecap="square" />

    <!-- 대형 헤드카피 2: 새로 살 거야? -->
    <text x="0" y="260" font-family="'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif" font-size="88" font-weight="900" fill="#00E5BE" letter-spacing="-3">
      새로 살 거야?
    </text>

    <!-- 서브 카피: 사기 전에, 연근마켓부터! -->
    <text x="2" y="365" font-family="'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif" font-size="34" font-weight="800" fill="#F45D5D" letter-spacing="-1">
      사기 전에, 연근마켓부터!
    </text>
  </g>

  <!-- ========================================== -->
  <!-- 2. 우측 3D 택배 상자 (순환 박스) + 물음표 -->
  <!-- ========================================== -->
  <g transform="translate(680, 50)" filter="url(#boxShadow)">
    <!-- 박스 내부 어두운 공간 -->
    <polygon points="120,70 310,70 340,170 80,170" fill="url(#boxInside)" />

    <!-- 내부에서 피어오르는 빛나는 3D 물음표 ? -->
    <g transform="translate(205, -15)" filter="url(#glowQ)">
      <path d="M -15,10 C -25,-25 5,-50 35,-50 C 65,-50 85,-25 80,5 C 75,28 50,42 42,60 C 38,70 38,85 38,92 L 18,92 C 18,80 18,65 24,52 C 34,32 58,22 60,6 C 62,-10 48,-28 32,-28 C 16,-28 6,-12 8,10 Z" fill="#FFFFFF" opacity="0.98" />
      <ellipse cx="28" cy="120" rx="12" ry="12" fill="#FFFFFF" opacity="0.98" />
    </g>

    <!-- 열린 상단 플랩 날개들 -->
    <!-- 뒤쪽 왼쪽 날개 -->
    <polygon points="120,70 80,170 0,110 40,35" fill="url(#flapTop)" stroke="#6B4B29" stroke-width="1.5" />
    <!-- 뒤쪽 오른쪽 날개 -->
    <polygon points="310,70 340,170 420,120 370,40" fill="url(#flapTop)" stroke="#6B4B29" stroke-width="1.5" />

    <!-- 앞쪽 왼쪽 플랩 날개 -->
    <polygon points="80,170 215,195 180,240 40,210" fill="url(#flapTop)" stroke="#6B4B29" stroke-width="1.5" />
    <!-- 앞쪽 오른쪽 플랩 날개 -->
    <polygon points="215,195 340,170 395,210 260,240" fill="url(#flapTop)" stroke="#6B4B29" stroke-width="1.5" />

    <!-- 박스 앞면 (Front Face) -->
    <polygon points="80,170 215,195 215,440 80,380" fill="url(#boxFront)" stroke="#5A3E22" stroke-width="1.5" />
    
    <!-- 박스 우측면 (Right Face) -->
    <polygon points="215,195 340,170 340,380 215,440" fill="url(#boxRight)" stroke="#4A321A" stroke-width="1.5" />

    <!-- 박스 위 연근마켓 라벨 스티커 (타원형) -->
    <g transform="translate(148, 290) rotate(2)">
      <!-- 베이지 타원 스티커 -->
      <ellipse cx="0" cy="0" rx="42" ry="54" fill="#E8D4BE" stroke="#D3B89B" stroke-width="2" />
      
      <!-- 초록/갈색 연근 심볼 -->
      <!-- 머리 매듭 리본 -->
      <path d="M -12 -34 C -22 -44, -5 -44, 0 -34 C 5 -44, 22 -44, 12 -34 Z" fill="none" stroke="#4B8356" stroke-width="3.5" />
      <!-- 연근 단면 원 -->
      <circle cx="0" cy="-16" r="22" fill="#D3A97F" stroke="#3D2E24" stroke-width="2.5" />
      <circle cx="-7" cy="-20" r="3.5" fill="#FFFFFF" stroke="#3D2E24" stroke-width="1.5" />
      <circle cx="7" cy="-20" r="3.5" fill="#FFFFFF" stroke="#3D2E24" stroke-width="1.5" />
      <circle cx="0" cy="-10" r="3.5" fill="#FFFFFF" stroke="#3D2E24" stroke-width="1.5" />

      <!-- 스티커 텍스트 -->
      <text x="0" y="16" font-family="'Pretendard', sans-serif" font-size="13" font-weight="900" fill="#2D2018" text-anchor="middle" letter-spacing="-0.5">연근마켓</text>
      <text x="0" y="27" font-family="'Pretendard', sans-serif" font-size="7" font-weight="700" fill="#6B5345" text-anchor="middle">YONSEI DORM</text>
      <text x="0" y="35" font-family="'Pretendard', sans-serif" font-size="6.5" font-weight="700" fill="#6B5345" text-anchor="middle">REUSE MARKET</text>
    </g>

    <!-- 박스 우측 '순환중' 사각 라벨 스티커 -->
    <g transform="translate(262, 305) rotate(-3)">
      <rect x="-30" y="-45" width="60" height="90" rx="6" fill="#F4E8D8" opacity="0.92" stroke="#D1BFA8" stroke-width="1.5" />
      <text x="0" y="-24" font-family="'Pretendard', sans-serif" font-size="11" font-weight="800" fill="#3D3028" text-anchor="middle">순환중</text>
      <text x="0" y="-12" font-family="'Pretendard', sans-serif" font-size="6.5" font-weight="700" fill="#756254" text-anchor="middle">CIRCULATING</text>
      
      <line x1="-22" y1="-4" x2="22" y2="-4" stroke="#D1BFA8" stroke-width="1" />
      
      <text x="0" y="12" font-family="'Pretendard', sans-serif" font-size="9" font-weight="700" fill="#3D3028" text-anchor="middle">다음 주인을</text>
      <text x="0" y="26" font-family="'Pretendard', sans-serif" font-size="9" font-weight="700" fill="#3D3028" text-anchor="middle">찾는 중! ♡</text>
    </g>
  </g>

  <!-- ========================================== -->
  <!-- 3. 우측 하단 네온 민트 '등록하기 >>' 버튼 -->
  <!-- ========================================== -->
  <g transform="translate(965, 440)">
    <rect x="0" y="0" width="186" height="62" rx="4" fill="#00FFCC" stroke="#00E5B8" stroke-width="1" />
    <text x="93" y="41" font-family="'Pretendard', 'Apple SD Gothic Neo', sans-serif" font-size="25" font-weight="900" fill="#000000" text-anchor="middle" letter-spacing="-0.5">
      등록하기 &gt;&gt;
    </text>
  </g>
</svg>`;

fs.mkdirSync('public', { recursive: true });
fs.mkdirSync('dist', { recursive: true });

// 1. SVG 저장
fs.writeFileSync('public/banner_home.svg', bannerSvg);
fs.writeFileSync('dist/banner_home.svg', bannerSvg);

// 2. 고해상도 PNG 렌더링
const resvg = new Resvg(bannerSvg, {
  fitTo: {
    mode: 'width',
    value: 1200,
  },
  background: '#FAF7EE'
});

const pngBuffer = resvg.render().asPng();
fs.writeFileSync('public/banner_home.png', pngBuffer);
fs.writeFileSync('dist/banner_home.png', pngBuffer);

// 또한 'image.png', 'KakaoTalk_20260902_181037717.jpg' 파일명으로도 제공
fs.writeFileSync('public/image.png', pngBuffer);
fs.writeFileSync('dist/image.png', pngBuffer);
fs.writeFileSync('public/image.jpg', pngBuffer);
fs.writeFileSync('dist/image.jpg', pngBuffer);
fs.writeFileSync('public/KakaoTalk_20260902_181037717.jpg', pngBuffer);
fs.writeFileSync('dist/KakaoTalk_20260902_181037717.jpg', pngBuffer);
fs.writeFileSync('public/KakaoTalk_20260902_181037717.png', pngBuffer);
fs.writeFileSync('dist/KakaoTalk_20260902_181037717.png', pngBuffer);

console.log('Home banner image successfully created with all formats!');

