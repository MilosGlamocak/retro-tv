import { useEffect, useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const CRT_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const CRT_FRAGMENT = `
  uniform sampler2D uTexture;
  uniform float uTime;
  uniform float uFlicker;
  uniform bool uUseVideo;
  uniform float uVolume;
  uniform float uBrightness;
  uniform float uShowVolume;
  uniform float uShowBrightness;
  varying vec2 vUv;

  vec2 curveUV(vec2 uv) {
    uv = uv * 2.0 - 1.0;
    vec2 offset = abs(uv.yx) / vec2(6.0, 4.0);
    uv = uv + uv * offset * offset;
    uv = uv * 0.5 + 0.5;
    return uv;
  }

  float noise(vec2 uv, float t) {
    return fract(sin(dot(uv * t, vec2(127.1, 311.7))) * 43758.5453);
  }

  // Crta jedan piksel slova iz 5x5 bitmape
  // bits: 25-bitni int, redovi odozdo prema gore, stupci s lijeva
  float letter(vec2 uv, vec2 origin, float size, int bits) {
    vec2 p = (uv - origin) / size;
    if (p.x < 0.0 || p.x > 5.0 || p.y < 0.0 || p.y > 5.0) return 0.0;
    int col = int(p.x);
    int row = int(p.y);
    int idx = row * 5 + col;
    // Provjeri bit na poziciji idx
    int shifted = bits / int(pow(2.0, float(idx)));
    return float(shifted - (shifted / 2) * 2);
  }

  // Crta string od max 3 slova
  float drawLabel(vec2 uv, vec2 origin, float size, int b0, int b1, int b2, int count) {
    float lit = 0.0;
    float spacing = size * 6.0;
    lit += letter(uv, origin, size, b0);
    if (count > 1) lit += letter(uv, origin + vec2(spacing, 0.0), size, b1);
    if (count > 2) lit += letter(uv, origin + vec2(spacing * 2.0, 0.0), size, b2);
    return clamp(lit, 0.0, 1.0);
  }

  void drawBar(vec2 flatUV, float value, vec3 barColor, float show, inout vec4 color) {
    float barX0 = 0.1;
    float barX1 = 0.6;
    float barY0 = 0.17;
    float barY1 = 0.22;
    float bgPad = 0.015;

    // Tamna pozadina
    if (flatUV.x > barX0 - bgPad && flatUV.x < barX1 + bgPad &&
        flatUV.y > barY0 - bgPad * 1.0 && flatUV.y < barY1 + bgPad)
      color.rgb = mix(color.rgb, vec3(0.0), show * 0.85);

    // Bar segmenti
    if (flatUV.x > barX0 && flatUV.x < barX1 &&
        flatUV.y > barY0 && flatUV.y < barY1) {
      float numSegs = 20.0;
      float segW = (barX1 - barX0) / numSegs;
      float segIndex = floor((flatUV.x - barX0) / segW);
      float segLocalX = mod(flatUV.x - barX0, segW) / segW;
      float activeSeg = floor(value * numSegs);
      if (segLocalX < 0.82) {
        if (segIndex < activeSeg) {
          float scan = step(0.5, fract(flatUV.y * 50.0));
          color.rgb = mix(color.rgb, barColor * (0.65 + scan * 0.35), show);
        } else {
          color.rgb = mix(color.rgb, vec3(0.07), show * 0.9);
        }
      }
    }

    // Border
    float bt = 0.003;
    bool onBorderX = (flatUV.x > barX0 - bt && flatUV.x < barX0) || (flatUV.x > barX1 && flatUV.x < barX1 + bt);
    bool onBorderY = (flatUV.y > barY0 - bt && flatUV.y < barY0) || (flatUV.y > barY1 && flatUV.y < barY1 + bt);
    bool inRangeX = flatUV.x > barX0 - bt && flatUV.x < barX1 + bt;
    bool inRangeY = flatUV.y > barY0 - bt && flatUV.y < barY1 + bt;
    if ((onBorderX && inRangeY) || (onBorderY && inRangeX))
      color.rgb = mix(color.rgb, barColor, show * 0.8);
  }

  void main() {
    vec2 curvedUV = curveUV(vUv);

    if (curvedUV.x < 0.0 || curvedUV.x > 1.0 || curvedUV.y < 0.0 || curvedUV.y > 1.0) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }

    vec4 color;

    if (uUseVideo) {
      float aberration = 0.003;
      float r = texture2D(uTexture, curvedUV + vec2(aberration, 0.0)).r;
      float g = texture2D(uTexture, curvedUV).g;
      float b = texture2D(uTexture, curvedUV - vec2(aberration, 0.0)).b;
      float grey = r * 0.299 + g * 0.587 + b * 0.114;
      color = vec4(grey * 0.85, grey * 0.95, grey * 0.75, 1.0);
    } else {
      float n = noise(curvedUV, uTime * 10.0);
      float n2 = noise(curvedUV * 1.5, uTime * 7.3 + 1.0);
      float staticNoise = mix(n, n2, 0.5);
      float roll = sin(curvedUV.y * 3.0 + uTime * 2.0) * 0.01;
      float noiseRoll = noise(vec2(curvedUV.x + roll, curvedUV.y), uTime * 8.0);
      color = vec4(vec3(mix(staticNoise, noiseRoll, 0.3)), 1.0);
    }

    float bScale = 0.2 + uBrightness * 1.4;
    color.rgb *= bScale;

    float scanline = sin(curvedUV.y * 800.0) * 0.04;
    color.rgb -= scanline;
    color.rgb *= uFlicker;

    vec2 vigUV = curvedUV * (1.0 - curvedUV.yx);
    float vignette = pow(vigUV.x * vigUV.y * 15.0, 0.3);
    color.rgb *= vignette;

    // ── Overlay — isti bar, samo jedan aktivan u isto vrijeme ──
    vec2 flatUV = vUv;
    float showV = uShowVolume;
    float showB = uShowBrightness;

    // Label iznad bara — Y inverzija jer vUv Y raste prema gore
    // Bar je na 0.22-0.27, label ide ispod bara u UV prostoru = vizualno iznad
    float labelX = 0.1;
    float labelY = 0.18;  // ispod bara u UV = iznad u prikazu
    float ps = 0.007;
    // Koristimo 1.0 - p.y trick za flip slova
    vec2 p = vec2(flatUV.x, 1.0 - flatUV.y);

    if (showV > 0.01) {
      float litV = 0.0; float litO = 0.0; float litL = 0.0;
      float ox = labelX; float oy = labelY;

      // V — širi pri vrhu, spaja se pri dnu
      if (p.x>ox        && p.x<ox+ps     && p.y>oy+3.0*ps && p.y<oy+5.0*ps) litV=1.0;
      if (p.x>ox+4.0*ps && p.x<ox+5.0*ps && p.y>oy+3.0*ps && p.y<oy+5.0*ps) litV=1.0;
      if (p.x>ox+ps     && p.x<ox+2.0*ps && p.y>oy+ps     && p.y<oy+3.0*ps) litV=1.0;
      if (p.x>ox+3.0*ps && p.x<ox+4.0*ps && p.y>oy+ps     && p.y<oy+3.0*ps) litV=1.0;
      if (p.x>ox+2.0*ps && p.x<ox+3.0*ps && p.y>oy        && p.y<oy+ps)     litV=1.0;

      // O
      ox = labelX + 6.0*ps;
      if (p.x>ox+ps     && p.x<ox+4.0*ps && p.y>oy+4.0*ps && p.y<oy+5.0*ps) litO=1.0;
      if (p.x>ox+ps     && p.x<ox+4.0*ps && p.y>oy        && p.y<oy+ps)     litO=1.0;
      if (p.x>ox        && p.x<ox+ps     && p.y>oy        && p.y<oy+5.0*ps) litO=1.0;
      if (p.x>ox+4.0*ps && p.x<ox+5.0*ps && p.y>oy        && p.y<oy+5.0*ps) litO=1.0;

      // L
      ox = labelX + 12.0*ps;
      if (p.x>ox && p.x<ox+ps     && p.y>oy && p.y<oy+5.0*ps) litL=1.0;
      if (p.x>ox && p.x<ox+5.0*ps && p.y>oy && p.y<oy+ps)     litL=1.0;

      color.rgb = mix(color.rgb, vec3(0.85, 0.95, 0.75), clamp(litV+litO+litL,0.0,1.0) * showV);
      drawBar(flatUV, uVolume, vec3(0.85, 0.95, 0.75), showV, color);
    }

    if (showB > 0.01) {
      float litB = 0.0; float litR = 0.0; float litI = 0.0;
      float ox = labelX; float oy = labelY;

      // B
      if (p.x>ox        && p.x<ox+ps     && p.y>oy        && p.y<oy+5.0*ps) litB=1.0;
      if (p.x>ox+ps     && p.x<ox+4.0*ps && p.y>oy+4.0*ps && p.y<oy+5.0*ps) litB=1.0;
      if (p.x>ox+ps     && p.x<ox+4.0*ps && p.y>oy+2.0*ps && p.y<oy+3.0*ps) litB=1.0;
      if (p.x>ox+ps     && p.x<ox+4.0*ps && p.y>oy        && p.y<oy+ps)     litB=1.0;
      if (p.x>ox+4.0*ps && p.x<ox+5.0*ps && p.y>oy+3.0*ps && p.y<oy+4.0*ps) litB=1.0;
      if (p.x>ox+4.0*ps && p.x<ox+5.0*ps && p.y>oy+ps     && p.y<oy+2.0*ps) litB=1.0;

      // R
      ox = labelX + 6.0*ps;
      if (p.x>ox        && p.x<ox+ps     && p.y>oy        && p.y<oy+5.0*ps) litR=1.0;
      if (p.x>ox+ps     && p.x<ox+4.0*ps && p.y>oy+4.0*ps && p.y<oy+5.0*ps) litR=1.0;
      if (p.x>ox+ps     && p.x<ox+4.0*ps && p.y>oy+2.0*ps && p.y<oy+3.0*ps) litR=1.0;
      if (p.x>ox+4.0*ps && p.x<ox+5.0*ps && p.y>oy+3.0*ps && p.y<oy+4.0*ps) litR=1.0;
      if (p.x>ox+2.0*ps && p.x<ox+3.0*ps && p.y>oy+ps     && p.y<oy+2.0*ps) litR=1.0;
      if (p.x>ox+4.0*ps && p.x<ox+5.0*ps && p.y>oy        && p.y<oy+ps)     litR=1.0;

      // I
      ox = labelX + 12.0*ps;
      if (p.x>ox+ps     && p.x<ox+4.0*ps && p.y>oy+4.0*ps && p.y<oy+5.0*ps) litI=1.0;
      if (p.x>ox+ps     && p.x<ox+4.0*ps && p.y>oy        && p.y<oy+ps)     litI=1.0;
      if (p.x>ox+2.0*ps && p.x<ox+3.0*ps && p.y>oy        && p.y<oy+5.0*ps) litI=1.0;

      color.rgb = mix(color.rgb, vec3(0.95, 0.90, 0.65), clamp(litB+litR+litI,0.0,1.0) * showB);
      drawBar(flatUV, uBrightness, vec3(0.95, 0.90, 0.65), showB, color);
    }

    gl_FragColor = color;
  }
`

interface CRTScreenProps {
  geometry: THREE.BufferGeometry
  videoSrc?: string
  volume?: number
  brightness?: number
}

export function CRTScreen({ geometry, videoSrc, volume = 0, brightness = 0.7 }: CRTScreenProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const videoTextureRef = useRef<THREE.VideoTexture | null>(null)
  const volumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const brightnessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const volumeFading = useRef(false)
  const brightnessFading = useRef(false)

  const uniforms = useMemo(() => ({
    uTexture:        { value: null as THREE.Texture | null },
    uTime:           { value: 0 },
    uFlicker:        { value: 1.0 },
    uUseVideo:       { value: false },
    uVolume:         { value: volume },
    uBrightness:     { value: brightness },
    uShowVolume:     { value: 0 },
    uShowBrightness: { value: 0 },
  }), [])

  useEffect(() => {
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.src = '' }
    videoTextureRef.current?.dispose()
    videoTextureRef.current = null
    uniforms.uUseVideo.value = false
    if (!videoSrc) return

    const video = document.createElement('video')
    video.src = videoSrc
    video.loop = true
    video.muted = volume === 0
    video.playsInline = true
    videoRef.current = video

    const onCanPlay = () => {
      video.play().catch(() => {})
      const vTex = new THREE.VideoTexture(video)
      vTex.colorSpace = THREE.SRGBColorSpace
      vTex.flipY = false
      videoTextureRef.current = vTex
      uniforms.uTexture.value = vTex
      uniforms.uUseVideo.value = true
    }
    video.addEventListener('canplay', onCanPlay)
    return () => { video.removeEventListener('canplay', onCanPlay); video.pause(); videoTextureRef.current?.dispose() }
  }, [videoSrc])

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume
      videoRef.current.muted = volume === 0
      if (volume > 0) videoRef.current.play().catch(() => {})
    }
    uniforms.uVolume.value = volume
    // Sakrij brightness, pokaži volume
    uniforms.uShowBrightness.value = 0
    brightnessFading.current = false
    uniforms.uShowVolume.value = 1.0
    volumeFading.current = false
    if (volumeTimerRef.current) clearTimeout(volumeTimerRef.current)
    volumeTimerRef.current = setTimeout(() => { volumeFading.current = true }, 2000)
    return () => { if (volumeTimerRef.current) clearTimeout(volumeTimerRef.current) }
  }, [volume])

  useEffect(() => {
    uniforms.uBrightness.value = brightness
    // Sakrij volume, pokaži brightness
    uniforms.uShowVolume.value = 0
    volumeFading.current = false
    uniforms.uShowBrightness.value = 1.0
    brightnessFading.current = false
    if (brightnessTimerRef.current) clearTimeout(brightnessTimerRef.current)
    brightnessTimerRef.current = setTimeout(() => { brightnessFading.current = true }, 2000)
    return () => { if (brightnessTimerRef.current) clearTimeout(brightnessTimerRef.current) }
  }, [brightness])

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.getElapsedTime()

    if (volumeFading.current) {
      uniforms.uShowVolume.value = THREE.MathUtils.lerp(uniforms.uShowVolume.value, 0.0, 0.03)
      if (uniforms.uShowVolume.value < 0.005) { uniforms.uShowVolume.value = 0.0; volumeFading.current = false }
    }
    if (brightnessFading.current) {
      uniforms.uShowBrightness.value = THREE.MathUtils.lerp(uniforms.uShowBrightness.value, 0.0, 0.03)
      if (uniforms.uShowBrightness.value < 0.005) { uniforms.uShowBrightness.value = 0.0; brightnessFading.current = false }
    }

    if (Math.random() < 0.05) {
      uniforms.uFlicker.value = 0.85 + Math.random() * 0.15
    } else {
      uniforms.uFlicker.value = THREE.MathUtils.lerp(uniforms.uFlicker.value, 1.0, 0.1)
    }
  })

  return (
    <mesh ref={meshRef} geometry={geometry} position={[-0.339, 0.156, -0.066]} castShadow receiveShadow>
      <shaderMaterial vertexShader={CRT_VERTEX} fragmentShader={CRT_FRAGMENT} uniforms={uniforms} />
    </mesh>
  )
}