import fs from 'fs';
import path from 'path';
import { Resvg } from '@resvg/resvg-js';

// SVG definition for all 5 characters
const svgStand = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500" fill="none">
  <!-- Hairpins -->
  <circle cx="152" cy="96" r="23" fill="#627D5E" stroke="#2B2321" stroke-width="15" />
  <circle cx="188" cy="78" r="23" fill="#627D5E" stroke="#2B2321" stroke-width="15" />
  
  <!-- Arms (Standing Down) -->
  <path d="M 88 260 C 60 270, 42 295, 48 330 C 54 350, 78 350, 92 328 C 104 310, 104 285, 96 260 Z" fill="#6B5E59" stroke="#2B2321" stroke-width="15" stroke-linejoin="round" />
  <path d="M 412 260 C 440 270, 458 295, 452 330 C 446 350, 422 350, 408 328 C 396 310, 396 285, 404 260 Z" fill="#6B5E59" stroke="#2B2321" stroke-width="15" stroke-linejoin="round" />

  <!-- Feet -->
  <path d="M 206 430 C 206 460, 238 460, 240 430 Z" fill="#6B5E59" stroke="#2B2321" stroke-width="15" stroke-linejoin="round" />
  <path d="M 260 430 C 262 460, 294 460, 294 430 Z" fill="#6B5E59" stroke="#2B2321" stroke-width="15" stroke-linejoin="round" />

  <!-- Main Body -->
  <circle cx="250" cy="254" r="184" fill="#DECDBF" stroke="#2B2321" stroke-width="18" />

  <!-- Sclera Eyes (Holes) -->
  <g transform="translate(190, 190) rotate(32)">
    <ellipse cx="0" cy="0" rx="25" ry="44" fill="#FFFFFF" stroke="#2B2321" stroke-width="15" />
  </g>
  <g transform="translate(310, 190) rotate(-32)">
    <ellipse cx="0" cy="0" rx="25" ry="44" fill="#FFFFFF" stroke="#2B2321" stroke-width="15" />
  </g>

  <!-- Pupils -->
  <circle cx="178" cy="242" r="16" fill="#2B2321" />
  <circle cx="322" cy="242" r="16" fill="#2B2321" />

  <!-- Nose Hole -->
  <circle cx="250" cy="272" r="15" fill="#FFFFFF" stroke="#2B2321" stroke-width="13" />

  <!-- Mouth Hole -->
  <ellipse cx="250" cy="346" rx="22" ry="38" fill="#FFFFFF" stroke="#2B2321" stroke-width="15" />

  <!-- Cheeks -->
  <line x1="124" y1="316" x2="148" y2="304" stroke="#8A766F" stroke-width="10" stroke-linecap="round" />
  <line x1="144" y1="342" x2="168" y2="328" stroke="#8A766F" stroke-width="10" stroke-linecap="round" />
  <line x1="376" y1="316" x2="352" y2="304" stroke="#8A766F" stroke-width="10" stroke-linecap="round" />
  <line x1="356" y1="342" x2="332" y2="328" stroke="#8A766F" stroke-width="10" stroke-linecap="round" />
