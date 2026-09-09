import fs from 'fs';
import path from 'path';
import { Resvg } from '@resvg/resvg-js';

const items = [
  'KakaoTalk_20260824_230157462',
  'KakaoTalk_20260824_230157462_01',
  'KakaoTalk_20260824_230157462_02',
  'KakaoTalk_20260824_230157462_03',
  'KakaoTalk_20260824_230157462_04'
];

for (const name of items) {
  const svgPath = path.join('public', `${name}.svg`);
  const svg = fs.readFileSync(svgPath, 'utf8');
  
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: 512,
    },
    background: 'rgba(0, 0, 0, 0)'
  });
  
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();
  
  fs.writeFileSync(path.join('public', `${name}.png`), pngBuffer);
  fs.writeFileSync(path.join('dist', `${name}.png`), pngBuffer);
  console.log(`Rendered ${name}.png (size: ${pngBuffer.length} bytes)`);
}
