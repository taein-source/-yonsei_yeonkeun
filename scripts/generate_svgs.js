import fs from 'fs';
import path from 'path';

// 정밀 손그림 크레용 질감 및 연근 디테일을 완벽하게 살린 5종 SVG
// 1. 차렷 (KakaoTalk_20260824_230157462.png)
const svgStand = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
  <defs>
    <filter id="crayon" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" result="noise" />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.5" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </defs>
  
  <g filter="url(#crayon)">
    <!-- 머리핀 (쑥색 연근 단면 2개) -->
    <!-- 핀 1 -->
    <ellipse cx="140" cy="98" rx="20" ry="18" fill="#607954" stroke="#2B2220" stroke-width="13" transform="rotate(-15, 140, 98)" />
    <!-- 핀 2 -->
    <ellipse cx="176" cy="78" rx="20" ry="18" fill="#607954" stroke="#2B2220" stroke-width="13" transform="rotate(10, 176, 78)" />
    
    <!-- 양발 (흑갈색) -->
    <path d="M 210 424 C 205 456, 235 460, 240 428 Z" fill="#6D605B" stroke="#2B2220" stroke-width="13" stroke-linejoin="round" />
    <path d="M 260 428 C 265 460, 295 456, 290 424 Z" fill="#6D605B" stroke="#2B2220" stroke-width="13" stroke-linejoin="round" />

    <!-- 양팔 (차렷 자세: 몸통 양옆 아래로 내려옴) -->
    <!-- 왼팔 (보는 기준 왼쪽) -->
    <path d="M 86 260 C 58 274, 44 305, 52 338 C 58 354, 82 352, 94 330 C 104 310, 102 284, 94 260 Z" fill="#6D605B" stroke="#2B2220" stroke-width="14" stroke-linejoin="round" />
    <!-- 오른팔 (보는 기준 오른쪽) -->
    <path d="M 414 260 C 442 274, 456 305, 448 338 C 442 354, 418 352, 406 330 C 396 310, 398 284, 406 260 Z" fill="#6D605B" stroke="#2B2220" stroke-width="14" stroke-linejoin="round" />

    <!-- 몸통 (연갈색/살구빛 베이지 원형) -->
    <circle cx="250" cy="254" r="182" fill="#DECBC0" stroke="#2B2220" stroke-width="17" />

    <!-- 눈 (흰색 타원형 구멍 2개 - 약간 기울어짐) -->
    <g transform="translate(186, 186) rotate(32)">
      <ellipse cx="0" cy="0" rx="24" ry="43" fill="#FFFFFF" stroke="#2B2220" stroke-width="14" />
    </g>
    <g transform="translate(314, 186) rotate(-32)">
      <ellipse cx="0" cy="0" rx="24" ry="43" fill="#FFFFFF" stroke="#2B2220" stroke-width="14" />
    </g>

    <!-- 눈동자 (흑갈색 작은 원 2개) -->
    <circle cx="174" cy="242" r="17" fill="#2B2220" />
    <circle cx="326" cy="242" r="17" fill="#2B2220" />

    <!-- 코 (가운데 작은 흰색 구멍) -->
    <circle cx="250" cy="272" r="14" fill="#FFFFFF" stroke="#2B2220" stroke-width="12" />

    <!-- 입 (세로로 긴 O 모양 흰색 구멍) -->
    <ellipse cx="250" cy="344" rx="20" ry="36" fill="#FFFFFF" stroke="#2B2220" stroke-width="14" />

    <!-- 볼터치 빗금 (양 볼 흑갈색 사선 2개씩) -->
    <line x1="122" y1="316" x2="146" y2="304" stroke="#7B6963" stroke-width="11" stroke-linecap="round" />
    <line x1="142" y1="342" x2="166" y2="328" stroke="#7B6963" stroke-width="11" stroke-linecap="round" />
    <line x1="378" y1="316" x2="354" y2="304" stroke="#7B6963" stroke-width="11" stroke-linecap="round" />
    <line x1="358" y1="342" x2="334" y2="328" stroke="#7B6963" stroke-width="11" stroke-linecap="round" />
  </g>