</svg>`;

const svgThumbsUp = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500" fill="none">
  <!-- Hairpins -->
  <circle cx="152" cy="96" r="23" fill="#627D5E" stroke="#2B2321" stroke-width="15" />
  <circle cx="188" cy="78" r="23" fill="#627D5E" stroke="#2B2321" stroke-width="15" />
  
  <!-- Raised Fist / Thumbs Up Arm (Left) -->
  <path d="M 104 228 L 62 176 C 52 166, 44 178, 54 192 L 72 216 C 44 186, 32 202, 48 220 L 80 256 Z" fill="#6B5E59" stroke="#2B2321" stroke-width="15" stroke-linejoin="round" stroke-linecap="round" />
  
  <!-- Right Arm (Resting) -->
  <path d="M 408 266 C 438 280, 456 316, 442 334 C 428 344, 404 326, 396 300 Z" fill="#6B5E59" stroke="#2B2321" stroke-width="15" stroke-linejoin="round" />

  <!-- Feet -->
  <path d="M 206 430 C 206 460, 238 460, 240 430 Z" fill="#6B5E59" stroke="#2B2321" stroke-width="15" stroke-linejoin="round" />
  <path d="M 260 430 C 262 460, 294 460, 294 430 Z" fill="#6B5E59" stroke="#2B2321" stroke-width="15" stroke-linejoin="round" />

  <!-- Main Body -->
  <circle cx="250" cy="254" r="184" fill="#DECDBF" stroke="#2B2321" stroke-width="18" />

  <!-- Sclera Eyes (Holes) -->
  <g transform="translate(190, 190) rotate(32)">
    <ellipse cx="0" cy="0" rx="25" ry="44" fill="#FFFFFF" stroke="#2B2321" stroke-width="15" />
  </g>
  <g transform="translate(310, 190) rotate(-32)">
    <ellipse cx="0" cy="0" rx="25" ry="44" fill="#FFFFFF" stroke="#2B2321" stroke-width="15" />
  </g>

  <!-- Pupils -->
  <circle cx="178" cy="242" r="16" fill="#2B2321" />
  <circle cx="322" cy="242" r="16" fill="#2B2321" />

  <!-- Nose Hole -->
  <circle cx="250" cy="272" r="15" fill="#FFFFFF" stroke="#2B2321" stroke-width="13" />

  <!-- Mouth Hole -->
  <ellipse cx="250" cy="346" rx="22" ry="38" fill="#FFFFFF" stroke="#2B2321" stroke-width="15" />

  <!-- Cheeks -->
  <line x1="124" y1="316" x2="148" y2="304" stroke="#8A766F" stroke-width="10" stroke-linecap="round" />
  <line x1="144" y1="342" x2="168" y2="328" stroke="#8A766F" stroke-width="10" stroke-linecap="round" />
  <line x1="376" y1="316" x2="352" y2="304" stroke="#8A766F" stroke-width="10" stroke-linecap="round" />
  <line x1="356" y1="342" x2="332" y2="328" stroke="#8A766F" stroke-width="10" stroke-linecap="round" />
</svg>`;

const svgPeace = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500" fill="none">
  <!-- Hairpins -->
  <circle cx="152" cy="96" r="23" fill="#627D5E" stroke="#2B2321" stroke-width="15" />
  <circle cx="188" cy="78" r="23" fill="#627D5E" stroke="#2B2321" stroke-width="15" />
  
  <!-- Left Peace Sign Hand (V) -->
  <path d="M 40 258 C 34 246, 42 234, 52 238 L 70 264 C 64 234, 80 228, 90 240 L 98 282 C 98 298, 78 328, 54 312 C 40 298, 46 276, 40 258 Z" fill="#6B5E59" stroke="#2B2321" stroke-width="15" stroke-linejoin="round" stroke-linecap="round" />
  
  <!-- Right Arm (Down) -->
  <path d="M 416 260 C 444 274, 460 306, 448 334 C 434 346, 412 328, 404 300 Z" fill="#6B5E59" stroke="#2B2321" stroke-width="15" stroke-linejoin="round" />

  <!-- Feet -->
  <path d="M 206 430 C 206 460, 238 460, 240 430 Z" fill="#6B5E59" stroke="#2B2321" stroke-width="15" stroke-linejoin="round" />
  <path d="M 260 430 C 262 460, 294 460, 294 430 Z" fill="#6B5E59" stroke="#2B2321" stroke-width="15" stroke-linejoin="round" />

  <!-- Main Body -->
  <circle cx="250" cy="254" r="184" fill="#DECDBF" stroke="#2B2321" stroke-width="18" />

  <!-- Sclera Eyes (Holes) -->
  <g transform="translate(190, 190) rotate(32)">
    <ellipse cx="0" cy="0" rx="25" ry="44" fill="#FFFFFF" stroke="#2B2321" stroke-width="15" />
  </g>
  <g transform="translate(310, 190) rotate(-32)">
    <ellipse cx="0" cy="0" rx="25" ry="44" fill="#FFFFFF" stroke="#2B2321" stroke-width="15" />
  </g>

  <!-- Pupils -->
  <circle cx="178" cy="242" r="16" fill="#2B2321" />
  <circle cx="322" cy="242" r="16" fill="#2B2321" />

  <!-- Nose Hole -->
  <circle cx="250" cy="272" r="15" fill="#FFFFFF" stroke="#2B2321" stroke-width="13" />

  <!-- Mouth Hole -->
  <ellipse cx="250" cy="346" rx="22" ry="38" fill="#FFFFFF" stroke="#2B2321" stroke-width="15" />

  <!-- Cheeks -->
  <line x1="124" y1="316" x2="148" y2="304" stroke="#8A766F" stroke-width="10" stroke-linecap="round" />
  <line x1="144" y1="342" x2="168" y2="328" stroke="#8A766F" stroke-width="10" stroke-linecap="round" />
  <line x1="376" y1="316" x2="352" y2="304" stroke="#8A766F" stroke-width="10" stroke-linecap="round" />
  <line x1="356" y1="342" x2="332" y2="328" stroke="#8A766F" stroke-width="10" stroke-linecap="round" />
