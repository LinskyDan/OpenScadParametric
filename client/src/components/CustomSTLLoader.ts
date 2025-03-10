import * as THREE from 'three';

class CustomSTLLoader extends THREE.Loader {
  load(url: string, onLoad: (geometry: THREE.BufferGeometry) => void, onProgress?: (event: ProgressEvent) => void, onError?: (event: ErrorEvent) => void) {
    const loader = new THREE.FileLoader(this.manager);
    loader.setResponseType('arraybuffer');
    loader.load(url, 
      (buffer) => {
        try {
          onLoad(this.parse(buffer as ArrayBuffer));
        } catch (e) {
          if (onError) {
            onError(e as ErrorEvent);
          }
        }
      },
      onProgress,
      onError as ((err: unknown) => void) | undefined
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
    const decoder = new TextDecoder();
    return this.parseASCII(decoder.decode(buffer));
  }

  private isBinary(buffer: ArrayBuffer): boolean {
    const HEADER_SIZE = 84;
    if (buffer.byteLength < HEADER_SIZE) {
      throw new Error('STL file too small to be valid');
    }

    const dataView = new DataView(buffer);
    const nFaces = dataView.getUint32(80, true);
    const expectedSize = HEADER_SIZE + (50 * nFaces); // 50 = 4*12 + 2 (normal, vertices, attribute)

    if (buffer.byteLength < expectedSize) {
      throw new Error('STL file is truncated');
    }

    return true; // Assume binary if size matches
  }

  private parseBinary(dataView: DataView): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const normals: number[] = [];

    try {
      // Skip header
      const headerOffset = 80;
      const nFaces = dataView.getUint32(headerOffset, true);
      let offset = headerOffset + 4;

      // Validate total size
      const expectedSize = offset + (nFaces * 50);
      if (dataView.byteLength < expectedSize) {
        throw new Error('Invalid STL: File size does not match number of faces');
      }

      // Read each face
      for (let face = 0; face < nFaces; face++) {
        // Normal
        const nx = dataView.getFloat32(offset, true);
        const ny = dataView.getFloat32(offset + 4, true);
        const nz = dataView.getFloat32(offset + 8, true);
        offset += 12;

        // Three vertices per face
        for (let i = 0; i < 3; i++) {
          vertices.push(
            dataView.getFloat32(offset, true),
            dataView.getFloat32(offset + 4, true),
            dataView.getFloat32(offset + 8, true)
          );
          normals.push(nx, ny, nz);
          offset += 12;
        }

        // Skip attribute byte count
        offset += 2;
      }

      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));

      return geometry;
    } catch (error) {
      throw new Error(`Failed to parse binary STL: ${error}`);
    }
  }

  private parseASCII(data: string): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const normals: number[] = [];

    const patternNormal = /normal[\s]+([-+]?[0-9]+\.?[0-9]*([eE][-+]?[0-9]+)?)+[\s]+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)+[\s]+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)+/g;
    const patternVertex = /vertex[\s]+([-+]?[0-9]+\.?[0-9]*([eE][-+]?[0-9]+)?)+[\s]+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)+[\s]+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)+/g;

    try {
      let normal: RegExpExecArray | null;
      while ((normal = patternNormal.exec(data)) !== null) {
        normals.push(
          parseFloat(normal[1]),
          parseFloat(normal[3]),
          parseFloat(normal[5])
        );
      }

      let vertex: RegExpExecArray | null;
      while ((vertex = patternVertex.exec(data)) !== null) {
        vertices.push(
          parseFloat(vertex[1]),
          parseFloat(vertex[3]),
          parseFloat(vertex[5])
        );
      }

      if (vertices.length === 0) {
        throw new Error('No vertices found in STL file');
      }

      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));

      return geometry;
    } catch (error) {
      throw new Error(`Failed to parse ASCII STL: ${error}`);
    }
  }
}

export { CustomSTLLoader };