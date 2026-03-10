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
        // Pretvori u greyscale
        float grey = r * 0.299 + g * 0.587 + b * 0.114;
        // Blagi sepia/fosfor ton — klasični CRT phosphor
        color = vec4(grey * 0.85, grey * 0.95, grey * 0.75, 1.0);
        } else {
        // Statički šum ostaje isti
        float n = noise(curvedUV, uTime * 10.0);
        float n2 = noise(curvedUV * 1.5, uTime * 7.3 + 1.0);
        float staticNoise = mix(n, n2, 0.5);
        float roll = sin(curvedUV.y * 3.0 + uTime * 2.0) * 0.01;
        float noiseRoll = noise(vec2(curvedUV.x + roll, curvedUV.y), uTime * 8.0);
        color = vec4(vec3(mix(staticNoise, noiseRoll, 0.3)), 1.0);
    }

    float scanline = sin(curvedUV.y * 800.0) * 0.04;
    color.rgb -= scanline;
    color.rgb *= uFlicker;

    vec2 vigUV = curvedUV * (1.0 - curvedUV.yx);
    float vignette = pow(vigUV.x * vigUV.y * 15.0, 0.3);
    color.rgb *= vignette;

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

    // Koristimo vUv umjesto curvedUV — bez curve distorzije na baru
    vec2 flatUV = vUv;

    if (flatUV.x > barX0 - bgPad && flatUV.x < barX1 + bgPad &&
        flatUV.y > barY0 - bgPad * 5.0 && flatUV.y < barY1 + bgPad) {
        color.rgb = mix(color.rgb, vec3(0.0), uShowVolume * 0.85);
    }

    float textY0 = barY0 - 0.045;
    float textY1 = textY0 + 0.03;
    if (flatUV.y > textY0 && flatUV.y < textY1 &&
        flatUV.x > barX0 && flatUV.x < barX0 + 0.25) {
        float px = floor((flatUV.x - barX0) / 0.006);
        float py = floor((flatUV.y - textY0) / 0.006);
        float lit = 0.0;
        if ((px == 0.0 || px == 3.0) && py <= 3.0) lit = 1.0;
        if ((px == 1.0 || px == 2.0) && py == 4.0) lit = 1.0;
        if (px >= 5.0 && px <= 8.0) {
        float lx = px - 5.0;
        if ((lx == 0.0 || lx == 3.0) && py <= 4.0) lit = 1.0;
        if ((py == 0.0 || py == 4.0) && lx >= 1.0 && lx <= 2.0) lit = 1.0;
        }
        if (px >= 10.0 && px <= 13.0) {
        if (px == 10.0 && py <= 4.0) lit = 1.0;
        if (py == 4.0 && px >= 10.0 && px <= 13.0) lit = 1.0;
        }
        if (lit > 0.0) color.rgb = mix(color.rgb, vec3(0.85, 0.95, 0.75), uShowVolume);
    }

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
  const noiseTextureRef = useRef<THREE.DataTexture | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fadingOut = useRef(false)

  const uniforms = useMemo(() => ({
    uTexture: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uFlicker: { value: 1.0 },
    uUseVideo: { value: false },
    uVolume: { value: 0 },
    uShowVolume: { value: 0 },
  }), [])

  // Inicijalizacija video i noise teksture
  useEffect(() => {
    const size = 64
    const data = new Uint8Array(size * size * 4)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 255
    const noiseTex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
    noiseTex.needsUpdate = true
    noiseTextureRef.current = noiseTex
    uniforms.uTexture.value = noiseTex

    if (!videoSrc) return

    const video = document.createElement('video')
    video.src = videoSrc
    video.loop = true
    video.muted = true
    video.playsInline = true
    videoRef.current = video

    const onCanPlay = () => {
      video.play()
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
      noiseTextureRef.current?.dispose()
    }
  }, [videoSrc])

  // Reaguj na volume promjenu
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume
      videoRef.current.muted = volume === 0
      if (volume > 0) videoRef.current.play().catch(() => {})
    }

    // Prikaži overlay i resetuj timer
    uniforms.uVolume.value = volume
    uniforms.uShowVolume.value = 1.0
    fadingOut.current = false

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      fadingOut.current = true
      timerRef.current = null
    }, 2000)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [volume])

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.getElapsedTime()

    // Fade out kad timer istekne
    if (fadingOut.current) {
      uniforms.uShowVolume.value = THREE.MathUtils.lerp(
        uniforms.uShowVolume.value, 0.0, 0.03
      )
      if (uniforms.uShowVolume.value < 0.005) {
        uniforms.uShowVolume.value = 0.0
        fadingOut.current = false
      }
    }

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

// if (uUseVideo) {
//       float aberration = 0.003;
//       float r = texture2D(uTexture, curvedUV + vec2(aberration, 0.0)).r;
//       float g = texture2D(uTexture, curvedUV).g;
//       float b = texture2D(uTexture, curvedUV - vec2(aberration, 0.0)).b;
//       color = vec4(r, g, b, 1.0);
//     } else {
//       float n = noise(curvedUV, uTime * 10.0);
//       float n2 = noise(curvedUV * 1.5, uTime * 7.3 + 1.0);
//       float staticNoise = mix(n, n2, 0.5);
//       float roll = sin(curvedUV.y * 3.0 + uTime * 2.0) * 0.01;
//       float noiseRoll = noise(vec2(curvedUV.x + roll, curvedUV.y), uTime * 8.0);
//       color = vec4(vec3(mix(staticNoise, noiseRoll, 0.3)), 1.0);
//     }

//if (lit > 0.0) color.rgb = mix(color.rgb, vec3(0.1, 1.0, 0.3), uShowVolume);

//  if (segLocalX < 0.82) {
//         if (segIndex < activeSeg) {
//             vec3 barColor = vec3(0.1, 0.95, 0.2);
//             float scan = step(0.5, fract(flatUV.y * 50.0));
//             color.rgb = mix(color.rgb, barColor * (0.65 + scan * 0.35), uShowVolume);
//         } else {
//             color.rgb = mix(color.rgb, vec3(0.07), uShowVolume * 0.9);
//         }
//         }