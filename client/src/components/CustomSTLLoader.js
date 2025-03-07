
import * as THREE from 'three';

class CustomSTLLoader extends THREE.Loader {
  constructor(manager) {
    super(manager);
  }

  load(url, onLoad, onProgress, onError) {
    const scope = this;
    const loader = new THREE.FileLoader(this.manager);
    loader.setPath(this.path);
    loader.setResponseType('arraybuffer');
    loader.setRequestHeader(this.requestHeader);
    loader.setWithCredentials(this.withCredentials);
    
    loader.load(url, function(buffer) {
      try {
        onLoad(scope.parse(buffer));
      } catch (e) {
        if (onError) {
          onError(e);
        } else {
          console.error(e);
        }
        scope.manager.itemError(url);
      }
    }, onProgress, onError);
  }

  parse(buffer) {
    const decoder = new TextDecoder();
    
    function isBinary(data) {
      const reader = new DataView(data);
      const faceSize = (32 / 8 * 3) + ((32 / 8 * 3) * 3) + (16 / 8);
      const nFaces = reader.getUint32(80, true);
      const expectSize = 80 + (32 / 8) + (nFaces * faceSize);

      if (expectSize === reader.byteLength) {
        return true;
      }

      // Check if first 5 characters suggest ASCII STL
      const solid = decoder.decode(new Uint8Array(data, 0, 5)).toLowerCase();
      return solid !== 'solid';
    }

    function parseBinary(data) {
      const reader = new DataView(data);
      const faces = reader.getUint32(80, true);

      let r, g, b;
      const defaultR = 0.5;
      const defaultG = 0.5;
      const defaultB = 0.5;

      const geometry = new THREE.BufferGeometry();
      const vertices = [];
      const normals = [];

      for (let face = 0; face < faces; face++) {
        const start = 80 + 4 + (face * 50);
        const normalX = reader.getFloat32(start, true);
        const normalY = reader.getFloat32(start + 4, true);
        const normalZ = reader.getFloat32(start + 8, true);

        for (let i = 1; i <= 3; i++) {
          const vertexStart = start + 12 * i;
          const vertexX = reader.getFloat32(vertexStart, true);
          const vertexY = reader.getFloat32(vertexStart + 4, true);
          const vertexZ = reader.getFloat32(vertexStart + 8, true);

          vertices.push(vertexX, vertexY, vertexZ);
          normals.push(normalX, normalY, normalZ);
        }
      }

      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));

      return geometry;
    }

    function parseASCII(data) {
      const text = decoder.decode(data);
      const geometry = new THREE.BufferGeometry();
      const patternFace = /facet([\s\S]*?)endfacet/g;
      
      let result;
      const vertices = [];
      const normals = [];

      while ((result = patternFace.exec(text)) !== null) {
        const patternNormal = /normal[\s]+([-+]?[0-9]+\.?[0-9]*([eE][-+]?[0-9]+)?)+[\s]+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)+[\s]+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)+/g;
        const patternVertex = /vertex[\s]+([-+]?[0-9]+\.?[0-9]*([eE][-+]?[0-9]+)?)+[\s]+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)+[\s]+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)+/g;
        
        let resultNormal = patternNormal.exec(result[0]);
        while ((resultVertex = patternVertex.exec(result[0])) !== null) {
          vertices.push(parseFloat(resultVertex[1]), parseFloat(resultVertex[3]), parseFloat(resultVertex[5]));
          normals.push(parseFloat(resultNormal[1]), parseFloat(resultNormal[3]), parseFloat(resultNormal[5]));
        }
      }

      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));

      return geometry;
    }

    function ensureString(buffer) {
      return decoder.decode(new Uint8Array(buffer));
    }

    const binary = isBinary(buffer);
    return binary ? parseBinary(buffer) : parseASCII(buffer);
  }
}

export { CustomSTLLoader };
