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
    const tolerance = 1.0E-6;
    let numerator = 1;
    let denominator = 1;
    let bestError = Math.abs(decimal - numerator / denominator);
    let maxDenominator = 16; 

    for (let d = 1; d <= maxDenominator; d++) {
      const n = Math.round(decimal * d);
      const error = Math.abs(decimal - n / d);
      if (error < bestError) {
        bestError = error;
        numerator = n;
        denominator = d;
      }
    }

    if (denominator === 1) {
      return `${numerator}`;
    }

    const wholePart = Math.floor(numerator / denominator);
    const remainingNumerator = numerator % denominator;

    if (wholePart === 0) {
      return `${remainingNumerator}/${denominator}`;
    }

    return `${wholePart}-${remainingNumerator}/${denominator}`;
  }

  private formatMeasurement(value: number, unitSystem: string): string {
    if (unitSystem === "metric") {
      return `${value.toFixed(1)}`;
    }
    return this.decimalToFraction(value);
  }

  private async generateOpenSCADContent(params: MortiseTemplate): Promise<string> {
    const textDepth = 0.75;
    const scale_factor = 25.4;

    const bushing_OD = params.bushing_OD_in * scale_factor;
    const bit_diameter = params.bit_diameter_in * scale_factor;
    const template_thickness = params.template_thickness_in * scale_factor;

    const offset_mm = (bushing_OD - bit_diameter) / 2;
    const offset_inches = offset_mm / scale_factor;

    const formatValue = (value: number) => {
      return params.unit_system === "metric" 
        ? (value * scale_factor).toFixed(1)
        : this.formatMeasurement(value, "imperial");
    };

    const unitSuffix = params.unit_system === "metric" ? "mm" : "\"";

    return `
// Constants and Conversion
scale_factor = 25.4;  // mm per inch
text_depth = 0.75;    // depth of embossed text

// Template Parameters
template_thickness = ${template_thickness};  // converted to mm
bushing_OD = ${bushing_OD};                 // converted to mm
bit_diameter = ${bit_diameter};             // converted to mm

// User Parameters (in mm)
mortise_length = ${params.mortise_length_in} * scale_factor;
mortise_width = ${params.mortise_width_in} * scale_factor;
edge_distance = ${params.edge_distance_in} * scale_factor;
extension_length = ${params.extension_length_in} * scale_factor;
extension_width = ${params.extension_width_in} * scale_factor;

// Edge Stop Parameters
edge_height = 12.7;        // 0.5" in mm
edge_thickness = 9.525;    // 0.375" in mm

// Calculated Parameters
offset = (bushing_OD - bit_diameter) / 2;
cutout_length = mortise_length + (offset * 2);
cutout_width = mortise_width + (offset * 2);
corner_radius = bushing_OD / 2;

// Template Size Calculations
template_length = cutout_length + (extension_length * 2);
template_width = cutout_width + edge_thickness + extension_width;

// Position Calculations
cutout_x = (template_length - cutout_length) / 2;
cutout_y = (edge_thickness + edge_distance + offset);

// Modules
module rounded_rectangle(length, width, radius) {
    hull() {
        for (x = [radius, length - radius]) {
            for (y = [radius, width - radius]) {
                translate([x, y, 0])
                    cylinder(h = template_thickness * 2, r = radius, center = false, $fn = 50);
            }
        }
    }
}

module template_text() {
    text_size = 3;
    line_spacing = 4;
    text_x = cutout_x;
    text_y = cutout_y + cutout_width + 5;

    translate([text_x, text_y, template_thickness - text_depth]) {
        linear_extrude(height = text_depth + 0.1) {
            text(str("Bushing OD: ", "${formatValue(params.bushing_OD_in)}", "${unitSuffix}"), size = text_size);
            translate([0, -line_spacing * 1, 0])
                text(str("Bit Dia: ", "${formatValue(params.bit_diameter_in)}", "${unitSuffix}"), size = text_size);
            translate([0, -line_spacing * 2, 0])
                text(str("Length: ", "${formatValue(params.mortise_length_in)}", "${unitSuffix}"), size = text_size);
            translate([0, -line_spacing * 3, 0])
                text(str("Width: ", "${formatValue(params.mortise_width_in)}", "${unitSuffix}"), size = text_size);
            translate([0, -line_spacing * 4, 0])
                text(str("Edge Dist: ", "${formatValue(params.edge_distance_in)}", "${unitSuffix}"), size = text_size);
            translate([0, -line_spacing * 5, 0])
                text(str("Offset: ", "${this.formatMeasurement(offset_inches, params.unit_system)}", "${unitSuffix}"), size = text_size);
        }
    }
}

// Main Template
difference() {
    union() {
        // Base plate
        cube([template_length, template_width, template_thickness]);

        // Edge stop
        translate([0, 0, template_thickness])
            cube([template_length, edge_thickness, edge_height]);
    }

    // Mortise cutout
    translate([cutout_x, cutout_y, -0.1])
        rounded_rectangle(cutout_length, cutout_width, corner_radius);

    // Add text
    template_text();
}
`;
  }

  async generateSTLFile(params: MortiseTemplate): Promise<{ filePath: string; content: Buffer }> {
    try {
      const tempDir = path.join(process.cwd(), 'temp');
      await fs.mkdir(tempDir, { recursive: true });
      const timestamp = Date.now();
      console.log('Generating SCAD file with params:', JSON.stringify(params, null, 2));
      const scadFile = path.join(tempDir, `mortise_${timestamp}.scad`);
      const stlFile = path.join(tempDir, `mortise_${timestamp}.stl`);
      const scadContent = await this.generateOpenSCADContent(params);
      await fs.writeFile(scadFile, scadContent);
      await execAsync(`openscad -o "${stlFile}" "${scadFile}"`);
      const stlContent = await fs.readFile(stlFile);
      await fs.unlink(scadFile);

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
      bushing_OD_in: Number(template.bushing_OD_in),
      bit_diameter_in: Number(template.bit_diameter_in),
      mortise_length_in: Number(template.mortise_length_in),
      mortise_width_in: Number(template.mortise_width_in),
      edge_distance_in: Number(template.edge_distance_in),
      edge_position: template.edge_position,
      extension_length_in: Number(template.extension_length_in),
      extension_width_in: Number(template.extension_width_in),
      unit_system: template.unit_system,
      template_thickness_in: Number(template.template_thickness_in)
    }));
  }
}

export const storage = new DatabaseStorage();