import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { CustomSTLLoader } from './CustomSTLLoader';

function STLViewer({ 
  url, 
  width = 400, 
  height = 400, 
  modelColor = '#00A6D6',
  backgroundColor = '#EAEAEA',
  orbitControls = true
}) {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const modelRef = useRef(null);
  const animationFrameRef = useRef(null);
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
    canvas.addEventListener('webglcontextlost', function(event) {
      event.preventDefault();
      console.log('WebGL context lost, attempting to restore');

      // Cancel animation loop
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Signal that we'll handle context restoration
      return true;
    }, false);

    canvas.addEventListener('webglcontextrestored', function() {
      console.log('WebGL context restored');

      // Rebuild the renderer
      renderer.setSize(width, height);
      renderer.setPixelRatio(window.devicePixelRatio);

      // Re-render the scene
      if (sceneRef.current && cameraRef.current) {
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

    // Start animation loop
    const startAnimation = () => {
      const animate = () => {
        if (controlsRef.current) controlsRef.current.update();
        renderer.render(scene, camera);
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
            // Use our custom STL loader
            const loader = new CustomSTLLoader();
            const geometry = loader.parse(buffer);

            // Center geometry
            geometry.computeBoundingBox();
            const box = geometry.boundingBox;
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

            // Create material and mesh
            const material = new THREE.MeshPhongMaterial({
              color: modelColor,
              specular: 0x111111,
              shininess: 200
            });
            const mesh = new THREE.Mesh(geometry, material);

            // Remove any existing model
            if (modelRef.current) {
              scene.remove(modelRef.current);
              modelRef.current.geometry.dispose();
              modelRef.current.material.dispose();
            }

            scene.add(mesh);
            modelRef.current = mesh;
            setLoading(false);

            // Start animation loop
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

      if (containerRef.current && containerRef.current.contains(canvas)) {
        containerRef.current.removeChild(canvas);
      }

      if (modelRef.current) {
        scene.remove(modelRef.current);
        modelRef.current.geometry.dispose();
        modelRef.current.material.dispose();
      }

      renderer.dispose();

      // Clean up event listeners
      canvas.removeEventListener('webglcontextlost', () => {});
      canvas.removeEventListener('webglcontextrestored', () => {});
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