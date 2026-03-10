import { useEffect, useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CRT_VERTEX, CRT_FRAGMENT } from '../../shaders/crt.glsl'
import { OVERLAY_VERTEX, OVERLAY_FRAGMENT } from '../../shaders/overlay.glsl'

interface CRTScreenProps {
  geometry: THREE.BufferGeometry
  videoSrc?: string
  volume?: number
  brightness?: number
}

export function CRTScreen({ geometry, videoSrc, volume = 0, brightness = 0.7 }: CRTScreenProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const videoTextureRef = useRef<THREE.VideoTexture | null>(null)
  const volumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const brightnessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const volumeFading = useRef(false)
  const brightnessFading = useRef(false)
  const prevVolume = useRef(volume)
  const prevBrightness = useRef(brightness)

  const crtUniforms = useMemo(() => ({
    uTexture:    { value: null as THREE.Texture | null },
    uTime:       { value: 0 },
    uFlicker:    { value: 1.0 },
    uUseVideo:   { value: false },
    uBrightness: { value: brightness },
  }), [])

  const overlayUniforms = useMemo(() => ({
    uVolume:         { value: volume },
    uBrightness:     { value: brightness },
    uShowVolume:     { value: 0 },
    uShowBrightness: { value: 0 },
  }), [])

  // Video
  useEffect(() => {
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.src = '' }
    videoTextureRef.current?.dispose()
    videoTextureRef.current = null
    crtUniforms.uUseVideo.value = false
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
      crtUniforms.uTexture.value = vTex
      crtUniforms.uUseVideo.value = true
    }
    video.addEventListener('canplay', onCanPlay)
    return () => { video.removeEventListener('canplay', onCanPlay); video.pause(); videoTextureRef.current?.dispose() }
  }, [videoSrc])

  // Volume
  useEffect(() => {
    if (volume === prevVolume.current) return
    prevVolume.current = volume
    if (videoRef.current) {
      videoRef.current.volume = volume
      videoRef.current.muted = volume === 0
      if (volume > 0) videoRef.current.play().catch(() => {})
    }
    overlayUniforms.uVolume.value = volume
    overlayUniforms.uShowBrightness.value = 0
    brightnessFading.current = false
    overlayUniforms.uShowVolume.value = 1.0
    volumeFading.current = false
    if (volumeTimerRef.current) clearTimeout(volumeTimerRef.current)
    volumeTimerRef.current = setTimeout(() => { volumeFading.current = true }, 2000)
    return () => { if (volumeTimerRef.current) clearTimeout(volumeTimerRef.current) }
  }, [volume])

  // Brightness
  useEffect(() => {
    if (brightness === prevBrightness.current) return
    prevBrightness.current = brightness
    crtUniforms.uBrightness.value = brightness
    overlayUniforms.uBrightness.value = brightness
    overlayUniforms.uShowVolume.value = 0
    volumeFading.current = false
    overlayUniforms.uShowBrightness.value = 1.0
    brightnessFading.current = false
    if (brightnessTimerRef.current) clearTimeout(brightnessTimerRef.current)
    brightnessTimerRef.current = setTimeout(() => { brightnessFading.current = true }, 2000)
    return () => { if (brightnessTimerRef.current) clearTimeout(brightnessTimerRef.current) }
  }, [brightness])

  useFrame(({ clock }) => {
    crtUniforms.uTime.value = clock.getElapsedTime()

    if (volumeFading.current) {
      overlayUniforms.uShowVolume.value = THREE.MathUtils.lerp(overlayUniforms.uShowVolume.value, 0.0, 0.03)
      if (overlayUniforms.uShowVolume.value < 0.005) { overlayUniforms.uShowVolume.value = 0.0; volumeFading.current = false }
    }
    if (brightnessFading.current) {
      overlayUniforms.uShowBrightness.value = THREE.MathUtils.lerp(overlayUniforms.uShowBrightness.value, 0.0, 0.03)
      if (overlayUniforms.uShowBrightness.value < 0.005) { overlayUniforms.uShowBrightness.value = 0.0; brightnessFading.current = false }
    }

    if (Math.random() < 0.05) {
      crtUniforms.uFlicker.value = 0.85 + Math.random() * 0.15
    } else {
      crtUniforms.uFlicker.value = THREE.MathUtils.lerp(crtUniforms.uFlicker.value, 1.0, 0.1)
    }
  })

  // Overlay je tanka ravnina ispred ekrana, isti geometry ali malo ispred po Z
  return (
    <>
      <mesh geometry={geometry} position={[-0.339, 0.156, -0.066]} renderOrder={1} castShadow receiveShadow>
        <shaderMaterial vertexShader={CRT_VERTEX} fragmentShader={CRT_FRAGMENT} uniforms={crtUniforms} />
      </mesh>
      <mesh geometry={geometry} position={[-0.339, 0.156, -0.065]} renderOrder={2}>
        <shaderMaterial
          vertexShader={OVERLAY_VERTEX}
          fragmentShader={OVERLAY_FRAGMENT}
          uniforms={overlayUniforms}
          transparent
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
    </>
  )
}