</svg>`;

// 2. 화이팅 / 엄지척 (KakaoTalk_20260824_230157462_01.png)
const svgThumbsUp = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
  <defs>
    <filter id="crayon1" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" result="noise" />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.5" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </defs>
  
  <g filter="url(#crayon1)">
    <!-- 머리핀 -->
    <ellipse cx="140" cy="98" rx="20" ry="18" fill="#607954" stroke="#2B2220" stroke-width="13" transform="rotate(-15, 140, 98)" />
    <ellipse cx="176" cy="78" rx="20" ry="18" fill="#607954" stroke="#2B2220" stroke-width="13" transform="rotate(10, 176, 78)" />
    
    <!-- 양발 -->
    <path d="M 210 424 C 205 456, 235 460, 240 428 Z" fill="#6D605B" stroke="#2B2220" stroke-width="13" stroke-linejoin="round" />
    <path d="M 260 428 C 265 460, 295 456, 290 424 Z" fill="#6D605B" stroke="#2B2220" stroke-width="13" stroke-linejoin="round" />

    <!-- 왼팔 (화이팅/주먹을 위로 쥐고 있는 포즈) -->
    <path d="M 98 236 L 56 182 C 46 170, 36 182, 46 198 L 66 224 C 36 194, 24 210, 42 230 L 76 268 Z" fill="#6D605B" stroke="#2B2220" stroke-width="14" stroke-linejoin="round" stroke-linecap="round" />
    <!-- 오른팔 (아래로 굽혀서 손을 바깥쪽으로) -->
    <path d="M 408 266 C 438 280, 458 316, 444 336 C 430 346, 404 326, 396 300 Z" fill="#6D605B" stroke="#2B2220" stroke-width="14" stroke-linejoin="round" />

    <!-- 몸통 -->
    <circle cx="250" cy="254" r="182" fill="#DECBC0" stroke="#2B2220" stroke-width="17" />

    <!-- 눈 -->
    <g transform="translate(186, 186) rotate(32)">
      <ellipse cx="0" cy="0" rx="24" ry="43" fill="#FFFFFF" stroke="#2B2220" stroke-width="14" />
    </g>
    <g transform="translate(314, 186) rotate(-32)">
      <ellipse cx="0" cy="0" rx="24" ry="43" fill="#FFFFFF" stroke="#2B2220" stroke-width="14" />
    </g>

    <!-- 눈동자 -->
    <circle cx="174" cy="242" r="17" fill="#2B2220" />
    <circle cx="326" cy="242" r="17" fill="#2B2220" />

    <!-- 코 -->
    <circle cx="250" cy="272" r="14" fill="#FFFFFF" stroke="#2B2220" stroke-width="12" />

    <!-- 입 -->
    <ellipse cx="250" cy="344" rx="20" ry="36" fill="#FFFFFF" stroke="#2B2220" stroke-width="14" />

    <!-- 볼터치 -->
    <line x1="122" y1="316" x2="146" y2="304" stroke="#7B6963" stroke-width="11" stroke-linecap="round" />
    <line x1="142" y1="342" x2="166" y2="328" stroke="#7B6963" stroke-width="11" stroke-linecap="round" />
    <line x1="378" y1="316" x2="354" y2="304" stroke="#7B6963" stroke-width="11" stroke-linecap="round" />
    <line x1="358" y1="342" x2="334" y2="328" stroke="#7B6963" stroke-width="11" stroke-linecap="round" />
  </g>
</svg>`;

// 3. 브이 / 피스 (KakaoTalk_20260824_230157462_02.png)
const svgPeace = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
  <defs>
    <filter id="crayon2" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" result="noise" />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.5" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </defs>
  
  <g filter="url(#crayon2)">
    <!-- 머리핀 -->
    <ellipse cx="140" cy="98" rx="20" ry="18" fill="#607954" stroke="#2B2220" stroke-width="13" transform="rotate(-15, 140, 98)" />
    <ellipse cx="176" cy="78" rx="20" ry="18" fill="#607954" stroke="#2B2220" stroke-width="13" transform="rotate(10, 176, 78)" />
    
    <!-- 양발 -->
    <path d="M 210 424 C 205 456, 235 460, 240 428 Z" fill="#6D605B" stroke="#2B2220" stroke-width="13" stroke-linejoin="round" />
    <path d="M 260 428 C 265 460, 295 456, 290 424 Z" fill="#6D605B" stroke="#2B2220" stroke-width="13" stroke-linejoin="round" />

    <!-- 왼손 (승리의 브이 V 사인 손가락) -->
    <path d="M 38 258 C 30 244, 40 232, 52 238 L 68 266 C 62 232, 78 226, 90 238 L 98 284 C 98 300, 78 330, 52 312 C 38 298, 44 276, 38 258 Z" fill="#6D605B" stroke="#2B2220" stroke-width="14" stroke-linejoin="round" stroke-linecap="round" />
    <!-- 오른팔 (아래로 내림) -->
    <path d="M 414 260 C 442 274, 458 306, 446 336 C 432 346, 410 328, 402 300 Z" fill="#6D605B" stroke="#2B2220" stroke-width="14" stroke-linejoin="round" />

    <!-- 몸통 -->
    <circle cx="250" cy="254" r="182" fill="#DECBC0" stroke="#2B2220" stroke-width="17" />

    <!-- 눈 -->
    <g transform="translate(186, 186) rotate(32)">
      <ellipse cx="0" cy="0" rx="24" ry="43" fill="#FFFFFF" stroke="#2B2220" stroke-width="14" />
    </g>
    <g transform="translate(314, 186) rotate(-32)">
      <ellipse cx="0" cy="0" rx="24" ry="43" fill="#FFFFFF" stroke="#2B2220" stroke-width="14" />
    </g>

    <!-- 눈동자 -->
    <circle cx="174" cy="242" r="17" fill="#2B2220" />
    <circle cx="326" cy="242" r="17" fill="#2B2220" />

    <!-- 코 -->
    <circle cx="250" cy="272" r="14" fill="#FFFFFF" stroke="#2B2220" stroke-width="12" />

    <!-- 입 -->
    <ellipse cx="250" cy="344" rx="20" ry="36" fill="#FFFFFF" stroke="#2B2220" stroke-width="14" />

    <!-- 볼터치 -->
    <line x1="122" y1="316" x2="146" y2="304" stroke="#7B6963" stroke-width="11" stroke-linecap="round" />
    <line x1="142" y1="342" x2="166" y2="328" stroke="#7B6963" stroke-width="11" stroke-linecap="round" />
    <line x1="378" y1="316" x2="354" y2="304" stroke="#7B6963" stroke-width="11" stroke-linecap="round" />
    <line x1="358" y1="342" x2="334" y2="328" stroke="#7B6963" stroke-width="11" stroke-linecap="round" />
  </g>
