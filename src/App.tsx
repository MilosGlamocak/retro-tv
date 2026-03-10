import { Canvas } from '@react-three/fiber'
import { Backdrop } from '@react-three/drei'
import { Lighting } from './components/Lighting'
import { CameraControls } from './components/CameraControls'
import TV from './components/TV/TV'

export default function App() {
  return (
    <Canvas
      shadows
      camera={{ position: [1, -0.6, 3], fov: 50 }}
      style={{ width: '100vw', height: '100vh', background: '#080604' }}
    >
      <Lighting />
      <CameraControls />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#0b0303" roughness={1} />
      </mesh>

      <Backdrop floor={5} position={[0, -1.5, -5]} scale={[50, 10, 5]} receiveShadow>
        <meshStandardMaterial color="#0b0303" roughness={1} />
      </Backdrop>

      <TV />
    </Canvas>
  )
}