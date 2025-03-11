
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface STLViewerProps {
  url: string;
  width?: number | string;
  height?: number | string;
  modelcolor?: string;
  backgroundcolor?: string;
  rotate?: string | boolean;
  orbitcontrols?: string | boolean;
  shadows?: string | boolean;
  style?: React.CSSProperties;
}

export default function STLViewer({
  url,
  width = '100%',
  height = '100%',
  modelcolor = '#3b82f6',
  backgroundcolor = '#f8fafc',
  rotate = true,
  orbitcontrols = true,
  shadows = true,
  style
}: STLViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Refs to keep track of Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const modelRef = useRef<THREE.Mesh | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animationIdRef = useRef<number | null>(null);

  useEffect(() => {
    // Clear any previous error
    setError(null);
    setLoading(true);
    
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    
    // Get container dimensions
    const containerWidth = typeof width === 'string' ? 
      container.clientWidth : width;
    const containerHeight = typeof height === 'string' ? 
      container.clientHeight : height;
    
    // Setup scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundcolor as string);
    sceneRef.current = scene;
    
    // Setup camera
    const camera = new THREE.PerspectiveCamera(
      75, 
      containerWidth / containerHeight, 
      0.1, 
      1000
    );
    camera.position.z = 5;
    cameraRef.current = camera;
    
    // Setup renderer with error handling
    try {
      const renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true
      });
      renderer.setSize(containerWidth, containerHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      
      // Add to DOM
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;
      
      // Add lights
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambientLight);
      
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(1, 1, 1);
      if (shadows === true || shadows === 'true') {
        directionalLight.castShadow = true;
        renderer.shadowMap.enabled = true;
      }
      scene.add(directionalLight);
      
      // Add orbit controls if enabled
      if (orbitcontrols === true || orbitcontrols === 'true') {
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controlsRef.current = controls;
      }
      
      // Load STL file
      loadSTL(url, scene);
      
      // Animation loop
      const animate = () => {
        if (controlsRef.current) {
          controlsRef.current.update();
        }
        
        if (modelRef.current && (rotate === true || rotate === 'true')) {
          modelRef.current.rotation.y += 0.01;
        }
        
        renderer.render(scene, camera);
        animationIdRef.current = requestAnimationFrame(animate);
      };
      
      animate();
    } catch (err) {
      console.error('WebGL initialization error:', err);
      setError('Could not initialize WebGL renderer. Your browser might not support WebGL.');
      setLoading(false);
    }
    
    // Cleanup function
    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      
      if (rendererRef.current && rendererRef.current.domElement && container.contains(rendererRef.current.domElement)) {
        try {
          container.removeChild(rendererRef.current.domElement);
        } catch (e) {
          console.error('Error removing renderer:', e);
        }
      }
      
      if (modelRef.current && sceneRef.current) {
        try {
          sceneRef.current.remove(modelRef.current);
          if (modelRef.current.geometry) modelRef.current.geometry.dispose();
          if (modelRef.current.material) {
            if (Array.isArray(modelRef.current.material)) {
              modelRef.current.material.forEach(m => m.dispose());
            } else {
              modelRef.current.material.dispose();
            }
          }
        } catch (e) {
          console.error('Error cleaning up model:', e);
        }
      }
      
      if (rendererRef.current) {
        try {
          rendererRef.current.dispose();
        } catch (e) {
          console.error('Error disposing renderer:', e);
        }
      }
    };
  }, [url, width, height, backgroundcolor, modelcolor, rotate, orbitcontrols, shadows]);
  
  // Function to safely load and process STL file
  const loadSTL = (url: string, scene: THREE.Scene) => {
    // Fetch the STL file
    fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.arrayBuffer();
      })
      .then(buffer => {
        try {
          // Create a local loader that doesn't depend on external class
          const geometry = parseSTL(buffer);
          
          // Center geometry
          geometry.computeBoundingBox();
          if (geometry.boundingBox) {
            const center = new THREE.Vector3();
            geometry.boundingBox.getCenter(center);
            geometry.translate(-center.x, -center.y, -center.z);
            
            // Scale to reasonable size
            const maxDim = Math.max(
              geometry.boundingBox.max.x - geometry.boundingBox.min.x,
              geometry.boundingBox.max.y - geometry.boundingBox.min.y,
              geometry.boundingBox.max.z - geometry.boundingBox.min.z
            );
            const scale = 4 / maxDim;
            geometry.scale(scale, scale, scale);
          }
          
          // Create material and mesh
          const material = new THREE.MeshPhongMaterial({
            color: modelcolor as string,
            specular: 0x111111,
            shininess: 200,
            side: THREE.DoubleSide
          });
          
          const mesh = new THREE.Mesh(geometry, material);
          
          // Remove any existing model
          if (modelRef.current && sceneRef.current) {
            sceneRef.current.remove(modelRef.current);
            if (modelRef.current.geometry) modelRef.current.geometry.dispose();
            if (modelRef.current.material) {
              if (Array.isArray(modelRef.current.material)) {
                modelRef.current.material.forEach(m => m.dispose());
              } else {
                modelRef.current.material.dispose();
              }
            }
          }
          
          // Add new model to scene
          scene.add(mesh);
          modelRef.current = mesh;
          
          setLoading(false);
        } catch (error) {
          console.error('Error parsing STL:', error);
          setError('Failed to parse STL file. The file may be corrupted or in an unsupported format.');
          setLoading(false);
        }
      })
      .catch(error => {
        console.error('Error loading STL:', error);
        setError(`Failed to load STL: ${error.message}`);
        setLoading(false);
      });
  };
  
  // Custom STL parser with better error handling
  const parseSTL = (buffer: ArrayBuffer): THREE.BufferGeometry => {
    const geometry = new THREE.BufferGeometry();
    const decoder = new TextDecoder();
    
    // Check if binary or ASCII STL
    const isBinary = (() => {
      // Check file size matches expectations for binary format
      const dataView = new DataView(buffer);
      
      try {
        if (buffer.byteLength < 84) {
          return false; // File too small to be binary STL
        }
        
        const faceSize = (32 / 8 * 3) + ((32 / 8 * 3) * 3) + (16 / 8);
        const nFaces = dataView.getUint32(80, true);
        
        // Validate reasonable face count
        if (nFaces < 0 || nFaces > 5000000) {
          console.warn('Unreasonable face count in STL:', nFaces);
          return false;
        }
        
        const expectedSize = 84 + (nFaces * faceSize);
        
        // If file size matches expected size, it's likely binary
        if (Math.abs(expectedSize - buffer.byteLength) < 4) { // Allow small tolerance
          return true;
        }
        
        // Check for ASCII STL signature
        const header = decoder.decode(new Uint8Array(buffer, 0, 6)).toLowerCase();
        return header.indexOf('solid') === -1;
      } catch (e) {
        console.error('Error checking STL format:', e);
        return false;
      }
    })();
    
    if (isBinary) {
      try {
        return parseBinarySTL(buffer);
      } catch (e) {
        console.error('Binary STL parsing failed:', e);
        // Fall back to ASCII parsing as a last resort
        try {
          return parseAsciiSTL(buffer);
        } catch (e2) {
          console.error('ASCII fallback parsing also failed:', e2);
          // Return empty geometry as last resort
          return new THREE.BufferGeometry();
        }
      }
    } else {
      try {
        return parseAsciiSTL(buffer);
      } catch (e) {
        console.error('ASCII STL parsing failed:', e);
        // Return empty geometry as last resort
        return new THREE.BufferGeometry();
      }
    }
  };
  
  // Parse binary STL with robust error handling
  const parseBinarySTL = (buffer: ArrayBuffer): THREE.BufferGeometry => {
    const geometry = new THREE.BufferGeometry();
    const reader = new DataView(buffer);
    
    try {
      // Header is 80 bytes, face count is 4 bytes
      if (buffer.byteLength < 84) {
        throw new Error('STL file too small to be valid');
      }
      
      const faces = reader.getUint32(80, true);
      
      // Basic validation
      if (faces < 0 || faces > 5000000) {
        throw new Error(`Invalid number of faces in STL: ${faces}`);
      }
      
      // Calculate expected file size and check
      const expectedSize = 84 + (faces * 50); // 50 bytes per face in binary STL
      if (buffer.byteLength < expectedSize) {
        throw new Error(`STL file is truncated. Expected ${expectedSize} bytes, got ${buffer.byteLength}`);
      }
      
      const positions = [];
      const normals = [];
      
      // Start after header and face count (84 bytes)
      let offset = 84;
      
      for (let i = 0; i < faces; i++) {
        try {
          // Check if we have enough data for this face
          if (offset + 50 > buffer.byteLength) {
            console.warn(`STL file truncated at face ${i}/${faces}`);
            break;
          }
          
          // Normal vector (12 bytes: 3 floats x 4 bytes)
          const nx = reader.getFloat32(offset, true);
          const ny = reader.getFloat32(offset + 4, true);
          const nz = reader.getFloat32(offset + 8, true);
          offset += 12;
          
          // For each vertex in triangle (3 vertices)
          for (let j = 0; j < 3; j++) {
            // Vertex coordinates (12 bytes: 3 floats x 4 bytes)
            const x = reader.getFloat32(offset, true);
            const y = reader.getFloat32(offset + 4, true);
            const z = reader.getFloat32(offset + 8, true);
            offset += 12;
            
            // Add vertex data
            positions.push(x, y, z);
            normals.push(nx, ny, nz);
          }
          
          // Skip attribute byte count (2 bytes)
          offset += 2;
        } catch (e) {
          console.error(`Error parsing face ${i}:`, e);
          break;
        }
      }
      
      // Create geometry attributes
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      
      return geometry;
    } catch (e) {
      console.error('Fatal error parsing binary STL:', e);
      throw e;
    }
  };
  
  // Parse ASCII STL with robust error handling
  const parseAsciiSTL = (buffer: ArrayBuffer): THREE.BufferGeometry => {
    const geometry = new THREE.BufferGeometry();
    
    try {
      const decoder = new TextDecoder();
      const text = decoder.decode(buffer).trim();
      
      // Basic validation
      if (!text.toLowerCase().includes('solid') || !text.toLowerCase().includes('facet')) {
        throw new Error('File does not appear to be a valid ASCII STL');
      }
      
      const positions = [];
      const normals = [];
      
      // Regular expressions to match STL structures
      const facetRegex = /facet\s+normal\s+([^\s]+)\s+([^\s]+)\s+([^\s]+).*?endloop\s+endfacet/gs;
      const vertexRegex = /vertex\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)/g;
      
      let facetMatch;
      while ((facetMatch = facetRegex.exec(text)) !== null) {
        try {
          // Normal vector
          const nx = parseFloat(facetMatch[1]);
          const ny = parseFloat(facetMatch[2]);
          const nz = parseFloat(facetMatch[3]);
          
          // Extract the vertices for this facet
          const facetText = facetMatch[0];
          let vertexMatch;
          vertexRegex.lastIndex = 0; // Reset regex for this facet
          
          while ((vertexMatch = vertexRegex.exec(facetText)) !== null) {
            const x = parseFloat(vertexMatch[1]);
            const y = parseFloat(vertexMatch[2]);
            const z = parseFloat(vertexMatch[3]);
            
            positions.push(x, y, z);
            normals.push(nx, ny, nz);
          }
        } catch (e) {
          console.error('Error parsing ASCII STL facet:', e);
          continue;
        }
      }
      
      if (positions.length === 0) {
        throw new Error('No valid facets found in ASCII STL');
      }
      
      // Create geometry attributes
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      
      return geometry;
    } catch (e) {
      console.error('Fatal error parsing ASCII STL:', e);
      throw e;
    }
  };
  
  return (
    <div 
      ref={containerRef} 
      style={{
        width, 
        height, 
        position: 'relative',
        ...style
      }}
    >
      {loading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#333',
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          padding: '10px',
          borderRadius: '4px'
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
          color: '#721c24',
          backgroundColor: '#f8d7da',
          padding: '10px',
          borderRadius: '4px',
          maxWidth: '80%',
          textAlign: 'center'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
}
