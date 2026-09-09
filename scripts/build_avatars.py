import os
import subprocess

svg_common_defs = """
<defs>
  <filter id="crayon" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="4" result="noise" />
    <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
  </filter>
</defs>
"""

svg_stand = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500" fill="none">
{svg_common_defs}
<g filter="url(#crayon)">
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
</g>
</svg>"""

svg_thumbsup = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500" fill="none">
{svg_common_defs}
<g filter="url(#crayon)">
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
</g>
</svg>"""

svg_peace = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500" fill="none">
{svg_common_defs}
<g filter="url(#crayon)">
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
</g>
</svg>"""

svg_sweat = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500" fill="none">
{svg_common_defs}
<g filter="url(#crayon)">
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
</g>
</svg>"""

svg_wave = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500" fill="none">
{svg_common_defs}
<g filter="url(#crayon)">
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
</g>
</svg>"""

files = {
    'yeongeun_stand': svg_stand,
    'yeongeun_thumbsup': svg_thumbsup,
    'yeongeun_peace': svg_peace,
    'yeongeun_sweat': svg_sweat,
    'yeongeun_wave': svg_wave,
    # KakaoTalk exact original filenames
    'KakaoTalk_20260824_230157462': svg_stand,
    'KakaoTalk_20260824_230157462_01': svg_thumbsup,
    'KakaoTalk_20260824_230157462_02': svg_peace,
    'KakaoTalk_20260824_230157462_03': svg_sweat,
    'KakaoTalk_20260824_230157462_04': svg_wave,
}

os.makedirs('public/avatars', exist_ok=True)
os.makedirs('dist/avatars', exist_ok=True)

for name, svg_content in files.items():
    svg_path = f"/tmp/{name}.svg"
    with open(svg_path, "w", encoding="utf-8") as f:
        f.write(svg_content)
    
    png_public = f"public/avatars/{name}.png"
    png_dist = f"dist/avatars/{name}.png"
    
    subprocess.run(["convert", "-background", "none", "-density", "200", svg_path, png_public], check=True)
    subprocess.run(["convert", "-background", "none", "-density", "200", svg_path, png_dist], check=True)
    print(f"Created {png_public} ({os.path.getsize(png_public)} bytes)")
