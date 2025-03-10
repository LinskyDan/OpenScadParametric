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
    const little_endian = true;

    try {
      // First check if we have enough data for a basic STL header
      if (buffer.byteLength < 84) {
        throw new Error('STL file is too small to be valid');
      }

      const reader = {
        dv: new DataView(buffer),
        offset: 0,
        getUint32: function() {
          const value = this.dv.getUint32(this.offset, little_endian);
          this.offset += 4;
          return value;
        },
        getFloat32: function() {
          const value = this.dv.getFloat32(this.offset, little_endian);
          this.offset += 4;
          return value;
        },
        skip: function(bytes: number) {
          this.offset += bytes;
        }
      };

      // Skip the header
      reader.skip(80);

      // Read number of triangles
      const triangles = reader.getUint32();
      const expectedSize = 84 + (triangles * 50);

      if (buffer.byteLength < expectedSize) {
        throw new Error('STL file appears to be truncated');
      }

      if (triangles === 0) {
        throw new Error('STL file contains no faces');
      }

      if (triangles > 5000000) {
        throw new Error('STL file contains too many faces');
      }

      const vertices = new Float32Array(triangles * 9);
      const normals = new Float32Array(triangles * 9);
      let vertexIndex = 0;
      let normalIndex = 0;

      try {
        for (let i = 0; i < triangles; i++) {
          // Normal
          const nx = reader.getFloat32();
          const ny = reader.getFloat32();
          const nz = reader.getFloat32();

          // Vertices
          for (let j = 0; j < 3; j++) {
            const x = reader.getFloat32();
            const y = reader.getFloat32();
            const z = reader.getFloat32();

            vertices[vertexIndex++] = x;
            vertices[vertexIndex++] = y;
            vertices[vertexIndex++] = z;

            normals[normalIndex++] = nx;
            normals[normalIndex++] = ny;
            normals[normalIndex++] = nz;
          }

          // Skip attribute byte count
          reader.skip(2);
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));

        // Compute bounding box
        geometry.computeBoundingBox();

        // Validate final geometry
        if (!geometry.attributes.position || geometry.attributes.position.count === 0) {
          throw new Error('Generated geometry has no vertices');
        }

        return geometry;
      } catch (error) {
        if (error instanceof Error && error.message.includes('Offset')) {
          throw new Error('Invalid STL data structure - file may be corrupted');
        }
        throw error;
      }
    } catch (error) {
      console.error('STL parsing error:', error);
      throw new Error(`Failed to parse STL file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export { CustomSTLLoader };