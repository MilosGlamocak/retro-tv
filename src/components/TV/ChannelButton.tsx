import { useState } from 'react'
import { useSpring, animated } from '@react-spring/three'
import * as THREE from 'three'

interface Props {
  geo1: THREE.BufferGeometry
  geo2: THREE.BufferGeometry
  mat1: THREE.Material
  mat2: THREE.Material
  position: [number, number, number]
  channel: number
  isActive: boolean
  onPress: (channel: number) => void
}

export default function ChannelButton({
  geo1, geo2, mat1, mat2,
  position, channel, onPress
}: Props) {
  const [pressed, setPressed] = useState(false)
  

  // Dugme se gura prema unutra po Z osi (prema TV-u)
  const { posZ } = useSpring({
    posZ: pressed ? position[2] - 0.01 : position[2],
    config: { tension: 400, friction: 30 },
  })

  const handlePress = () => {
    setPressed(true)
    onPress(channel)
    setTimeout(() => setPressed(false), 200)
    }

  return (
    // @ts-ignore
    <animated.group
      position-x={position[0]}
      position-y={position[1]}
      position-z={posZ}
      onPointerUp={(e: any) => {
        e.stopPropagation()
        handlePress()
      }}
      onPointerOver={() => { document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { document.body.style.cursor = 'auto' }}
    >
      <mesh geometry={geo1} material={mat1} castShadow receiveShadow />
      <mesh geometry={geo2} material={mat2} castShadow receiveShadow />
    </animated.group>
  )
}