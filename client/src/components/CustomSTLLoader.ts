import * as THREE from 'three';

class CustomSTLLoader extends THREE.Loader {
  load(url: string, onLoad: (geometry: THREE.BufferGeometry) => void, onProgress?: (event: ProgressEvent) => void, onError?: (event: ErrorEvent) => void) {
    const loader = new THREE.FileLoader(this.manager);
    loader.setResponseType('arraybuffer');
    loader.load(url, 
      (buffer) => {
        try {
          onLoad(this.parse(buffer));
        } catch (e) {
          if (onError) {
            onError(e as ErrorEvent);
          }
        }
      },
      onProgress,
      onError
    );
  }

  parse(buffer: ArrayBuffer): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const dataView = new DataView(buffer);

    // Check if binary STL
    const isBinary = this.isBinary(buffer);

    if (isBinary) {
      return this.parseBinary(dataView);
    }

    // ASCII STL
    return this.parseASCII(new TextDecoder().decode(buffer));
  }

  private isBinary(buffer: ArrayBuffer): boolean {
    const HEADER_SIZE = 84;
    if (buffer.byteLength < HEADER_SIZE) return false;

    const dataView = new DataView(buffer);
    const faceSize = (32 / 8 * 3) + ((32 / 8 * 3) * 3) + (16 / 8);
    const nFaces = dataView.getUint32(80, true);
    const expectedSize = HEADER_SIZE + (faceSize * nFaces);

    return buffer.byteLength === expectedSize;
  }

  private parseBinary(dataView: DataView): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const normals: number[] = [];

    const nFaces = dataView.getUint32(80, true);
    let offset = 84;

    for (let face = 0; face < nFaces; face++) {
      // Normal
      const nx = dataView.getFloat32(offset, true);
      const ny = dataView.getFloat32(offset + 4, true);
      const nz = dataView.getFloat32(offset + 8, true);
      offset += 12;

      // Vertices
      for (let i = 0; i < 3; i++) {
        const x = dataView.getFloat32(offset, true);
        const y = dataView.getFloat32(offset + 4, true);
        const z = dataView.getFloat32(offset + 8, true);
        offset += 12;

        vertices.push(x, y, z);
        normals.push(nx, ny, nz);
      }

      offset += 2; // Skip attribute byte count
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));

    return geometry;
  }

  private parseASCII(data: string): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const normals: number[] = [];

    const patternNormal = /normal[\s]+([-+]?[0-9]+\.?[0-9]*([eE][-+]?[0-9]+)?)+[\s]+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)+[\s]+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)+/g;
    const patternVertex = /vertex[\s]+([-+]?[0-9]+\.?[0-9]*([eE][-+]?[0-9]+)?)+[\s]+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)+[\s]+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)+/g;

    let normal: RegExpExecArray | null;
    while ((normal = patternNormal.exec(data)) !== null) {
      normals.push(parseFloat(normal[1]), parseFloat(normal[3]), parseFloat(normal[5]));
    }

    let vertex: RegExpExecArray | null;
    while ((vertex = patternVertex.exec(data)) !== null) {
      vertices.push(parseFloat(vertex[1]), parseFloat(vertex[3]), parseFloat(vertex[5]));
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));

    return geometry;
  }
}

export { CustomSTLLoader };