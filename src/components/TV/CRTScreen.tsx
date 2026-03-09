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
      color = vec4(r, g, b, 1.0);
    } else {
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

  const uniforms = useMemo(() => ({
    uTexture: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uFlicker: { value: 1.0 },
    uUseVideo: { value: false },
  }), [])

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

  useEffect(() => {
    if (!videoRef.current) return
    videoRef.current.volume = volume
    videoRef.current.muted = volume === 0
    if (volume > 0) {
      videoRef.current.play().catch(() => {})
    }
  }, [volume])

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.getElapsedTime()
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