</svg>`;

// 4. 땀삐질 / 부끄당황 (KakaoTalk_20260824_230157462_03.png)
const svgSweat = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
  <defs>
    <filter id="crayon3" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" result="noise" />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.5" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </defs>
  
  <g filter="url(#crayon3)">
    <!-- 머리핀 -->
    <ellipse cx="140" cy="98" rx="20" ry="18" fill="#607954" stroke="#2B2220" stroke-width="13" transform="rotate(-15, 140, 98)" />
    <ellipse cx="176" cy="78" rx="20" ry="18" fill="#607954" stroke="#2B2220" stroke-width="13" transform="rotate(10, 176, 78)" />
    
    <!-- 양발 -->
    <path d="M 210 424 C 205 456, 235 460, 240 428 Z" fill="#6D605B" stroke="#2B2220" stroke-width="13" stroke-linejoin="round" />
    <path d="M 260 428 C 265 460, 295 456, 290 424 Z" fill="#6D605B" stroke="#2B2220" stroke-width="13" stroke-linejoin="round" />

    <!-- 양팔 (수평으로 양옆으로 뻗은 타원형 팔) -->
    <ellipse cx="64" cy="262" rx="46" ry="19" fill="#6D605B" stroke="#2B2220" stroke-width="14" transform="rotate(-6, 64, 262)" />
    <ellipse cx="436" cy="262" rx="46" ry="19" fill="#6D605B" stroke="#2B2220" stroke-width="14" transform="rotate(6, 436, 262)" />

    <!-- 몸통 -->
    <circle cx="250" cy="254" r="182" fill="#DECBC0" stroke="#2B2220" stroke-width="17" />

    <!-- 땀방울들 (왼쪽 1개, 오른쪽 2개) -->
    <path d="M 108 186 C 96 194, 96 214, 108 214 C 120 214, 120 194, 108 186 Z" fill="#FFFFFF" stroke="#2B2220" stroke-width="11" />
    <path d="M 386 176 C 374 184, 374 202, 386 202 C 398 202, 398 184, 386 176 Z" fill="#FFFFFF" stroke="#2B2220" stroke-width="11" />
    <path d="M 420 200 C 410 208, 410 222, 420 222 C 430 222, 430 208, 420 200 Z" fill="#FFFFFF" stroke="#2B2220" stroke-width="10" />

    <!-- 눈 -->
    <g transform="translate(186, 186) rotate(32)">
      <ellipse cx="0" cy="0" rx="24" ry="43" fill="#FFFFFF" stroke="#2B2220" stroke-width="14" />
    </g>
    <g transform="translate(314, 186) rotate(-32)">
      <ellipse cx="0" cy="0" rx="24" ry="43" fill="#FFFFFF" stroke="#2B2220" stroke-width="14" />
    </g>

    <!-- 눈동자 -->
    <circle cx="174" cy="242" r="17" fill="#2B2220" />
    <circle cx="326" cy="242" r="17" fill="#2B2220" />

    <!-- 코 -->
    <circle cx="250" cy="272" r="14" fill="#FFFFFF" stroke="#2B2220" stroke-width="12" />

    <!-- 입 -->
    <ellipse cx="250" cy="344" rx="20" ry="36" fill="#FFFFFF" stroke="#2B2220" stroke-width="14" />

    <!-- 볼터치 -->
    <line x1="122" y1="316" x2="146" y2="304" stroke="#7B6963" stroke-width="11" stroke-linecap="round" />
    <line x1="142" y1="342" x2="166" y2="328" stroke="#7B6963" stroke-width="11" stroke-linecap="round" />
    <line x1="378" y1="316" x2="354" y2="304" stroke="#7B6963" stroke-width="11" stroke-linecap="round" />
    <line x1="358" y1="342" x2="334" y2="328" stroke="#7B6963" stroke-width="11" stroke-linecap="round" />
  </g>
</svg>`;

