import { OrbitControls } from '@react-three/drei'

export function CameraControls() {
  return (
    <OrbitControls
      enableDamping
      dampingFactor={0.05}
      minDistance={2}
      maxDistance={10}
      target={[0, -0.6, 0]}
      minAzimuthAngle={-Math.PI}
      maxAzimuthAngle={Math.PI}
      minPolarAngle={Math.PI / 6}
      maxPolarAngle={Math.PI / 2}
    />
  )
}