</svg>`;

const svgSweat = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500" fill="none">
  <!-- Hairpins -->
  <circle cx="152" cy="96" r="23" fill="#627D5E" stroke="#2B2321" stroke-width="15" />
  <circle cx="188" cy="78" r="23" fill="#627D5E" stroke="#2B2321" stroke-width="15" />
  
  <!-- Arms Stretched Out Wide (Horizontal) -->
  <ellipse cx="68" cy="262" rx="46" ry="18" fill="#6B5E59" stroke="#2B2321" stroke-width="15" transform="rotate(-6, 68, 262)" />
  <ellipse cx="432" cy="262" rx="46" ry="18" fill="#6B5E59" stroke="#2B2321" stroke-width="15" transform="rotate(6, 432, 262)" />

  <!-- Feet -->
  <path d="M 206 430 C 206 460, 238 460, 240 430 Z" fill="#6B5E59" stroke="#2B2321" stroke-width="15" stroke-linejoin="round" />
  <path d="M 260 430 C 262 460, 294 460, 294 430 Z" fill="#6B5E59" stroke="#2B2321" stroke-width="15" stroke-linejoin="round" />

  <!-- Main Body -->
  <circle cx="250" cy="254" r="184" fill="#DECDBF" stroke="#2B2321" stroke-width="18" />

  <!-- Sweat Drops -->
  <path d="M 108 188 C 96 196, 96 214, 108 214 C 120 214, 120 196, 108 188 Z" fill="#FFFFFF" stroke="#2B2321" stroke-width="11" />
  <path d="M 386 176 C 374 184, 374 202, 386 202 C 398 202, 398 184, 386 176 Z" fill="#FFFFFF" stroke="#2B2321" stroke-width="11" />
  <path d="M 418 198 C 408 206, 408 220, 418 220 C 428 220, 428 206, 418 198 Z" fill="#FFFFFF" stroke="#2B2321" stroke-width="10" />

  <!-- Sclera Eyes (Holes) -->
  <g transform="translate(190, 190) rotate(32)">
    <ellipse cx="0" cy="0" rx="25" ry="44" fill="#FFFFFF" stroke="#2B2321" stroke-width="15" />
  </g>
  <g transform="translate(310, 190) rotate(-32)">
    <ellipse cx="0" cy="0" rx="25" ry="44" fill="#FFFFFF" stroke="#2B2321" stroke-width="15" />
  </g>

  <!-- Pupils -->
  <circle cx="178" cy="242" r="16" fill="#2B2321" />
  <circle cx="322" cy="242" r="16" fill="#2B2321" />

  <!-- Nose Hole -->
  <circle cx="250" cy="272" r="15" fill="#FFFFFF" stroke="#2B2321" stroke-width="13" />

  <!-- Mouth Hole -->
  <ellipse cx="250" cy="346" rx="22" ry="38" fill="#FFFFFF" stroke="#2B2321" stroke-width="15" />

  <!-- Cheeks -->
  <line x1="124" y1="316" x2="148" y2="304" stroke="#8A766F" stroke-width="10" stroke-linecap="round" />
  <line x1="144" y1="342" x2="168" y2="328" stroke="#8A766F" stroke-width="10" stroke-linecap="round" />
  <line x1="376" y1="316" x2="352" y2="304" stroke="#8A766F" stroke-width="10" stroke-linecap="round" />
  <line x1="356" y1="342" x2="332" y2="328" stroke="#8A766F" stroke-width="10" stroke-linecap="round" />
</svg>`;

