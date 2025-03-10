import { type MortiseTemplate, type InsertMortiseTemplate, mortiseTemplates } from "@shared/schema";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { db } from "./db";
import { eq } from "drizzle-orm";

const execAsync = promisify(exec);

export interface IStorage {
  generateSTLFile(params: MortiseTemplate): Promise<{
    filePath: string;
    content: Buffer;
  }>;
  saveTemplate(template: MortiseTemplate): Promise<void>;
  getTemplates(): Promise<MortiseTemplate[]>;
}

export class DatabaseStorage implements IStorage {
  private async ensureTempDir() {
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(tempDir, { recursive: true, mode: 0o755 });
    return tempDir;
  }

  private async generateOpenSCADContent(params: MortiseTemplate): Promise<string> {
    console.log('Generating SCAD file with params:', params);

    // Convert all measurements to millimeters for OpenSCAD
    const scale = 25.4; // inches to mm

    const bushing_OD = params.bushing_OD_in * scale;
    const bit_diameter = params.bit_diameter_in * scale;
    const mortise_length = params.mortise_length_in * scale;
    const mortise_width = params.mortise_width_in * scale;
    const edge_distance = params.edge_distance_in * scale;
    const extension_length = params.extension_length_in * scale;
    const extension_width = params.extension_width_in * scale;
    const template_thickness = params.template_thickness_in * scale;

    // Fixed dimensions
    const edge_height = 12.7; // 0.5 inches in mm
    const edge_thickness = 9.525; // 0.375 inches in mm

    // Calculate offset and dimensions
    const offset_in = (params.bushing_OD_in - params.bit_diameter_in) / 2;
    const offset = offset_in * scale;
    const cutout_length = mortise_length + (offset * 2);
    const cutout_width = mortise_width + (offset * 2);

    // Base template dimensions
    const total_length = mortise_length + (extension_length * 2);
    const total_width = mortise_width + edge_thickness + extension_width;

    // Position calculations
    const cutout_x = (total_length - mortise_length) / 2;
    const cutout_y = edge_thickness + edge_distance;

    const scadContent = `
// Set render quality
$fn = 100;

// Main dimensions
total_length = ${total_length};
total_width = ${total_width};
thickness = ${template_thickness};
edge_height = ${edge_height};
edge_thickness = ${edge_thickness};

// Mortise dimensions
mortise_length = ${mortise_length};
mortise_width = ${mortise_width};
offset = ${offset};

// Guide hole module
module guide_hole(x, y) {
    translate([x, y, -0.1])
        cylinder(h=thickness + 0.2, r=${bushing_OD/2});
}

// Main template
difference() {
    union() {
        // Base plate
        cube([total_length, total_width, thickness]);
        // Edge stop
        cube([total_length, edge_thickness, thickness + edge_height]);
    }

    // Guide holes for mortise corners
    guide_hole(cutout_x, cutout_y);
    guide_hole(cutout_x + mortise_length, cutout_y);
    guide_hole(cutout_x, cutout_y + mortise_width);
    guide_hole(cutout_x + mortise_length, cutout_y + mortise_width);

    // Text engravings - simplified for debugging
    translate([cutout_x + mortise_length + 5, edge_thickness + 5, thickness - 0.5]) {
        linear_extrude(height = 1.0) {
            text("Mortise Template", size = 4, halign = "left");
        }
    }
}
`;

    console.log('Generated OpenSCAD content:', scadContent);
    return scadContent;
  }

  async generateSTLFile(params: MortiseTemplate): Promise<{ filePath: string; content: Buffer }> {
    try {
      // Ensure temp directory exists with proper permissions
      const tempDir = await this.ensureTempDir();
      console.log('Using temp directory:', tempDir);

      const timestamp = Date.now();
      const scadFile = path.join(tempDir, `mortise_${timestamp}.scad`);
      const stlFile = path.join(tempDir, `mortise_${timestamp}.stl`);

      // Write SCAD file
      console.log('Writing OpenSCAD file:', scadFile);
      const scadContent = await this.generateOpenSCADContent(params);
      await fs.writeFile(scadFile, scadContent, { mode: 0o644 });

      try {
        // Run OpenSCAD with detailed output
        const cmd = `openscad -o "${stlFile}" "${scadFile}" --debug all`;
        console.log('Executing OpenSCAD command:', cmd);

        const { stdout, stderr } = await execAsync(cmd, { maxBuffer: 1024 * 1024 });
        console.log('OpenSCAD stdout:', stdout);
        if (stderr) console.error('OpenSCAD stderr:', stderr);

        // Check if STL file exists
        const exists = await fs.access(stlFile).then(() => true).catch(() => false);
        if (!exists) {
          throw new Error('OpenSCAD failed to create STL file');
        }

        // Read STL file
        const stlContent = await fs.readFile(stlFile);
        console.log('STL file details:', {
          path: stlFile,
          size: stlContent.length,
          exists
        });

        if (stlContent.length === 0) {
          throw new Error('Generated STL file is empty');
        }

        // Clean up temporary files
        await fs.unlink(scadFile).catch(console.error);

        return {
          filePath: stlFile,
          content: stlContent
        };
      } catch (error) {
        console.error('Error during STL generation:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in generateSTLFile:', error);
      throw new Error(`Failed to generate STL file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async saveTemplate(template: MortiseTemplate): Promise<void> {
    await db.insert(mortiseTemplates).values({
      unit_system: template.unit_system,
      bushing_OD_in: template.bushing_OD_in.toString(),
      bit_diameter_in: template.bit_diameter_in.toString(),
      mortise_length_in: template.mortise_length_in.toString(),
      mortise_width_in: template.mortise_width_in.toString(),
      edge_distance_in: template.edge_distance_in.toString(),
      edge_position: template.edge_position,
      extension_length_in: template.extension_length_in.toString(),
      extension_width_in: template.extension_width_in.toString(),
      template_thickness_in: template.template_thickness_in.toString()
    });
  }

  async getTemplates(): Promise<MortiseTemplate[]> {
    const templates = await db.select().from(mortiseTemplates).orderBy(mortiseTemplates.created_at);
    return templates.map(template => ({
      unit_system: template.unit_system,
      bushing_OD_in: Number(template.bushing_OD_in),
      bit_diameter_in: Number(template.bit_diameter_in),
      mortise_length_in: Number(template.mortise_length_in),
      mortise_width_in: Number(template.mortise_width_in),
      edge_distance_in: Number(template.edge_distance_in),
      edge_position: template.edge_position,
      extension_length_in: Number(template.extension_length_in),
      extension_width_in: Number(template.extension_width_in),
      template_thickness_in: Number(template.template_thickness_in)
    }));
  }
}

export const storage = new DatabaseStorage();