// 5. 손흔들기 / 안녕 (KakaoTalk_20260824_230157462_04.png)
const svgWave = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
  <defs>
    <filter id="crayon4" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" result="noise" />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.5" xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </defs>
  
  <g filter="url(#crayon4)">
    <!-- 머리핀 -->
    <ellipse cx="140" cy="98" rx="20" ry="18" fill="#607954" stroke="#2B2220" stroke-width="13" transform="rotate(-15, 140, 98)" />
    <ellipse cx="176" cy="78" rx="20" ry="18" fill="#607954" stroke="#2B2220" stroke-width="13" transform="rotate(10, 176, 78)" />
    
    <!-- 양발 -->
    <path d="M 210 424 C 205 456, 235 460, 240 428 Z" fill="#6D605B" stroke="#2B2220" stroke-width="13" stroke-linejoin="round" />
    <path d="M 260 428 C 265 460, 295 456, 290 424 Z" fill="#6D605B" stroke="#2B2220" stroke-width="13" stroke-linejoin="round" />

    <!-- 왼손 (위로 번쩍 들어서 안녕 인사하는 팔) -->
    <path d="M 104 220 C 72 184, 40 144, 44 154 C 48 164, 70 216, 88 244 Z" fill="#6D605B" stroke="#2B2220" stroke-width="14" stroke-linejoin="round" stroke-linecap="round" />
    <!-- 오른팔 (아래로 굽혀서 손을 바깥쪽으로) -->
    <path d="M 416 266 C 446 280, 462 312, 450 334 C 436 346, 414 328, 406 300 Z" fill="#6D605B" stroke="#2B2220" stroke-width="14" stroke-linejoin="round" />

    <!-- 몸통 -->
    <circle cx="250" cy="254" r="182" fill="#DECBC0" stroke="#2B2220" stroke-width="17" />

    <!-- 눈 -->
    <g transform="translate(186, 186) rotate(32)">
      <ellipse cx="0" cy="0" rx="24" ry="43" fill="#FFFFFF" stroke="#2B2220" stroke-width="14" />
    </g>
    <g transform="translate(314, 186) rotate(-32)">
      <ellipse cx="0" cy="0" rx="24" ry="43" fill="#FFFFFF" stroke="#2B2220" stroke-width="14" />
    </g>

    <!-- 눈동자 -->
    <circle cx="174" cy="242" r="17" fill="#2B2220" />
    <circle cx="326" cy="242" r="17" fill="#2B2220" />

    <!-- 코 -->
    <circle cx="250" cy="272" r="14" fill="#FFFFFF" stroke="#2B2220" stroke-width="12" />

    <!-- 입 -->
    <ellipse cx="250" cy="344" rx="20" ry="36" fill="#FFFFFF" stroke="#2B2220" stroke-width="14" />

    <!-- 볼터치 -->
    <line x1="122" y1="316" x2="146" y2="304" stroke="#7B6963" stroke-width="11" stroke-linecap="round" />
    <line x1="142" y1="342" x2="166" y2="328" stroke="#7B6963" stroke-width="11" stroke-linecap="round" />
    <line x1="378" y1="316" x2="354" y2="304" stroke="#7B6963" stroke-width="11" stroke-linecap="round" />
    <line x1="358" y1="342" x2="334" y2="328" stroke="#7B6963" stroke-width="11" stroke-linecap="round" />
  </g>
</svg>`;

const files = {
  'KakaoTalk_20260824_230157462.svg': svgStand,
  'KakaoTalk_20260824_230157462_01.svg': svgThumbsUp,
  'KakaoTalk_20260824_230157462_02.svg': svgPeace,
  'KakaoTalk_20260824_230157462_03.svg': svgSweat,
  'KakaoTalk_20260824_230157462_04.svg': svgWave,
};

fs.mkdirSync('public', { recursive: true });
fs.mkdirSync('dist', { recursive: true });

for (const [name, content] of Object.entries(files)) {
  fs.writeFileSync(path.join('public', name), content);
  fs.writeFileSync(path.join('dist', name), content);
  console.log('Saved SVG:', name);
}
