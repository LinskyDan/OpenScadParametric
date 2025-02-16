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
  private decimalToFraction(decimal: number): string {
    // Handle common fractions for woodworking (1/2, 1/4, 1/8, 1/16)
    const commonFractions = [
      { denominator: 2, tolerance: 0.0625 },
      { denominator: 4, tolerance: 0.03125 },
      { denominator: 8, tolerance: 0.015625 },
      { denominator: 16, tolerance: 0.0078125 }
    ];

    const wholePart = Math.floor(decimal);
    const fractionalPart = decimal - wholePart;

    // Check for zero fractional part
    if (Math.abs(fractionalPart) < 0.001) {
      return wholePart.toString();
    }

    // Try to match with common fractions
    for (const { denominator, tolerance } of commonFractions) {
      const nearestNumerator = Math.round(fractionalPart * denominator);
      if (Math.abs(fractionalPart - nearestNumerator / denominator) < tolerance) {
        if (wholePart === 0) {
          return `${nearestNumerator}/${denominator}`;
        }
        return `${wholePart}-${nearestNumerator}/${denominator}`;
      }
    }

    // If no match found, return decimal format
    return decimal.toFixed(3);
  }

  private formatMeasurement(value: number, unitSystem: string): string {
    if (unitSystem === "metric") {
      return value.toFixed(1);
    }
    return this.decimalToFraction(value);
  }

  private async generateOpenSCADContent(params: MortiseTemplate): Promise<string> {
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
    const edge_height = 12.7; // 0.5 inches in mm
    const edge_thickness = 9.525; // 0.375 inches in mm

    // Calculate offset
    const offset = (bushing_OD - bit_diameter) / 2;
    const cutout_length = mortise_length + (offset * 2);
    const cutout_width = mortise_width + (offset * 2);

    // Base template dimensions
    const total_length = cutout_length + (extension_length * 2);
    const total_width = cutout_width + edge_thickness + extension_width;

    // Position calculations
    const cutout_x = (total_length - cutout_length) / 2;
    const cutout_y = edge_thickness + edge_distance + offset;

    // Format measurements for display
    const formatValue = (value: number) => {
      const measurement = this.formatMeasurement(value, params.unit_system);
      const unit = params.unit_system === "metric" ? "mm" : "\\\"";
      return `${measurement}${unit}`;
    };

    return `
// Dimensions in mm
total_length = ${total_length};
total_width = ${total_width};
thickness = ${template_thickness};
edge_height = ${edge_height};
edge_thickness = ${edge_thickness};
cutout_length = ${cutout_length};
cutout_width = ${cutout_width};
cutout_x = ${cutout_x};
cutout_y = ${cutout_y};
corner_radius = ${bushing_OD / 2};

// Rounded rectangle module
module rounded_rect(length, width, height, radius) {
    hull() {
        translate([radius, radius, 0])
            cylinder(h=height, r=radius, $fn=50);
        translate([length - radius, radius, 0])
            cylinder(h=height, r=radius, $fn=50);
        translate([radius, width - radius, 0])
            cylinder(h=height, r=radius, $fn=50);
        translate([length - radius, width - radius, 0])
            cylinder(h=height, r=radius, $fn=50);
    }
}

// Main template
union() {
    // Base template with cutout
    difference() {
        union() {
            // Base plate
            cube([total_length, total_width, thickness]);
            // Edge stop
            cube([total_length, edge_thickness, thickness + edge_height]);
        }

        // Mortise cutout
        translate([cutout_x, cutout_y, -0.1])
            rounded_rect(cutout_length, cutout_width, thickness + 0.2, corner_radius);
    }

    // Add measurements text
    translate([cutout_x, cutout_y + cutout_width + 8, thickness - 0.5]) {
        mirror([1, 0, 0]) // Mirror horizontally to correct backwards text
        rotate([0, 0, 180]) // Rotate to make text right-side up
        translate([-cutout_length, 0, 0]) { // Adjust position after rotation
            linear_extrude(height = 0.6) {
                text(text="Bushing OD: ${formatValue(params.bushing_OD_in)}", 
                    size = 3, halign = "left", spacing = 1.1);
                translate([0, -4, 0])
                    text(text="Bit Dia: ${formatValue(params.bit_diameter_in)}", 
                        size = 3, halign = "left", spacing = 1.1);
                translate([0, -8, 0])
                    text(text="Length: ${formatValue(params.mortise_length_in)}", 
                        size = 3, halign = "left", spacing = 1.1);
                translate([0, -12, 0])
                    text(text="Width: ${formatValue(params.mortise_width_in)}", 
                        size = 3, halign = "left", spacing = 1.1);
                translate([0, -16, 0])
                    text(text="Edge Dist: ${formatValue(params.edge_distance_in)}", 
                        size = 3, halign = "left", spacing = 1.1);
                translate([0, -20, 0])
                    text(text="Offset: ${formatValue(offset/scale)}", 
                        size = 3, halign = "left", spacing = 1.1);
            }
        }
    }
}
`;
  }

  async generateSTLFile(params: MortiseTemplate): Promise<{ filePath: string; content: Buffer }> {
    try {
      const tempDir = path.join(process.cwd(), 'temp');
      await fs.mkdir(tempDir, { recursive: true });

      const timestamp = Date.now();
      const scadFile = path.join(tempDir, `mortise_${timestamp}.scad`);
      const stlFile = path.join(tempDir, `mortise_${timestamp}.stl`);

      console.log('Generating SCAD file with params:', JSON.stringify(params, null, 2));
      const scadContent = await this.generateOpenSCADContent(params);

      // Log the generated OpenSCAD content for debugging
      console.log('Generated OpenSCAD content:', scadContent);

      await fs.writeFile(scadFile, scadContent);

      const { stdout, stderr } = await execAsync(`openscad -o "${stlFile}" "${scadFile}"`);
      console.log('OpenSCAD output:', stdout);
      if (stderr) console.error('OpenSCAD stderr:', stderr);

      const stlContent = await fs.readFile(stlFile);
      await fs.unlink(scadFile); // Clean up SCAD file

      return {
        filePath: stlFile,
        content: stlContent
      };
    } catch (error) {
      console.error('Error generating STL:', error);
      throw new Error('Failed to generate STL file');
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