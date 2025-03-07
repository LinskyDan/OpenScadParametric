// Renderer setup
  const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true
  });
  renderer.setSize(width, height);

  // Handle context loss
  const canvas = renderer.domElement;
  canvas.addEventListener('webglcontextlost', function(event) {
    event.preventDefault();
    console.log('WebGL context lost, attempting to restore');
  });

  canvas.addEventListener('webglcontextrestored', function() {
    console.log('WebGL context restored');
    renderer.setSize(width, height);
    // Re-render the scene
    renderer.render(scene, camera);
  });

  containerRef.current.appendChild(canvas);