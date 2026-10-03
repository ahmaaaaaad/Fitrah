// Shared GLSL chunks: noise, field sampling, shared wind, painterly light, fog.
export const NOISE = /* glsl */`
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1,0)), u.x), mix(hash12(i + vec2(0,1)), hash12(i + vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
`;

// The field textures cover the valley square [-HALF, HALF]^2.
// uFieldA: R soil moisture, G vegetation, B cloud density, A rain
// uFieldB: R,G wind x,z (encoded 0.5 +- w/24), B sunlight through clouds, A air moisture
export const FIELD = /* glsl */`
uniform sampler2D uFieldA, uFieldB;
uniform float uHalf;
vec2 fieldUV(vec2 xz){ return clamp(xz / (2.0 * uHalf) + 0.5, 0.0, 1.0); }
vec4 fieldA(vec2 xz){ return texture2D(uFieldA, fieldUV(xz)); }
vec4 fieldB(vec2 xz){ return texture2D(uFieldB, fieldUV(xz)); }
`;

// One wind for everything: prevailing wind + the player's splats + gusts.
// Mirrored in sim.js (windAt) so the CPU and Dalil see the same air.
export const WIND = /* glsl */`
uniform vec2 uPrevailing; uniform float uGust, uTime;
vec2 windAt(vec2 xz){
  vec2 local = (fieldB(xz).rg - 0.5) * 24.0;
  vec2 gust = uGust * vec2(sin(uTime * 1.3 + xz.x * 0.07 + sin(xz.y * 0.03)), cos(uTime * 1.1 + xz.y * 0.05 + sin(xz.x * 0.04)));
  return uPrevailing + local + gust;
}
`;

export const LIGHT = /* glsl */`
uniform vec3 uSunDir, uSunCol, uSkyCol, uGroundCol, uFogCol;
uniform float uFogDensity, uBands, uSaturation, uLightPhase;
float bandify(float x){ float b = floor(x * uBands); float e = smoothstep(0.42, 0.58, fract(x * uBands)); return mix(x, (b + e) / uBands, 0.75); }
vec3 painterly(vec3 albedo, vec3 N, vec3 V, float shade, vec2 xz){
  float wrap = dot(N, uSunDir) * 0.5 + 0.5;
  float brush = (vnoise(xz * 0.3) * 0.6 + vnoise(xz * 0.9) * 0.4) * 0.16 - 0.08;
  float x = clamp(wrap * mix(0.35, 1.0, shade) + brush, 0.0, 1.0);
  vec3 light = uSunCol * bandify(x);
  vec3 hemi = mix(uGroundCol, uSkyCol, N.y * 0.5 + 0.5) * 0.42;
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0) * smoothstep(0.3, 0.9, dot(uSunDir, -V) * 0.5 + 0.5) * 0.25;
  return albedo * (light + hemi) + uSunCol * rim * albedo;
}
vec3 grade(vec3 c){ float l = dot(c, vec3(0.299, 0.587, 0.114)); return mix(vec3(l), c, uSaturation); }
vec3 applyFog(vec3 c, float dist, float height){
  float f = 1.0 - exp(-dist * uFogDensity * exp(-max(height, 0.0) * 0.012));
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  return mix(mix(c, vec3(l), f * 0.35), uFogCol, f);
}
`;
