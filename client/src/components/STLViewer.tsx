
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// Use TextDecoder instead of THREE.LoaderUtils.decodeText
function decodeText(array) {
  const decoder = new TextDecoder();
  return decoder.decode(array);
}

// Custom STL loader using TextDecoder instead of THREE.LoaderUtils
class CustomSTLLoader {
  parse(data) {
    const binData = this.ensureBinary(data);
    
    // Try ASCII first
    const text = decodeText(binData);
    if (text.indexOf('solid') !== -1) {
      return this.parseASCII(text);
    } else {
      return this.parseBinary(binData);
    }
  }
  
  ensureBinary(data) {
    if (typeof data === 'string') {
      const array_buffer = new Uint8Array(data.length);
      for (let i = 0; i < data.length; i++) {
        array_buffer[i] = data.charCodeAt(i) & 0xff;
      }
      return array_buffer.buffer || array_buffer;
    }
    return data;
  }
  
  parseASCII(data) {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const normals = [];
    
    const patternSolid = /solid([\s\S]*?)endsolid/g;
    const patternFace = /facet([\s\S]*?)endfacet/g;
    
    let result;
    while ((result = patternSolid.exec(data)) !== null) {
      const solid = result[0];
      
      while ((result = patternFace.exec(solid)) !== null) {
        const facet = result[1];
        const patternNormal = /normal[\s]+([-+]?[0-9]+\.?[0-9]*([eE][-+]?[0-9]+)?)+[\s]+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)+[\s]+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)+/g;
        
        const patternVertex = /vertex[\s]+([-+]?[0-9]+\.?[0-9]*([eE][-+]?[0-9]+)?)+[\s]+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)+[\s]+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)+/g;
        
        while ((result = patternNormal.exec(facet)) !== null) {
          const nx = parseFloat(result[1]);
          const ny = parseFloat(result[3]);
          const nz = parseFloat(result[5]);
          
          // Each face has 3 vertices
          normals.push(nx, ny, nz);
          normals.push(nx, ny, nz);
          normals.push(nx, ny, nz);
        }
        
        while ((result = patternVertex.exec(facet)) !== null) {
          vertices.push(parseFloat(result[1]), parseFloat(result[3]), parseFloat(result[5]));
        }
      }
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    
    return geometry;
  }
  
  parseBinary(data) {
    const geometry = new THREE.BufferGeometry();
    const dataView = new DataView(data);
    
    // Skip 80-byte header
    let offset = 80;
    const faces = dataView.getUint32(offset, true);
    offset += 4;
    
    const vertices = [];
    const normals = [];
    
    for (let i = 0; i < faces; i++) {
      const start = offset;
      
      // Get normal
      const nx = dataView.getFloat32(start, true);
      const ny = dataView.getFloat32(start + 4, true);
      const nz = dataView.getFloat32(start + 8, true);
      
      // Per face, not per vertex
      for (let j = 0; j < 3; j++) {
        normals.push(nx, ny, nz);
      }
      
      // Get vertices
      for (let j = 0; j < 3; j++) {
        const vertexStart = start + 12 + (j * 12);
        
        vertices.push(
          dataView.getFloat32(vertexStart, true),
          dataView.getFloat32(vertexStart + 4, true),
          dataView.getFloat32(vertexStart + 8, true)
        );
      }
      
      // Skip the attribute byte count (2 bytes)
      offset += 50;
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    
    return geometry;
  }
}

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
    
    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    
    // Handle context loss
    const canvas = renderer.domElement;
    canvas.addEventListener('webglcontextlost', function(event) {
      event.preventDefault();
      console.log('WebGL context lost, attempting to restore');
      
      // Stop animation loop
      if (rendererRef.current) {
        rendererRef.current.setAnimationLoop(null);
      }
    });
    
    canvas.addEventListener('webglcontextrestored', function() {
      console.log('WebGL context restored');
      
      // Restart animation loop
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        const animate = () => {
          if (controlsRef.current) controlsRef.current.update();
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        };
        rendererRef.current.setAnimationLoop(animate);
      }
    });
    
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
            scene.add(mesh);
            modelRef.current = mesh;
            
            setLoading(false);
          } catch (error) {
            console.error('Error parsing STL:', error);
          }
        }
      })
      .catch(error => {
        console.error('Error loading STL:', error);
      });
    
    // Animation loop
    const animate = () => {
      if (controlsRef.current) controlsRef.current.update();
      renderer.render(scene, camera);
    };
    renderer.setAnimationLoop(animate);
    
    // Cleanup
    return () => {
      renderer.setAnimationLoop(null);
      
      if (containerRef.current && containerRef.current.contains(canvas)) {
        containerRef.current.removeChild(canvas);
      }
      
      if (modelRef.current) {
        scene.remove(modelRef.current);
        modelRef.current.geometry.dispose();
        modelRef.current.material.dispose();
      }
      
      renderer.dispose();
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
