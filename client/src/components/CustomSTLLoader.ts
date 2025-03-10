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
    if (buffer.byteLength < HEADER_SIZE) return false;

    const dataView = new DataView(buffer);
    const faceSize = (32 / 8 * 3) + ((32 / 8 * 3) * 3) + (16 / 8);
    const nFaces = dataView.getUint32(80, true);
    const expectedSize = HEADER_SIZE + (faceSize * nFaces);

    if (buffer.byteLength !== expectedSize) return false;

    // Verify that the size is reasonable
    return nFaces > 0 && nFaces < 50000000;
  }

  private parseBinary(dataView: DataView): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const normals: number[] = [];

    const nFaces = dataView.getUint32(80, true);
    const dataOffset = 84;
    const faceLength = 12 * 4 + 2;

    try {
      for (let face = 0; face < nFaces; face++) {
        const start = dataOffset + face * faceLength;

        // Ensure we have enough data for this face
        if (start + faceLength > dataView.byteLength) {
          throw new Error('STL file is truncated or corrupt');
        }

        // Normal
        const nx = dataView.getFloat32(start, true);
        const ny = dataView.getFloat32(start + 4, true);
        const nz = dataView.getFloat32(start + 8, true);

        // Vertices
        for (let i = 0; i < 3; i++) {
          const vertexStart = start + 12 + (i * 12);

          vertices.push(
            dataView.getFloat32(vertexStart, true),
            dataView.getFloat32(vertexStart + 4, true),
            dataView.getFloat32(vertexStart + 8, true)
          );

          normals.push(nx, ny, nz);
        }
      }

      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));

      return geometry;
    } catch (error) {
      throw new Error(`Error parsing binary STL: ${error}`);
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
      throw new Error(`Error parsing ASCII STL: ${error}`);
    }
  }
}

export { CustomSTLLoader };