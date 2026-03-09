import { Center, useGLTF } from "@react-three/drei"
import { CRTScreen } from "./CRTScreen"

export default function TV() {
  const { scene, nodes } = useGLTF('/TV-texture.glb') as any

  // Ukloni Screen mesh iz scene, CRTScreen ga renderuje odvojeno
  scene.traverse((child: any) => {
    if (child.isMesh) {
      child.castShadow = true
      child.receiveShadow = true
      if (child.name === 'Screen') {
        child.visible = false  // Sakrij originalni, CRTScreen ga zamjenjuje
      }
    }
  })

  return (
    <Center top position={[0, -1.5, 0]}>
      <primitive object={scene} />
      <CRTScreen geometry={nodes.Screen.geometry} videoSrc="/serbia-strong-original.mp4" />
    </Center>
  )
}

useGLTF.preload('/TV-texture.glb')