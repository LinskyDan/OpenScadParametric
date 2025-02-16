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
      { denominator: 2, tolerance: 0.0078125 },   // 1/2 (0.5)
      { denominator: 4, tolerance: 0.00390625 },  // 1/4 (0.25)
      { denominator: 8, tolerance: 0.001953125 }, // 1/8 (0.125)
      { denominator: 16, tolerance: 0.0009765625 }// 1/16 (0.0625)
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
      const difference = Math.abs(fractionalPart - nearestNumerator / denominator);

      if (difference < tolerance) {
        // Simplify the fraction if possible
        let num = nearestNumerator;
        let den = denominator;

        // Find the GCD
        const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
        const divisor = gcd(num, den);

        num = num / divisor;
        den = den / divisor;

        if (wholePart === 0) {
          return `${num}/${den}`;
        }
        return `${wholePart}-${num}/${den}`;
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

    // Calculate offset in inches directly
    const offset_in = (params.bushing_OD_in - params.bit_diameter_in) / 2;
    const offset = offset_in * scale; // Convert to mm for OpenSCAD
    const cutout_length = mortise_length + (offset * 2);
    const cutout_width = mortise_width + (offset * 2);

    // Base template dimensions
    const total_length = cutout_length + (extension_length * 2);
    const total_width = cutout_width + edge_thickness + extension_width;

    // Position calculations
    const cutout_x = (total_length - cutout_length) / 2;
    const cutout_y = edge_thickness + edge_distance + offset;

    // Pre-format all measurements for text
    const formatted = {
      bushing_OD: this.formatMeasurement(params.bushing_OD_in, params.unit_system),
      bit_diameter: this.formatMeasurement(params.bit_diameter_in, params.unit_system),
      mortise_length: this.formatMeasurement(params.mortise_length_in, params.unit_system),
      mortise_width: this.formatMeasurement(params.mortise_width_in, params.unit_system),
      edge_distance: this.formatMeasurement(params.edge_distance_in, params.unit_system),
      offset: params.unit_system === "imperial" ? this.decimalToFraction(offset_in) : offset_in.toFixed(2)
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

    // Text engravings - positioned to the right of cutout with more spacing
    translate([cutout_x + cutout_length + 20, total_width/2, thickness - 0.5]) {
        linear_extrude(height = 1.0) {
            // Each text line positioned with proper spacing
            text(str("Bushing OD: ", "${formatted.bushing_OD}"), 
                size = 3, halign = "left");
            translate([0, -5, 0])
                text(str("Bit Dia: ", "${formatted.bit_diameter}"), 
                    size = 3, halign = "left");
            translate([0, -10, 0])
                text(str("Length: ", "${formatted.mortise_length}"), 
                    size = 3, halign = "left");
            translate([0, -15, 0])
                text(str("Width: ", "${formatted.mortise_width}"), 
                    size = 3, halign = "left");
            translate([0, -20, 0])
                text(str("Edge Dist: ", "${formatted.edge_distance}"), 
                    size = 3, halign = "left");
            translate([0, -25, 0])
                text(str("Offset: ", "${formatted.offset}"), 
                    size = 3, halign = "left");
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