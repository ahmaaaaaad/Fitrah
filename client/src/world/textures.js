// Procedural textures and shared GLSL noise for the cosmos.
import * as THREE from 'three';

// --------------------------------------------------------------------------- GLSL
// 3D simplex noise (Ashima Arts / Stefan Gustavson, MIT) + fbm helpers.
export const GLSL_NOISE = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){ float v=0.0, a=0.5; for(int i=0;i<6;i++){ v+=a*snoise(p); p=p*2.02+vec3(1.7,9.2,3.1); a*=0.5; } return v; }
float fbm4(vec3 p){ float v=0.0, a=0.5; for(int i=0;i<4;i++){ v+=a*snoise(p); p=p*2.03+vec3(5.1,1.3,7.7); a*=0.5; } return v; }
`;

// --------------------------------------------------------------------------- JS noise
export function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNoise3(seed) {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const val = new Float32Array(256).map(() => rand() * 2 - 1);
  const fade = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  const h = (x, y, z) => val[perm[(perm[(perm[x & 255] + y) & 511] + z) & 511] & 255];
  const noise = (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi);
    const x0 = lerp(h(xi, yi, zi), h(xi + 1, yi, zi), xf), x1 = lerp(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), xf);
    const x2 = lerp(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), xf), x3 = lerp(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), xf);
    return lerp(lerp(x0, x1, yf), lerp(x2, x3, yf), zf);
  };
  return (x, y, z, oct = 5) => { let v = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { v += a * noise(x * f, y * f, z * f); f *= 2.03; a *= 0.5; } return v; };
}

// --------------------------------------------------------------------------- textures
export function glowTexture(stops = [[0, 'rgba(255,255,255,1)'], [0.1, 'rgba(255,255,255,0.85)'], [0.3, 'rgba(255,230,180,0.28)'], [0.6, 'rgba(255,220,160,0.06)'], [1, 'rgba(0,0,0,0)']]) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const hex = (h) => new THREE.Color(h);

/**
 * Seamless equirectangular planet texture.
 * kind: 'ocean' | 'rock' | 'ice' | 'gas'
 */
export function planetTexture(kind, palette, seed, w = 1024) {
  const h = w / 2;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  const n = makeNoise3(seed);
  const cols = palette.map(hex);
  const tmp = new THREE.Color();
  for (let y = 0; y < h; y++) {
    const v = y / h; const lat = (v - 0.5) * Math.PI;
    for (let x = 0; x < w; x++) {
      const u = (x / w) * Math.PI * 2;
      const cx = Math.cos(u) * Math.cos(lat), cy = Math.sin(lat), cz = Math.sin(u) * Math.cos(lat);
      let r, gg, b;
      if (kind === 'gas' || kind === 'ice') {
        const turb = n(cx * 3, cy * 3, cz * 3, 5);
        const band = Math.sin((v * (kind === 'gas' ? 22 : 12) + turb * (kind === 'gas' ? 3.2 : 2.2)) * Math.PI) * 0.5 + 0.5;
        const fine = n(cx * 14, cy * 40, cz * 14, 3) * 0.5 + 0.5;
        tmp.copy(cols[0]).lerp(cols[1], band).lerp(cols[2], fine * 0.45);
        if (kind === 'gas') { // great storm
          const dx = u - 2.2, dy = (v - 0.62) * 3.0; const dd = Math.sqrt(dx * dx * 0.6 + dy * dy * 9);
          if (dd < 0.5) tmp.lerp(cols[3], (1 - dd / 0.5) * 0.85);
        }
      } else if (kind === 'ocean') {
        const land = n(cx * 2.2, cy * 2.2, cz * 2.2, 6);
        const cloud = n(cx * 4 + 9, cy * 6, cz * 4, 5);
        tmp.copy(cols[0]).lerp(cols[1], Math.min(1, Math.max(0, (land + 0.05) * 6)));
        if (land > 0.12) tmp.lerp(cols[2], Math.min(1, (land - 0.12) * 4));
        if (cloud > 0.08) tmp.lerp(hex('#f4fbff'), Math.min(0.8, (cloud - 0.08) * 3));
        const polar = Math.abs(cy); if (polar > 0.86) tmp.lerp(hex('#eef6ff'), Math.min(1, (polar - 0.86) * 10));
      } else { // rock
        const t1 = n(cx * 2.5, cy * 2.5, cz * 2.5, 6) * 0.5 + 0.5;
        const t2 = n(cx * 9, cy * 9, cz * 9, 4) * 0.5 + 0.5;
        tmp.copy(cols[0]).lerp(cols[1], t1).lerp(cols[2], Math.pow(t2, 2.5) * 0.8);
      }
      r = tmp.r; gg = tmp.g; b = tmp.b;
      const i = (y * w + x) * 4;
      img.data[i] = r * 255; img.data[i + 1] = gg * 255; img.data[i + 2] = b * 255; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function ringTexture(seed = 7) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 4;
  const g = c.getContext('2d'); const r = mulberry32(seed);
  for (let x = 0; x < 512; x++) {
    const t = x / 511;
    const edge = Math.min(1, t * 6) * Math.min(1, (1 - t) * 5);
    const bands = 0.55 + 0.45 * Math.sin(t * 60 + Math.sin(t * 13) * 2) * (0.6 + r() * 0.4);
    const gap = (t > 0.62 && t < 0.67) ? 0.12 : 1;
    const a = Math.max(0, Math.min(1, edge * bands * gap));
    const lum = 200 + 50 * Math.sin(t * 25);
    g.fillStyle = `rgba(${lum},${lum * 0.9},${lum * 0.74},${a})`;
    g.fillRect(x, 0, 1, 4);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