const svgWave = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500" fill="none">
  <!-- Hairpins -->
  <circle cx="152" cy="96" r="23" fill="#627D5E" stroke="#2B2321" stroke-width="15" />
  <circle cx="188" cy="78" r="23" fill="#627D5E" stroke="#2B2321" stroke-width="15" />
  
  <!-- Left Arm (Waving Up High) -->
  <path d="M 104 224 C 74 190, 44 150, 48 160 C 52 170, 72 220, 88 248 Z" fill="#6B5E59" stroke="#2B2321" stroke-width="15" stroke-linejoin="round" stroke-linecap="round" />
  
  <!-- Right Arm (Down) -->
  <path d="M 416 266 C 444 280, 460 312, 448 334 C 434 346, 412 328, 404 300 Z" fill="#6B5E59" stroke="#2B2321" stroke-width="15" stroke-linejoin="round" />

  <!-- Feet -->
  <path d="M 206 430 C 206 460, 238 460, 240 430 Z" fill="#6B5E59" stroke="#2B2321" stroke-width="15" stroke-linejoin="round" />
  <path d="M 260 430 C 262 460, 294 460, 294 430 Z" fill="#6B5E59" stroke="#2B2321" stroke-width="15" stroke-linejoin="round" />

  <!-- Main Body -->
  <circle cx="250" cy="254" r="184" fill="#DECDBF" stroke="#2B2321" stroke-width="18" />

  <!-- Sclera Eyes (Holes) -->
  <g transform="translate(190, 190) rotate(32)">
    <ellipse cx="0" cy="0" rx="25" ry="44" fill="#FFFFFF" stroke="#2B2321" stroke-width="15" />
  </g>
  <g transform="translate(310, 190) rotate(-32)">
    <ellipse cx="0" cy="0" rx="25" ry="44" fill="#FFFFFF" stroke="#2B2321" stroke-width="15" />
  </g>

  <!-- Pupils -->
  <circle cx="178" cy="242" r="16" fill="#2B2321" />
  <circle cx="322" cy="242" r="16" fill="#2B2321" />

  <!-- Nose Hole -->
  <circle cx="250" cy="272" r="15" fill="#FFFFFF" stroke="#2B2321" stroke-width="13" />

  <!-- Mouth Hole -->
  <ellipse cx="250" cy="346" rx="22" ry="38" fill="#FFFFFF" stroke="#2B2321" stroke-width="15" />

  <!-- Cheeks -->
  <line x1="124" y1="316" x2="148" y2="304" stroke="#8A766F" stroke-width="10" stroke-linecap="round" />
  <line x1="144" y1="342" x2="168" y2="328" stroke="#8A766F" stroke-width="10" stroke-linecap="round" />
  <line x1="376" y1="316" x2="352" y2="304" stroke="#8A766F" stroke-width="10" stroke-linecap="round" />
  <line x1="356" y1="342" x2="332" y2="328" stroke="#8A766F" stroke-width="10" stroke-linecap="round" />
</svg>`;

const avatars = {
  'yeongeun_stand': svgStand,
  'yeongeun_thumbsup': svgThumbsUp,
  'yeongeun_peace': svgPeace,
  'yeongeun_sweat': svgSweat,
  'yeongeun_wave': svgWave,
  'KakaoTalk_20260824_230157462': svgStand,
  'KakaoTalk_20260824_230157462_01': svgThumbsUp,
  'KakaoTalk_20260824_230157462_02': svgPeace,
  'KakaoTalk_20260824_230157462_03': svgSweat,
  'KakaoTalk_20260824_230157462_04': svgWave,
};

fs.mkdirSync('public/avatars', { recursive: true });
fs.mkdirSync('dist/avatars', { recursive: true });

const dataUrls = {};

for (const [name, svg] of Object.entries(avatars)) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 512 }
  });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();
  
  const publicPath = path.join('public/avatars', `${name}.png`);
  const distPath = path.join('dist/avatars', `${name}.png`);
  
  fs.writeFileSync(publicPath, pngBuffer);
  fs.writeFileSync(distPath, pngBuffer);
  
  const base64 = `data:image/png;base64,${pngBuffer.toString('base64')}`;
  dataUrls[name] = base64;
  
  console.log(`Generated ${publicPath} (${pngBuffer.length} bytes)`);
}

// Write a standalone TypeScript data file containing data URIs and URLs
const tsContent = `// 연근마켓 5종 공식 캐릭터 고해상도 PNG 아바타

