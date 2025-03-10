import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CustomSTLLoader } from './CustomSTLLoader';

interface STLViewerProps {
  url: string;
  width?: number;
  height?: number;
  modelColor?: string;
  backgroundColor?: string;
  orbitControls?: boolean;
}

function STLViewer({ 
  url, 
  width = 400, 
  height = 400, 
  modelColor = '#00A6D6',
  backgroundColor = '#EAEAEA',
  orbitControls = true
}: STLViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let isUnmounted = false;
    let animationFrameId: number | null = null;
    let renderer: THREE.WebGLRenderer | null = null;
    let scene: THREE.Scene | null = null;
    let camera: THREE.PerspectiveCamera | null = null;
    let controls: OrbitControls | null = null;
    let mesh: THREE.Mesh | null = null;

    try {
      // Scene setup
      scene = new THREE.Scene();
      scene.background = new THREE.Color(backgroundColor);

      // Camera setup
      camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      camera.position.z = 5;

      // Renderer setup
      renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        powerPreference: 'high-performance',
        alpha: true
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(window.devicePixelRatio);

      // Handle context loss
      const handleContextLost = (event: Event) => {
        event.preventDefault();
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
        setError('WebGL context lost. Please refresh the page.');
      };

      const handleContextRestored = () => {
        if (renderer && scene && camera) {
          renderer.setSize(width, height);
          renderer.setPixelRatio(window.devicePixelRatio);
          setError(null);
          animate();
        }
      };

      renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);
      containerRef.current.appendChild(renderer.domElement);

      // Lighting
      const ambientLight = new THREE.AmbientLight(0x404040, 1);
      scene.add(ambientLight);

      const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1);
      directionalLight1.position.set(1, 1, 1);
      scene.add(directionalLight1);

      const directionalLight2 = new THREE.DirectionalLight(0xffffff, 1);
      directionalLight2.position.set(-1, -1, -1);
      scene.add(directionalLight2);

      // OrbitControls
      if (orbitControls) {
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.25;
        controls.screenSpacePanning = false;
        controls.maxPolarAngle = Math.PI;
        controls.update();
      }

      // Animation loop
      const animate = () => {
        if (isUnmounted) return;
        if (controls) controls.update();
        if (renderer && scene && camera) {
          renderer.render(scene, camera);
        }
        animationFrameId = requestAnimationFrame(animate);
      };

      // Load STL
      const loadSTL = async () => {
        try {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          const buffer = await response.arrayBuffer();

          if (isUnmounted) return;

          const loader = new CustomSTLLoader();
          const geometry = loader.parse(buffer);

          // Center geometry
          geometry.computeBoundingBox();
          const box = geometry.boundingBox;
          if (box) {
            const center = new THREE.Vector3();
            box.getCenter(center);
            geometry.translate(-center.x, -center.y, -center.z);

            // Normalize size
            const maxDim = Math.max(
              box.max.x - box.min.x,
              box.max.y - box.min.y,
              box.max.z - box.min.z
            );
            const scale = 2 / maxDim;
            geometry.scale(scale, scale, scale);
          }

          // Create material and mesh
          const material = new THREE.MeshPhongMaterial({
            color: modelColor,
            specular: 0x111111,
            shininess: 200
          });

          if (mesh && scene) {
            scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
          }

          mesh = new THREE.Mesh(geometry, material);
          scene?.add(mesh);
          setLoading(false);
          animate();
        } catch (err) {
          console.error('Error loading STL:', err);
          setError((err as Error).message);
          setLoading(false);
        }
      };

      loadSTL();

      return () => {
        isUnmounted = true;
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }

        if (containerRef.current && renderer?.domElement) {
          renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
          renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
          containerRef.current.removeChild(renderer.domElement);
        }

        if (mesh && scene) {
          scene.remove(mesh);
          mesh.geometry.dispose();
          mesh.material.dispose();
        }

        if (renderer) {
          renderer.dispose();
        }
      };
    } catch (err) {
      console.error('Error initializing viewer:', err);
      setError((err as Error).message);
      setLoading(false);
    }
  }, [url, width, height, backgroundColor, modelColor, orbitControls]);

  return (
    <div ref={containerRef} style={{ width, height, position: 'relative' }}>
      {loading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#333'
        }}>
          Loading model...
        </div>
      )}
      {error && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#ef4444',
          textAlign: 'center',
          padding: '1rem'
        }}>
          Error: {error}
          <br />
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '0.5rem',
              padding: '0.25rem 0.5rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              borderRadius: '0.25rem',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Refresh Page
          </button>
        </div>
      )}
    </div>
  );
}

export default STLViewer;