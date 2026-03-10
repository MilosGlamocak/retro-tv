import { Center, useGLTF } from "@react-three/drei"
import { CRTScreen } from "./CRTScreen"
import { useState, useRef, useCallback, useMemo } from "react"
import { useDragStore } from "../../store/dragStore"
import * as THREE from 'three'

export default function TV() {
  const { scene, nodes, materials } = useGLTF('./TV-texture.glb') as any
  const [volume, setVolume] = useState(0)
  const isDragging = useRef(false)
  const startY = useRef(0)
  const startVolume = useRef(0)
  const setDragging = useDragStore(s => s.setDragging)

  scene.traverse((child: any) => {
    if (child.isMesh) {
      child.castShadow = true
      child.receiveShadow = true
      if (child.name === 'Screen' || child.name === 'Button_Upper') {
        child.visible = false
      }
    }
  })

  const knobRotationZ = -0.6 + volume * 1.2

  const handlePointerDown = useCallback((e: any) => {
    e.stopPropagation()
    isDragging.current = true
    setDragging(true)
    startY.current = e.clientY
    startVolume.current = volume

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!isDragging.current) return
      const delta = (startY.current - moveEvent.clientY) / 150
      const newVolume = Math.min(1, Math.max(0, startVolume.current + delta))
      setVolume(newVolume)
    }

    const handlePointerUp = () => {
      isDragging.current = false
      setDragging(false)
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
      document.body.style.cursor = 'auto'
    }

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
    document.body.style.cursor = 'ns-resize'
  }, [volume, setDragging])

  const { centeredGeometry, groupPosition } = useMemo(() => {
  const geo = nodes.Button_Upper.geometry.clone()
  
  // Izračunaj centar PRIJE centriranja
  const box = new THREE.Box3().setFromBufferAttribute(
    geo.attributes.position as THREE.BufferAttribute
  )
  const center = new THREE.Vector3()
  box.getCenter(center)
  
  // Centriraj geometriju
  geo.center()
  
  // Group pozicija = originalna pozicija mesha + centar geometrije
  const groupPosition: [number, number, number] = [
    -0.22 + center.x,
    0.521 + center.y,
    -0.07 + center.z,
  ]
  
  return { centeredGeometry: geo, groupPosition }
}, [nodes.Button_Upper.geometry])

  return (
    <Center top position={[0, -1.5, 0]}>
      <primitive object={scene} />

        <group position={groupPosition}>
        <mesh
            geometry={centeredGeometry}
            material={materials.Black}
            rotation={[0, 0, knobRotationZ]}
            onPointerDown={handlePointerDown}
            onPointerOver={() => { if (!isDragging.current) document.body.style.cursor = 'ns-resize' }}
            onPointerOut={() => { if (!isDragging.current) document.body.style.cursor = 'auto' }}
            castShadow
            receiveShadow
        />
        </group>

      <CRTScreen
        geometry={nodes.Screen.geometry}
        videoSrc="./serbia-strong-original.mp4"
        volume={volume}
      />
    </Center>
  )
}

useGLTF.preload('./TV-texture.glb')