export const YEONGEUN_STAND_PNG = "/avatars/yeongeun_stand.png";
export const YEONGEUN_THUMBSUP_PNG = "/avatars/yeongeun_thumbsup.png";
export const YEONGEUN_PEACE_PNG = "/avatars/yeongeun_peace.png";
export const YEONGEUN_SWEAT_PNG = "/avatars/yeongeun_sweat.png";
export const YEONGEUN_WAVE_PNG = "/avatars/yeongeun_wave.png";

// Base64 PNG Data URLs (무손실 즉시 로드 PNG)
export const YEONGEUN_DATA_STAND = "${dataUrls['yeongeun_stand']}";
export const YEONGEUN_DATA_THUMBSUP = "${dataUrls['yeongeun_thumbsup']}";
export const YEONGEUN_DATA_PEACE = "${dataUrls['yeongeun_peace']}";
export const YEONGEUN_DATA_SWEAT = "${dataUrls['yeongeun_sweat']}";
export const YEONGEUN_DATA_WAVE = "${dataUrls['yeongeun_wave']}";

// 호환성 별칭
export const YEONGEUN_AVATAR_STAND = YEONGEUN_STAND_PNG;
export const YEONGEUN_AVATAR_SURPRISED = YEONGEUN_STAND_PNG;
export const YEONGEUN_AVATAR_THUMBSUP = YEONGEUN_THUMBSUP_PNG;
export const YEONGEUN_AVATAR_PEACE = YEONGEUN_PEACE_PNG;
export const YEONGEUN_AVATAR_SWEAT = YEONGEUN_SWEAT_PNG;
export const YEONGEUN_AVATAR_WAVE = YEONGEUN_WAVE_PNG;
export const YEONGEUN_AVATAR_HELLO = YEONGEUN_STAND_PNG;

export const RECOMMENDED_AVATARS = [
  { id: 'stand', name: '차렷 놀란 연근', url: YEONGEUN_STAND_PNG, dataUrl: YEONGEUN_DATA_STAND, file: 'KakaoTalk_20260824_230157462.png' },
  { id: 'thumbsup', name: '화이팅 연근', url: YEONGEUN_THUMBSUP_PNG, dataUrl: YEONGEUN_DATA_THUMBSUP, file: 'KakaoTalk_20260824_230157462_01.png' },
  { id: 'peace', name: '승리의 브이 연근', url: YEONGEUN_PEACE_PNG, dataUrl: YEONGEUN_DATA_PEACE, file: 'KakaoTalk_20260824_230157462_02.png' },
  { id: 'sweat', name: '부끄 땀방울 연근', url: YEONGEUN_SWEAT_PNG, dataUrl: YEONGEUN_DATA_SWEAT, file: 'KakaoTalk_20260824_230157462_03.png' },
  { id: 'wave', name: '인사하는 연근', url: YEONGEUN_WAVE_PNG, dataUrl: YEONGEUN_DATA_WAVE, file: 'KakaoTalk_20260824_230157462_04.png' }
];

export const getRandomYeongeunAvatar = (): string => {
  const index = Math.floor(Math.random() * RECOMMENDED_AVATARS.length);
  return RECOMMENDED_AVATARS[index].url;
};
`;

fs.writeFileSync('src/components/YeongeunAvatars.ts', tsContent, 'utf-8');
console.log('src/components/YeongeunAvatars.ts updated successfully with PNG paths and base64 fallbacks.');
