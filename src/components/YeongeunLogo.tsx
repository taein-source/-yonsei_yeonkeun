import React from 'react';

interface YeongeunLogoProps {
  className?: string;
  size?: number | string;
  rotate?: number;
  variant?: 'light' | 'dark' | 'header';
}

export const YeongeunLogo: React.FC<YeongeunLogoProps> = ({ 
  className = "w-12 h-12", 
  size, 
  rotate = 0,
  variant = 'light'
}) => {
  const containerStyle = size ? { width: size, height: size } : undefined;
  
  // 색상 팔레트: PNG 이미지와 100% 동일한 색상
  const isDark = variant === 'dark';
  const ribbonColor = '#7E9E80'; // 상단 뫼비우스/리본 세이지 그린
  const bodyBg = '#DFC9BC'; // 연근 몸체 따뜻한 베이지
  const strokeColor = '#173B2A'; // 짙은 포레스트 그린 라인
  const holeColor = isDark ? '#173B2A' : '#FFFFFF'; // 다크 모드(스플래시)에서는 배경색과 일치하는 짙은 그린, 라이트 모드에서는 화이트
  const detailColor = isDark ? '#173B2A' : '#FFFFFF';

  return (
    <div 
      className={`inline-flex items-center justify-center shrink-0 ${className}`} 
      style={containerStyle}
    >
      <svg 
        viewBox="0 0 200 230" 
        className="w-full h-full filter drop-shadow-sm transition-transform duration-300" 
        style={{ transform: rotate ? `rotate(${rotate}deg)` : undefined, transformOrigin: 'center' }}
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* 1. 상단 초록색 무한대(∞) 루프 */}
        <g id="infinity-ribbon">
          <path 
            d="M 100 32 
               C 80 14, 52 14, 52 32 
               C 52 50, 80 50, 100 32 
               C 120 14, 148 14, 148 32 
               C 148 50, 120 50, 100 32 Z" 
            fill="none" 
            stroke={ribbonColor} 
            strokeWidth="9" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
          />
        </g>

        {/* 2. 메인 연근 몸체 (베이지 원형 슬라이스 + 딥그린 라인) */}
        <circle 
          cx="100" 
          cy="138" 
          r="70" 
          fill={bodyBg} 
          stroke={strokeColor} 
          strokeWidth="6" 
        />

        {/* 3. 상단 작은 눈/점 2개 */}
        <circle cx="95" cy="88" r="2.8" fill={detailColor} />
        <circle cx="105" cy="88" r="2.8" fill={detailColor} />

        {/* 4. 연근 내부 3개 씨앗 구멍들 */}
        {/* 상단 좌측 대각선 구멍 */}
        <g transform="translate(77, 122) rotate(-34)">
          <rect x="-11" y="-22" width="22" height="44" rx="11" fill={holeColor} />
        </g>

        {/* 상단 우측 대각선 구멍 */}
        <g transform="translate(123, 122) rotate(34)">
          <rect x="-11" y="-22" width="22" height="44" rx="11" fill={holeColor} />
        </g>

        {/* 중앙 작은 미니 홀 */}
        <circle cx="100" cy="136" r="4.2" fill={holeColor} />

        {/* 하단 수직 긴 구멍 */}
        <g transform="translate(100, 160)">
          <rect x="-11" y="-20" width="22" height="44" rx="11" fill={holeColor} />
        </g>

        {/* 5. 손그림 디테일 점선/대쉬 (좌우 가장자리) */}
        {/* 좌측 잔선들 */}
        <circle cx="48" cy="144" r="1.8" fill={detailColor} />
        <circle cx="56" cy="162" r="2.2" fill={detailColor} />
        <path d="M 50 152 L 54 156" stroke={detailColor} strokeWidth="2.5" strokeLinecap="round" />

        {/* 우측 잔선들 */}
        <circle cx="152" cy="136" r="1.8" fill={detailColor} />
        <circle cx="146" cy="158" r="2.2" fill={detailColor} />
        <path d="M 148 146 L 144 150" stroke={detailColor} strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  );
};


