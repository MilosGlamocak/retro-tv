import { Center, useGLTF } from "@react-three/drei"
import { CRTScreen } from "./CRTScreen"
import { useState, useRef, useCallback, useMemo, useEffect } from "react"
import { useDragStore } from "../../store/dragStore"
import ChannelButton from "./ChannelButton"
import * as THREE from 'three'

const CHANNEL_BUTTONS = [
  { channel: 1, name: 'Button_ch1', geo1: 'Plane003',   geo2: 'Plane003_1' },
  { channel: 2, name: 'Button_ch2', geo1: 'Plane005_1', geo2: 'Plane005_2' },
  { channel: 3, name: 'Button_ch3', geo1: 'Plane006',   geo2: 'Plane006_1' },
  { channel: 4, name: 'Button_ch4', geo1: 'Plane007_1', geo2: 'Plane007_2' },
  { channel: 5, name: 'Button_ch5', geo1: 'Plane009',   geo2: 'Plane009_1' },
  { channel: 6, name: 'Button_ch6', geo1: 'Plane013',   geo2: 'Plane013_1' },
  { channel: 7, name: 'Button_ch7', geo1: 'Plane014_1', geo2: 'Plane014_2' },
  { channel: 8, name: 'Button_ch8', geo1: 'Plane015_1', geo2: 'Plane015_2' },
  { channel: 9, name: 'Button_ch9', geo1: 'Plane016_1', geo2: 'Plane016_2' },
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

const HIDDEN_MESH_NAMES = [
  'Mesh_9', 'Mesh_10',   // Button_Upper  — volume knob
  'Mesh_7', 'Mesh_8',    // Button_Middle — brightness knob
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

// Dijeli logiku drag knoba — isti pattern za volume i brightness
function useKnobDrag(
  initialValue: number,
  onValue: (v: number) => void,
  setDragging: (v: boolean) => void
) {
  const isDragging = useRef(false)
  const startY = useRef(0)
  const startValue = useRef(initialValue)

  const onPointerDown = useCallback((e: any) => {
    e.stopPropagation()
    isDragging.current = true
    setDragging(true)
    startY.current = e.clientY
    startValue.current = initialValue

    const onMove = (ev: PointerEvent) => {
      if (!isDragging.current) return
      const delta = (startY.current - ev.clientY) / 150
      onValue(Math.min(1, Math.max(0, startValue.current + delta)))
    }
    const onUp = () => {
      isDragging.current = false
      setDragging(false)
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.body.style.cursor = 'auto'
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.body.style.cursor = 'ns-resize'
  }, [initialValue, onValue, setDragging])

  return { isDragging, onPointerDown }
}

export default function TV() {
  const { scene, nodes, materials } = useGLTF('./TV.glb') as any
  const [volume, setVolume] = useState(0)
  const [brightness, setBrightness] = useState(0.7)
  const [activeChannel, setActiveChannel] = useState(10)
  const setDragging = useDragStore(s => s.setDragging)

  useEffect(() => {
    scene.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        if (HIDDEN_MESH_NAMES.includes(child.name)) child.visible = false
      }
    })
  }, [scene])

  const volumeKnob = useKnobDrag(volume, setVolume, setDragging)
  const brightnessKnob = useKnobDrag(brightness, setBrightness, setDragging)

  // Kloniraj i centriraj geometriju knoba oko vlastite ose
  function prepareKnob(geoNode: any, markerNode: any, groupNode: any) {
    if (!geoNode?.geometry || !markerNode?.geometry || !groupNode) return null
    const geo1 = geoNode.geometry.clone()
    const geo2 = markerNode.geometry.clone()
    const box = new THREE.Box3().setFromBufferAttribute(geo1.attributes.position as THREE.BufferAttribute)
    const center = new THREE.Vector3()
    box.getCenter(center)
    geo1.center()
    geo2.translate(-center.x, -center.y, -center.z)
    const p = groupNode.position
    const position: [number, number, number] = [p.x + center.x, p.y + center.y, p.z + center.z]
    return { geo1, geo2, position }
  }

  const volumeKnobData = useMemo(() =>
    prepareKnob(nodes?.Mesh_9, nodes?.Mesh_10, nodes?.Button_Upper),
    [nodes?.Mesh_9?.geometry, nodes?.Mesh_10?.geometry]
  )

  const brightnessKnobData = useMemo(() =>
    prepareKnob(nodes?.Mesh_7, nodes?.Mesh_8, nodes?.Button_Middle),
    [nodes?.Mesh_7?.geometry, nodes?.Mesh_8?.geometry]
  )

  const channelButtonData = useMemo(() => {
    return CHANNEL_BUTTONS.map(btn => {
      const node = nodes?.[btn.name]
      const n1 = nodes?.[btn.geo1]
      const n2 = nodes?.[btn.geo2]
      if (!node || !n1?.geometry || !n2?.geometry) return null
      return {
        channel: btn.channel,
        geo1: n1.geometry,
        geo2: n2.geometry,
        position: [node.position.x, node.position.y, node.position.z] as [number, number, number],
      }
    }).filter(Boolean)
  }, [nodes])

  function KnobMesh({ data, value, mat1, mat2, knob }: {
    data: { geo1: THREE.BufferGeometry, geo2: THREE.BufferGeometry, position: [number, number, number] }
    value: number
    mat1: THREE.Material
    mat2: THREE.Material
    knob: ReturnType<typeof useKnobDrag>
  }) {
    const rotZ = -0.6 + value * 1.2
    return (
      <group
        position={data.position}
        onPointerDown={knob.onPointerDown}
        onPointerOver={() => { if (!knob.isDragging.current) document.body.style.cursor = 'ns-resize' }}
        onPointerOut={() => { if (!knob.isDragging.current) document.body.style.cursor = 'auto' }}
      >
        <mesh geometry={data.geo1} material={mat1} rotation={[0, 0, rotZ]} castShadow receiveShadow />
        <mesh geometry={data.geo2} material={mat2} rotation={[0, 0, rotZ]} castShadow receiveShadow />
      </group>
    )
  }

  return (
    <Center top position={[0, -1.5, 0]}>
      <primitive object={scene} />

      {volumeKnobData && (
        <KnobMesh
          data={volumeKnobData}
          value={volume}
          mat1={materials.Black}
          mat2={materials.White}
          knob={volumeKnob}
        />
      )}

      {brightnessKnobData && (
        <KnobMesh
          data={brightnessKnobData}
          value={brightness}
          mat1={materials.Black}
          mat2={materials.White}
          knob={brightnessKnob}
        />
      )}

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
          onPress={setActiveChannel}
        />
      ))}

      {nodes?.Screen?.geometry && (
        <CRTScreen
          geometry={nodes.Screen.geometry}
          videoSrc={CHANNEL_VIDEOS[activeChannel]}
          volume={volume}
          brightness={brightness}
        />
      )}
    </Center>
  )
}

useGLTF.preload('./TV.glb')