"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";

function OrbitalForms() {
  const group = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * 0.12;
    group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.22) * 0.16;
  });
  return (
    <group ref={group}>
      <mesh position={[-1.4, 0.2, 0]}>
        <icosahedronGeometry args={[0.8, 1]} />
        <meshPhysicalMaterial color="#8ce7ff" roughness={0.2} metalness={0.75} transmission={0.25} />
      </mesh>
      <mesh position={[1.2, -0.4, -0.2]}>
        <torusKnotGeometry args={[0.5, 0.14, 160, 24]} />
        <meshPhysicalMaterial color="#ffd38f" roughness={0.18} metalness={0.82} />
      </mesh>
    </group>
  );
}

function ShaderBackdrop() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  useFrame((state) => {
    if (!matRef.current) return;
    matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });
  return (
    <mesh position={[0, 0, -2.2]}>
      <planeGeometry args={[10, 6]} />
      <shaderMaterial
        ref={matRef}
        transparent
        uniforms={{
          uTime: { value: 0 },
        }}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying vec2 vUv;
          uniform float uTime;
          void main() {
            vec2 uv = vUv - 0.5;
            float r = length(uv);
            float wave = sin((uv.x * 8.0) + uTime * 0.8) * 0.08 + cos((uv.y * 6.0) - uTime * 0.6) * 0.08;
            float glow = smoothstep(0.8, 0.1, r + wave);
            vec3 deep = vec3(0.04, 0.07, 0.14);
            vec3 cyan = vec3(0.55, 0.92, 1.0);
            vec3 amber = vec3(1.0, 0.83, 0.56);
            vec3 color = mix(deep, cyan, glow * 0.65);
            color = mix(color, amber, smoothstep(0.85, 0.15, abs(uv.x + uv.y) + wave) * 0.25);
            gl_FragColor = vec4(color, glow * 0.75);
          }
        `}
      />
    </mesh>
  );
}

export function ImmersiveScene() {
  return (
    <div style={{ height: "58vh", minHeight: 420 }} className="glass">
      <Canvas camera={{ position: [0, 0.4, 4], fov: 40 }} dpr={[1, 1.8]}>
        <ambientLight intensity={0.35} />
        <directionalLight position={[2, 3, 2]} intensity={2.3} />
        <ShaderBackdrop />
        <OrbitalForms />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}
