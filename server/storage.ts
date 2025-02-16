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
      return `${value.toFixed(1)}mm`;
    }
    return `${this.decimalToFraction(value)}"`;
  }

  private async generateOpenSCADContent(params: MortiseTemplate): Promise<string> {
    const textDepth = 0.75;
    const scale_factor = 25.4;

    const bushing_OD = params.bushing_OD_in * scale_factor;
    const bit_diameter = params.bit_diameter_in * scale_factor;

    const offset_mm = (bushing_OD - bit_diameter) / 2;
    const offset_inches = offset_mm / scale_factor;

    const displayValue = (value: number) => {
      return params.unit_system === "metric" 
        ? (value * scale_factor).toFixed(1)
        : this.decimalToFraction(value);
    };

    const displayOffset = params.unit_system === "metric" 
      ? offset_mm.toFixed(1)
      : this.decimalToFraction(offset_inches);

    const unitSuffix = params.unit_system === "metric" ? "mm" : "\"";

    return `
// User Inputs (In Inches)
bushing_OD_in = ${params.bushing_OD_in};       // Outside diameter of the guide bushing
bit_diameter_in = ${params.bit_diameter_in};       // Outside diameter of the router bit
mortise_length_in = ${params.mortise_length_in};     // Desired mortise length
mortise_width_in = ${params.mortise_width_in};     // Desired mortise width
edge_distance_in = ${params.edge_distance_in};      // Distance from the inside of the raised edge fence
edge_position = "${params.edge_position}";      // Options: "left" or "right"
extension_length_in = ${params.extension_length_in};    // Extra length beyond the cutout (inches)
extension_width_in = ${params.extension_width_in};     // Extra width beyond the cutout, opposite the fence (inches)

// Constants
template_thickness_in = 0.25;   // Thickness of the template (inches)
edge_height_in = 0.5;           // Height of the edge stop (inches)
edge_thickness_in = 0.375;      // Thickness of the edge stop (inches)

// Conversion Factor
scale_factor = 25.4; // 1 inch = 25.4 mm

// Convert to Millimeters
bushing_OD = bushing_OD_in * scale_factor;
bit_diameter = bit_diameter_in * scale_factor;
mortise_length = mortise_length_in * scale_factor;
mortise_width = mortise_width_in * scale_factor;
template_thickness = template_thickness_in * scale_factor;
edge_height = edge_height_in * scale_factor;
edge_thickness = edge_thickness_in * scale_factor;
extension_length = extension_length_in * scale_factor;
extension_width = extension_width_in * scale_factor;
text_depth = ${textDepth};

// Offset Calculation - Moved earlier
offset = (bushing_OD - bit_diameter) / 2;
offset_inches = offset / scale_factor;

// Adjusted edge distance calculation
adjusted_edge_distance = (edge_distance_in + offset_inches) * scale_factor;

// Template Dimensions
cutout_length = mortise_length + (offset * 2);
cutout_width = mortise_width + (offset * 2);
corner_radius = bushing_OD / 2;
template_length = cutout_length + (extension_length * 2);
template_width = cutout_width + (2 * scale_factor) + extension_width;

// Edge and Cutout Positioning - Using adjusted edge distance
cutout_y_position = (edge_position == "left") 
    ? adjusted_edge_distance + edge_thickness
    : template_width - adjusted_edge_distance - cutout_width - edge_thickness;
edge_x_offset = (edge_position == "left") ? 0 : template_width - edge_thickness;
cutout_x_position = (template_length - cutout_length) / 2;

// Text parameters
text_size = 3;
line_spacing = 5;
text_start_x = cutout_x_position;
text_start_y = (edge_position == "left") 
    ? cutout_y_position + cutout_width + 10
    : cutout_y_position - 30; 

// Rounded Rectangle Module
module rounded_rectangle(length, width, radius) {
    hull() {
        translate([radius, radius, 0]) cylinder(h=10, r=radius, $fn=50);
        translate([length - radius, radius, 0]) cylinder(h=10, r=radius, $fn=50);
        translate([radius, width - radius, 0]) cylinder(h=10, r=radius, $fn=50);
        translate([length - radius, width - radius, 0]) cylinder(h=10, r=radius, $fn=50);
    }
}

// Text Module
module template_text() {
    translate([text_start_x, text_start_y, template_thickness - text_depth]) {
        linear_extrude(height = text_depth + 0.1) {
            text(str("Bushing OD: ", "${displayValue(params.bushing_OD_in)}${unitSuffix}"), size = text_size, halign = "left");
            translate([0, -line_spacing, 0])
                text(str("Bit Dia: ", "${displayValue(params.bit_diameter_in)}${unitSuffix}"), size = text_size, halign = "left");
            translate([0, -2*line_spacing, 0])
                text(str("Length: ", "${displayValue(params.mortise_length_in)}${unitSuffix}"), size = text_size, halign = "left");
            translate([0, -3*line_spacing, 0])
                text(str("Width: ", "${displayValue(params.mortise_width_in)}${unitSuffix}"), size = text_size, halign = "left");
            translate([0, -4*line_spacing, 0])
                text(str("Edge Dist: ", "${displayValue(params.edge_distance_in)}${unitSuffix}"), size = text_size, halign = "left");
            translate([0, -5*line_spacing, 0])
                text(str("Offset: ", "${displayOffset}${unitSuffix}"), size = text_size, halign = "left");
        }
    }
}

// Template Base Module
module mortise_template() {
    difference() {
        // Base Template
        cube([template_length, template_width, template_thickness]); 

        // Mortise Cutout
        translate([cutout_x_position, cutout_y_position, 0])
            rounded_rectangle(cutout_length, cutout_width, corner_radius);
    }
}

// Edge Stop Module
module edge_stop() {
    translate([0, edge_x_offset, template_thickness]) 
        cube([template_length, edge_thickness, edge_height]);
}

// Render Everything
difference() {
    union() {
        mortise_template();
        edge_stop();
    }
    template_text();
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
      bushing_OD_in: template.bushing_OD_in,
      bit_diameter_in: template.bit_diameter_in,
      mortise_length_in: template.mortise_length_in,
      mortise_width_in: template.mortise_width_in,
      edge_distance_in: template.edge_distance_in,
      edge_position: template.edge_position,
      extension_length_in: template.extension_length_in,
      extension_width_in: template.extension_width_in,
      unit_system: template.unit_system
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
      unit_system: template.unit_system
    }));
  }
}

export const storage = new DatabaseStorage();