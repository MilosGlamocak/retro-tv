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
  uniform float uShowVolume;
  varying vec2 vUv;

  // Barrel distorzija — CRT zakrivljenost
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

  void main() {
    vec2 curvedUV = curveUV(vUv);

    // Sve izvan zakrivljenog ekrana = crno
    if (curvedUV.x < 0.0 || curvedUV.x > 1.0 || curvedUV.y < 0.0 || curvedUV.y > 1.0) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }

    vec4 color;

    if (uUseVideo) {
      // Video: greyscale sa chromatic aberration i phosphor tonom
      float aberration = 0.003;
      float r = texture2D(uTexture, curvedUV + vec2(aberration, 0.0)).r;
      float g = texture2D(uTexture, curvedUV).g;
      float b = texture2D(uTexture, curvedUV - vec2(aberration, 0.0)).b;
      float grey = r * 0.299 + g * 0.587 + b * 0.114;
      // Phosphor ton — blago zelenkasto kao stari CRT
      color = vec4(grey * 0.85, grey * 0.95, grey * 0.75, 1.0);
    } else {
      // Bez videa: statički šum sa roll efektom
      float n = noise(curvedUV, uTime * 10.0);
      float n2 = noise(curvedUV * 1.5, uTime * 7.3 + 1.0);
      float staticNoise = mix(n, n2, 0.5);
      float roll = sin(curvedUV.y * 3.0 + uTime * 2.0) * 0.01;
      float noiseRoll = noise(vec2(curvedUV.x + roll, curvedUV.y), uTime * 8.0);
      color = vec4(vec3(mix(staticNoise, noiseRoll, 0.3)), 1.0);
    }

    // Scanlines
    float scanline = sin(curvedUV.y * 800.0) * 0.04;
    color.rgb -= scanline;

    // Flicker
    color.rgb *= uFlicker;

    // Vignette
    vec2 vigUV = curvedUV * (1.0 - curvedUV.yx);
    float vignette = pow(vigUV.x * vigUV.y * 15.0, 0.3);
    color.rgb *= vignette;

    // ── Volume overlay ────────────────────────────────────────
    if (uShowVolume > 0.01) {
      float padX = 0.1;
      float padY = 0.75;
      float barWidth = 0.5;
      float barHeight = 0.05;
      float bgPad = 0.02;
      float barX0 = padX;
      float barX1 = padX + barWidth;
      float barY0 = padY;
      float barY1 = padY + barHeight;
      vec2 flatUV = vUv;

      // Tamna pozadina bar-a
      if (flatUV.x > barX0 - bgPad && flatUV.x < barX1 + bgPad &&
          flatUV.y > barY0 - bgPad * 5.0 && flatUV.y < barY1 + bgPad) {
        color.rgb = mix(color.rgb, vec3(0.0), uShowVolume * 0.85);
      }

      // Bar segmenti
      if (flatUV.x > barX0 && flatUV.x < barX1 &&
          flatUV.y > barY0 && flatUV.y < barY1) {
        float numSegs = 20.0;
        float segW = barWidth / numSegs;
        float segIndex = floor((flatUV.x - barX0) / segW);
        float segLocalX = mod(flatUV.x - barX0, segW) / segW;
        float activeSeg = floor(uVolume * numSegs);

        if (segLocalX < 0.82) {
          if (segIndex < activeSeg) {
            vec3 barColor = vec3(0.85, 0.95, 0.75);
            float scan = step(0.5, fract(flatUV.y * 50.0));
            color.rgb = mix(color.rgb, barColor * (0.65 + scan * 0.35), uShowVolume);
          } else {
            color.rgb = mix(color.rgb, vec3(0.07), uShowVolume * 0.9);
          }
        }
      }

      // Border oko bar-a
      float bt = 0.003;
      bool onBorderX = (flatUV.x > barX0 - bt && flatUV.x < barX0) ||
                       (flatUV.x > barX1 && flatUV.x < barX1 + bt);
      bool onBorderY = (flatUV.y > barY0 - bt && flatUV.y < barY0) ||
                       (flatUV.y > barY1 && flatUV.y < barY1 + bt);
      bool inRangeX = flatUV.x > barX0 - bt && flatUV.x < barX1 + bt;
      bool inRangeY = flatUV.y > barY0 - bt && flatUV.y < barY1 + bt;
      if ((onBorderX && inRangeY) || (onBorderY && inRangeX)) {
        color.rgb = mix(color.rgb, vec3(0.85, 0.95, 0.75), uShowVolume * 0.8);
      }
    }

    gl_FragColor = color;
  }
`

interface CRTScreenProps {
  geometry: THREE.BufferGeometry
  videoSrc?: string
  volume?: number
}

export function CRTScreen({ geometry, videoSrc, volume = 0 }: CRTScreenProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const videoTextureRef = useRef<THREE.VideoTexture | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fadingOut = useRef(false)

  const uniforms = useMemo(() => ({
    uTexture:     { value: null as THREE.Texture | null },
    uTime:        { value: 0 },
    uFlicker:     { value: 1.0 },
    uUseVideo:    { value: false },
    uVolume:      { value: 0 },
    uShowVolume:  { value: 0 },
  }), [])

  // Inicijalizacija video teksture kad se videoSrc promijeni
  useEffect(() => {
    // Zaustavi stari video
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.src = ''
    }
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
    return () => {
      video.removeEventListener('canplay', onCanPlay)
      video.pause()
      videoTextureRef.current?.dispose()
    }
  }, [videoSrc])

  // Volume promjena
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume
      videoRef.current.muted = volume === 0
      if (volume > 0) videoRef.current.play().catch(() => {})
    }

    uniforms.uVolume.value = volume
    uniforms.uShowVolume.value = 1.0
    fadingOut.current = false

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      fadingOut.current = true
    }, 2000)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [volume])

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.getElapsedTime()

    // Fade out volume overlay
    if (fadingOut.current) {
      uniforms.uShowVolume.value = THREE.MathUtils.lerp(
        uniforms.uShowVolume.value, 0.0, 0.03
      )
      if (uniforms.uShowVolume.value < 0.005) {
        uniforms.uShowVolume.value = 0.0
        fadingOut.current = false
      }
    }

    // Nasumični flicker
    if (Math.random() < 0.05) {
      uniforms.uFlicker.value = 0.85 + Math.random() * 0.15
    } else {
      uniforms.uFlicker.value = THREE.MathUtils.lerp(uniforms.uFlicker.value, 1.0, 0.1)
    }
  })

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={[-0.339, 0.156, -0.066]}
      castShadow
      receiveShadow
    >
      <shaderMaterial
        vertexShader={CRT_VERTEX}
        fragmentShader={CRT_FRAGMENT}
        uniforms={uniforms}
      />
    </mesh>
  )
}