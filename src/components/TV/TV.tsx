import { Center, useGLTF } from "@react-three/drei"
import { CRTScreen } from "./CRTScreen"
import { useState, useRef, useCallback, useMemo, useEffect } from "react"
import { useDragStore } from "../../store/dragStore"
import * as THREE from 'three'

export default function TV() {
  const { scene, nodes, materials } = useGLTF('./TV-texture-buttons.glb') as any
  const [volume, setVolume] = useState(0)
  const isDragging = useRef(false)
  const startY = useRef(0)
  const startVolume = useRef(0)
  const setDragging = useDragStore(s => s.setDragging)

  useEffect(() => {
    scene.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
      // Sakrij Button_Upper group i njegove child mesheve
      if (child.name === 'Mesh_9' || child.name === 'Mesh_10') {
        child.visible = false
      }
    })
  }, [scene])

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

  // Isti useMemo pristup kao u starom kodu — ali koristimo Mesh_9 geometriju
  // Button_Upper group je na [-0.22, 0.521, -0.07]
  const { geo9, geo10, groupPosition } = useMemo(() => {
    if (!nodes?.Mesh_9?.geometry || !nodes?.Mesh_10?.geometry) {
      return { geo9: null, geo10: null, groupPosition: [0, 0, 0] as [number, number, number] }
    }

    const geo9 = nodes.Mesh_9.geometry.clone()
    const geo10 = nodes.Mesh_10.geometry.clone()

    // Izračunaj centar od Mesh_9 geometrije
    const box = new THREE.Box3().setFromBufferAttribute(
      geo9.attributes.position as THREE.BufferAttribute
    )
    const center = new THREE.Vector3()
    box.getCenter(center)

    // Centriraj obje geometrije oko iste ose
    geo9.center()
    geo10.translate(-center.x, -center.y, -center.z)

    // Group pozicija = Button_Upper pozicija + centar geometrije
    const groupPosition: [number, number, number] = [
      -0.22 + center.x,
      0.521 + center.y,
      -0.07 + center.z,
    ]

    return { geo9, geo10, groupPosition }
  }, [nodes?.Mesh_9?.geometry, nodes?.Mesh_10?.geometry])

  return (
    <Center top position={[0, -1.5, 0]}>
      <primitive object={scene} />

      {/* Button_Upper — centrirana geometrija, rotira oko vlastite ose */}
      {geo9 && geo10 && (
        <group
          position={groupPosition}
          onPointerDown={handlePointerDown}
          onPointerOver={() => { if (!isDragging.current) document.body.style.cursor = 'ns-resize' }}
          onPointerOut={() => { if (!isDragging.current) document.body.style.cursor = 'auto' }}
        >
          <mesh
            geometry={geo9}
            material={materials.Black}
            rotation={[0, 0, knobRotationZ]}
            castShadow
            receiveShadow
          />
          <mesh
            geometry={geo10}
            material={materials.White}
            rotation={[0, 0, knobRotationZ]}
            castShadow
            receiveShadow
          />
        </group>
      )}

      {/* CRT ekran */}
      {nodes?.Screen?.geometry && (
        <CRTScreen
          geometry={nodes.Screen.geometry}
          videoSrc="./serbia-strong-original.mp4"
          volume={volume}
        />
      )}
    </Center>
  )
}

useGLTF.preload('./TV-texture-buttons.glb')