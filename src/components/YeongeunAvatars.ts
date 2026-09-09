// 연근마켓 5종 공식 캐릭터 원본 PNG 아바타 샘플 (samplepic1 ~ samplepic5)

export const SAMPLE_PIC_1 = "https://i.ibb.co/YTTbzcmw/samplepic1.png";
export const SAMPLE_PIC_2 = "https://i.ibb.co/tTvSdxFv/samplepic2.png";
export const SAMPLE_PIC_3 = "https://i.ibb.co/1Yz4gjmW/samplepic3.png";
export const SAMPLE_PIC_4 = "https://i.ibb.co/JWYbcYfL/samplepic4.png";
export const SAMPLE_PIC_5 = "https://i.ibb.co/PzY20pv0/samplepic5.png";

export const YEONGEUN_STAND_PNG = SAMPLE_PIC_1;
export const YEONGEUN_THUMBSUP_PNG = SAMPLE_PIC_2;
export const YEONGEUN_PEACE_PNG = SAMPLE_PIC_3;
export const YEONGEUN_SWEAT_PNG = SAMPLE_PIC_4;
export const YEONGEUN_WAVE_PNG = SAMPLE_PIC_5;

// 호환성 별칭
export const YEONGEUN_AVATAR_STAND = YEONGEUN_STAND_PNG;
export const YEONGEUN_AVATAR_SURPRISED = YEONGEUN_STAND_PNG;
export const YEONGEUN_AVATAR_THUMBSUP = YEONGEUN_THUMBSUP_PNG;
export const YEONGEUN_AVATAR_PEACE = YEONGEUN_PEACE_PNG;
export const YEONGEUN_AVATAR_SWEAT = YEONGEUN_SWEAT_PNG;
export const YEONGEUN_AVATAR_WAVE = YEONGEUN_WAVE_PNG;
export const YEONGEUN_AVATAR_HELLO = YEONGEUN_STAND_PNG;

export const RECOMMENDED_AVATARS = [
  { id: 'samplepic1', name: '샘플 프로필 1', url: SAMPLE_PIC_1, file: 'samplepic1.png' },
  { id: 'samplepic2', name: '샘플 프로필 2', url: SAMPLE_PIC_2, file: 'samplepic2.png' },
  { id: 'samplepic3', name: '샘플 프로필 3', url: SAMPLE_PIC_3, file: 'samplepic3.png' },
  { id: 'samplepic4', name: '샘플 프로필 4', url: SAMPLE_PIC_4, file: 'samplepic4.png' },
  { id: 'samplepic5', name: '샘플 프로필 5', url: SAMPLE_PIC_5, file: 'samplepic5.png' }
];

export const getRandomYeongeunAvatar = (): string => {
  const index = Math.floor(Math.random() * RECOMMENDED_AVATARS.length);
  return RECOMMENDED_AVATARS[index].url;
};
