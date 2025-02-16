import { type MortiseTemplate } from "@shared/schema";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface IStorage {
  generateSTLFile(params: MortiseTemplate): Promise<{
    filePath: string;
    content: Buffer;
  }>;
}

export class MemStorage implements IStorage {
  private decimalToFraction(decimal: number): string {
    const tolerance = 1.0E-6;
    let numerator = 1;
    let denominator = 1;
    let bestError = Math.abs(decimal - numerator / denominator);
    let maxDenominator = 16; // Limit to 16ths for practical woodworking

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

  private async generateOpenSCADContent(params: MortiseTemplate): Promise<string> {
    const textDepth = 0.75; // 3 layers at 0.25mm layer height
    const scale_factor = 25.4; // 1 inch = 25.4 mm

    // Convert inputs to millimeters first
    const bushing_OD = params.bushing_OD_in * scale_factor;
    const bit_diameter = params.bit_diameter_in * scale_factor;

    // Calculate offset in millimeters then convert to inches
    const offset_mm = (bushing_OD - bit_diameter) / 2;
    const offset_inches = offset_mm / scale_factor;

    // Convert measurements to fractions
    const bushingOD = this.decimalToFraction(params.bushing_OD_in);
    const bitDiameter = this.decimalToFraction(params.bit_diameter_in);
    const mortiseLength = this.decimalToFraction(params.mortise_length_in);
    const mortiseWidth = this.decimalToFraction(params.mortise_width_in);
    const edgeDistance = this.decimalToFraction(params.edge_distance_in);
    const offsetFraction = this.decimalToFraction(offset_inches);

    // Calculate actual edge distance after offset
    const actual_edge_distance = params.edge_distance_in - offset_inches;
    console.log(`Edge Distance Calculations:
      User specified edge distance: ${params.edge_distance_in} inches
      Offset: ${offset_inches} inches
      Actual distance from edge to cutout: ${actual_edge_distance} inches`);

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

// Offset Calculation
offset = (bushing_OD - bit_diameter) / 2;

// Template Dimensions
cutout_length = mortise_length + (offset * 2);
cutout_width = mortise_width + (offset * 2);
corner_radius = bushing_OD / 2;
template_length = cutout_length + (extension_length * 2);
template_width = cutout_width + (2 * scale_factor) + extension_width;

// Edge and Cutout Positioning - Adjusted for offset
cutout_y_position = (edge_position == "left") 
    ? (edge_distance_in * scale_factor + edge_thickness) - offset  // Subtract offset for left edge
    : template_width - (edge_distance_in * scale_factor + edge_thickness + mortise_width); // Adjusted for right edge

edge_x_offset = (edge_position == "left") ? 0 : template_width - edge_thickness;
cutout_x_position = (template_length - cutout_length) / 2;

// Text parameters
text_size = 3;
line_spacing = 5;
text_start_x = cutout_x_position;
text_start_y = (edge_position == "left") 
    ? cutout_y_position + cutout_width + 10
    : cutout_y_position - 30; // Adjusted to accommodate extra line

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
            text(str("Bushing OD: ", "${bushingOD}", "\\""), size = text_size, halign = "left");
            translate([0, -line_spacing, 0])
                text(str("Bit Dia: ", "${bitDiameter}", "\\""), size = text_size, halign = "left");
            translate([0, -2*line_spacing, 0])
                text(str("Length: ", "${mortiseLength}", "\\""), size = text_size, halign = "left");
            translate([0, -3*line_spacing, 0])
                text(str("Width: ", "${mortiseWidth}", "\\""), size = text_size, halign = "left");
            translate([0, -4*line_spacing, 0])
                text(str("Edge Dist: ", "${edgeDistance}", "\\""), size = text_size, halign = "left");
            translate([0, -5*line_spacing, 0])
                text(str("Offset: ", "${offsetFraction}", "\\""), size = text_size, halign = "left");
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
}`;
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

      // Keep the STL file for preview
      return {
        filePath: stlFile,
        content: stlContent
      };
    } catch (error) {
      console.error('Error generating STL:', error);
      throw new Error('Failed to generate STL file');
    }
  }
}

export const storage = new MemStorage();