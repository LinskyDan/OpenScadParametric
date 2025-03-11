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
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRef = useRef<THREE.Mesh | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(backgroundColor);

    // Camera setup
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    cameraRef.current = camera;
    camera.position.z = 5;

    // Renderer setup with preserveDrawingBuffer for context loss
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
      alpha: true
    });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Handle context loss
    const canvas = renderer.domElement;
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }, false);

    canvas.addEventListener('webglcontextrestored', () => {
      if (renderer && scene && camera) {
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        startAnimation();
      }
    }, false);

    containerRef.current.appendChild(canvas);

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
      const controls = new OrbitControls(camera, renderer.domElement);
      controlsRef.current = controls;
      controls.enableDamping = true;
      controls.dampingFactor = 0.25;
      controls.screenSpacePanning = false;
      controls.maxPolarAngle = Math.PI;
      controls.update();
    }

    // Animation loop
    const startAnimation = () => {
      const animate = () => {
        if (controlsRef.current) controlsRef.current.update();
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
        animationFrameRef.current = requestAnimationFrame(animate);
      };
      animate();
    };

    // Load STL
    fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.arrayBuffer();
      })
      .then(buffer => {
        if (containerRef.current) {
          try {
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
            const mesh = new THREE.Mesh(geometry, material);

            // Remove any existing model
            if (modelRef.current && sceneRef.current) {
              sceneRef.current.remove(modelRef.current);
              modelRef.current.geometry.dispose();
              modelRef.current.material.dispose();
            }

            scene.add(mesh);
            modelRef.current = mesh;
            setLoading(false);

            startAnimation();
          } catch (error) {
            console.error('Error parsing STL:', error);
          }
        }
      })
      .catch(error => {
        console.error('Error loading STL:', error);
      });

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (containerRef.current && rendererRef.current && rendererRef.current.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }

      if (modelRef.current && sceneRef.current) {
        sceneRef.current.remove(modelRef.current);
        modelRef.current.geometry.dispose();
        modelRef.current.material.dispose();
      }

      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
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
    </div>
  );
}

export default STLViewer;