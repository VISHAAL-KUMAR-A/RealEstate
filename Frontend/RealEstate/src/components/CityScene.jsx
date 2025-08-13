import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, Float } from '@react-three/drei'
import { Suspense, useMemo } from 'react'
import * as THREE from 'three'

function Building({ x = 0, z = 0, height = 1, color = '#38bdf8' }) {
  const geometry = useMemo(() => new THREE.BoxGeometry(1, height, 1), [height])
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1 }), [color])
  return (
    <mesh geometry={geometry} material={material} position={[x, height / 2, z]} castShadow receiveShadow />
  )
}

function Blocks() {
  const blocks = useMemo(() => {
    const list = []
    const size = 10
    for (let i = -size; i <= size; i++) {
      for (let j = -size; j <= size; j++) {
        if ((i + j) % 2 === 0) continue
        const height = 0.6 + Math.abs(Math.sin(i * 0.7) * Math.cos(j * 0.5)) * 5 + (Math.random() * 0.5)
        const hue = 190 + ((i * j) % 40)
        list.push({ x: i * 1.25, z: j * 1.25, height, color: `hsl(${hue}, 80%, 55%)` })
      }
    }
    return list
  }, [])
  return (
    <group>
      {blocks.map((b, idx) => (
        <Building key={idx} {...b} />
      ))}
    </group>
  )
}

export default function CityScene() {
  return (
    <div className="absolute inset-0 -z-10" style={{maskImage:'linear-gradient(to bottom, black 60%, transparent 95%)', WebkitMaskImage:'linear-gradient(to bottom, black 60%, transparent 95%)'}}>
      <Canvas camera={{ position: [8, 8, 8], fov: 50 }} shadows>
        <color attach="background" args={[0, 0, 0]} />
        <fog attach="fog" args={[0x000000, 8, 40]} />
        <ambientLight intensity={0.08} />
        <directionalLight position={[10, 15, 10]} intensity={0.75} castShadow />
        <Suspense fallback={null}>
          <Environment preset="city" />
          <Float speed={1} rotationIntensity={0.15} floatIntensity={0.4}>
            <Blocks />
          </Float>
        </Suspense>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color="#070b12" />
        </mesh>
        <OrbitControls enablePan={false} minPolarAngle={0.9} maxPolarAngle={1.2} enableDamping />
      </Canvas>
      <div className="pointer-events-none absolute inset-0" style={{background:'rgba(0,0,0,0.55)'}} />
      <div className="pointer-events-none absolute inset-0 bg-radial-fade" />
    </div>
  )
}


