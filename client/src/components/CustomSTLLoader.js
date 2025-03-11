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
      const text = decoder.decode(new Uint8Array(data, 0, 5)).toLowerCase();
      return text !== 'solid';
    }

    function parseBinary(data) {
      const reader = new DataView(data);
      const faces = reader.getUint32(80, true);

      let r, g, b;
      const defaultR = 0.5;
      const defaultG = 0.5;
      const defaultB = 0.5;

      const geometry = new THREE.BufferGeometry();
      const positions = [];
      const normals = [];
      const colors = [];

      const dataOffset = 84;
      const faceLength = 12 * 4 + 2;

      for (let face = 0; face < faces; face++) {
        const start = dataOffset + face * faceLength;
        const normalX = reader.getFloat32(start, true);
        const normalY = reader.getFloat32(start + 4, true);
        const normalZ = reader.getFloat32(start + 8, true);

        // Flat face normals
        for (let i = 1; i <= 3; i++) {
          normals.push(normalX, normalY, normalZ);
        }

        // Face colors (if any)
        const packedColor = reader.getUint16(start + 48, true);
        if ((packedColor & 0x8000) === 0) {
          // Use colors from STL if available
          r = (packedColor & 0x1F) / 31;
          g = ((packedColor >> 5) & 0x1F) / 31;
          b = ((packedColor >> 10) & 0x1F) / 31;
        } else {
          // Use default colors
          r = defaultR;
          g = defaultG;
          b = defaultB;
        }

        // Vertices
        for (let i = 0; i < 3; i++) {
          const vertexStart = start + 12 + (i * 12);
          const x = reader.getFloat32(vertexStart, true);
          const y = reader.getFloat32(vertexStart + 4, true);
          const z = reader.getFloat32(vertexStart + 8, true);
          positions.push(x, y, z);
          colors.push(r, g, b);
        }
      }

      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));

      if (colors.length > 0) {
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      }

      return geometry;
    }

    function parseASCII(data) {
      const text = decoder.decode(data);
      const geometry = new THREE.BufferGeometry();
      const positions = [];
      const normals = [];

      const patternFace = /facet([\s\S]*?)endfacet/g;
      let result;

      while ((result = patternFace.exec(text)) !== null) {
        const patternNormal = /normal[\s]+([-+]?[0-9]+\.?[0-9]*([eE][-+]?[0-9]+)?)+[\s]+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)+[\s]+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)+/g;
        const patternVertex = /vertex[\s]+([-+]?[0-9]+\.?[0-9]*([eE][-+]?[0-9]+)?)+[\s]+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)+[\s]+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)+/g;

        const normalResult = patternNormal.exec(result[0]);
        if (normalResult) {
          const nx = parseFloat(normalResult[1]);
          const ny = parseFloat(normalResult[3]);
          const nz = parseFloat(normalResult[5]);

          let vertexResult;
          while ((vertexResult = patternVertex.exec(result[0])) !== null) {
            positions.push(
              parseFloat(vertexResult[1]),
              parseFloat(vertexResult[3]),
              parseFloat(vertexResult[5])
            );
            normals.push(nx, ny, nz);
          }
        }
      }

      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));

      return geometry;
    }

    if (isBinary(buffer)) {
      return parseBinary(buffer);
    } else {
      return parseASCII(buffer);
    }
  }
}

export { CustomSTLLoader };