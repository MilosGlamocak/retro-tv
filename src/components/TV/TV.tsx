import { Center, useGLTF } from "@react-three/drei"
import { CRTScreen } from "./CRTScreen"
import { useState, useRef, useCallback, useMemo, useEffect } from "react"
import { useDragStore } from "../../store/dragStore"
import ChannelButton from "./ChannelButton"
import * as THREE from 'three'

// Pozicije direktno iz GLTF viewera nakon što si postavio origins u Blenderu
const CHANNEL_BUTTONS = [
  { channel: 1, name: 'Button_ch1', geo1: 'Plane003',   geo2: 'Plane003_1', position: [0.862, 0.465, -0.059] as [number, number, number] },
  { channel: 2, name: 'Button_ch2', geo1: 'Plane005_1', geo2: 'Plane005_2', position: [0.925, 0.465, -0.059] as [number, number, number] },
  { channel: 3, name: 'Button_ch3', geo1: 'Plane006',   geo2: 'Plane006_1', position: [0.988, 0.465, -0.059] as [number, number, number] },
  { channel: 4, name: 'Button_ch4', geo1: 'Plane007_1', geo2: 'Plane007_2', position: [0.862, 0.433, -0.059] as [number, number, number] },
  { channel: 5, name: 'Button_ch5', geo1: 'Plane009',   geo2: 'Plane009_1', position: [0.925, 0.433, -0.059] as [number, number, number] },
  { channel: 6, name: 'Button_ch6', geo1: 'Plane013',   geo2: 'Plane013_1', position: [0.988, 0.433, -0.059] as [number, number, number] },
  { channel: 7, name: 'Button_ch7', geo1: 'Plane014_1', geo2: 'Plane014_2', position: [0.862, 0.401, -0.059] as [number, number, number] },
  { channel: 8, name: 'Button_ch8', geo1: 'Plane015_1', geo2: 'Plane015_2', position: [0.925, 0.401, -0.059] as [number, number, number] },
  { channel: 9, name: 'Button_ch9', geo1: 'Plane016_1', geo2: 'Plane016_2', position: [0.988, 0.401, -0.059] as [number, number, number] },
]

const CHANNEL_VIDEOS: Record<number, string> = {
  1: './videos/channel1.mp4',
  2: './videos/channel2.mp4',
  3: './videos/channel3.mp4',
  4: './videos/channel4.mp4',
  5: './videos/channel5.mp4',
  6: './videos/channel6.mp4',
  7: './videos/channel7.mp4',
  8: './videos/channel8.mp4',
  9: './videos/channel9.mp4',
}

// Imena mesheva koje sakrivamo iz primitive i renderujemo odvojeno
const HIDDEN_MESH_NAMES = [
  'Mesh_9', 'Mesh_10',       // Button_Upper (volume knob)
  'Plane003', 'Plane003_1',
  'Plane005_1', 'Plane005_2',
  'Plane006', 'Plane006_1',
  'Plane007_1', 'Plane007_2',
  'Plane009', 'Plane009_1',
  'Plane013', 'Plane013_1',
  'Plane014_1', 'Plane014_2',
  'Plane015_1', 'Plane015_2',
  'Plane016_1', 'Plane016_2',
]

export default function TV() {
  const { scene, nodes, materials } = useGLTF('./TV.glb') as any
  const [volume, setVolume] = useState(0)
  const [activeChannel, setActiveChannel] = useState(1)
  const isDragging = useRef(false)
  const startY = useRef(0)
  const startVolume = useRef(0)
  const setDragging = useDragStore(s => s.setDragging)

  // Postavi shadows i sakrij mesheve koje renderujemo odvojeno
  useEffect(() => {
    scene.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        if (HIDDEN_MESH_NAMES.includes(child.name)) {
          child.visible = false
        }
      }
    })
  }, [scene])

  // ── Volume knob ──────────────────────────────────────────────
  // Button_Upper je sada na poziciji [0.714, 0.613, -0.02] iz GLTF viewera
  // Mesh_9 i Mesh_10 su relativni unutar te grupe, pa koristimo tu poziciju direktno

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
      setVolume(Math.min(1, Math.max(0, startVolume.current + delta)))
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

  // Centriraj geometriju knoba oko vlastite ose
  const { geo9, geo10, knobPosition } = useMemo(() => {
    if (!nodes?.Mesh_9?.geometry || !nodes?.Mesh_10?.geometry) {
      return { geo9: null, geo10: null, knobPosition: [0, 0, 0] as [number, number, number] }
    }

    const geo9 = nodes.Mesh_9.geometry.clone()
    const geo10 = nodes.Mesh_10.geometry.clone()

    const box = new THREE.Box3().setFromBufferAttribute(
      geo9.attributes.position as THREE.BufferAttribute
    )
    const center = new THREE.Vector3()
    box.getCenter(center)

    geo9.center()
    geo10.translate(-center.x, -center.y, -center.z)

    // Button_Upper pozicija iz GLTF viewera = [0.714, 0.613, -0.02]
    const knobPosition: [number, number, number] = [
      0.714 + center.x,
      0.613 + center.y,
      -0.02 + center.z,
    ]

    return { geo9, geo10, knobPosition }
  }, [nodes?.Mesh_9?.geometry, nodes?.Mesh_10?.geometry])

  // ── Channel dugmad ───────────────────────────────────────────
  const channelButtonData = useMemo(() => {
    return CHANNEL_BUTTONS.map(btn => {
      const n1 = nodes?.[btn.geo1]
      const n2 = nodes?.[btn.geo2]
      if (!n1?.geometry || !n2?.geometry) return null

      return {
        channel: btn.channel,
        geo1: n1.geometry,
        geo2: n2.geometry,
        position: btn.position,
      }
    }).filter(Boolean)
  }, [nodes])

  const handleChannelChange = (ch: number) => {
    setActiveChannel(ch)
  }

  return (
    <Center top position={[0, -1.5, 0]}>
      {/* Cijeli TV model — interaktivni meshevi su sakriveni */}
      <primitive object={scene} />

      {/* Volume knob — Button_Upper, rotira se drag-om */}
      {geo9 && geo10 && (
        <group
          position={knobPosition}
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

      {/* Channel dugmad — svako na svojoj poziciji iz Blendera */}
      {channelButtonData.map((btn: any) => (
        <ChannelButton
          key={btn.channel}
          geo1={btn.geo1}
          geo2={btn.geo2}
          mat1={materials.Black}
          mat2={materials.brojevi}
          position={btn.position}
          channel={btn.channel}
          isActive={activeChannel === btn.channel}
          onPress={handleChannelChange}
        />
      ))}

      {/* CRT ekran */}
      {nodes?.Screen?.geometry && (
        <CRTScreen
          geometry={nodes.Screen.geometry}
          videoSrc={CHANNEL_VIDEOS[activeChannel]}
          volume={volume}
        />
      )}
    </Center>
  )
}

useGLTF.preload('./TV.glb')