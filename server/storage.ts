import { type MortiseTemplate } from "@shared/schema";
import fs from "fs/promises";
import path from "path";

export interface IStorage {
  generateOpenSCADFile(params: MortiseTemplate): Promise<string>;
}

export class MemStorage implements IStorage {
  async generateOpenSCADFile(params: MortiseTemplate): Promise<string> {
    const scadContent = `
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

// Corrected Offset Calculation
offset = (bushing_OD - bit_diameter) / 2;

// Corrected Cutout Dimensions
cutout_length = mortise_length + (offset * 2);
cutout_width = mortise_width + (offset * 2);
corner_radius = bushing_OD / 2;

// Template Dimensions Adjusted for Extension Length & Width
template_length = cutout_length + (extension_length * 2);
template_width = cutout_width + (2 * scale_factor) + extension_width;

// Correct Edge Distance Calculation from Inside Face of Edge
cutout_y_position = (edge_position == "left") 
    ? edge_distance_in * scale_factor + edge_thickness
    : template_width - edge_distance_in * scale_factor - cutout_width - edge_thickness;

// Ensure Edge Stop Position is Always Defined
edge_x_offset = (edge_position == "left") ? 0 : template_width - edge_thickness;

// Ensure cutout_x_position is Always Defined
cutout_x_position = (template_length - cutout_length) / 2;

// Proper Rounded Rectangle for Mortise
module rounded_rectangle(length, width, radius) {
    hull() {
        translate([radius, radius, 0]) cylinder(h=10, r=radius, $fn=50);
        translate([length - radius, radius, 0]) cylinder(h=10, r=radius, $fn=50);
        translate([radius, width - radius, 0]) cylinder(h=10, r=radius, $fn=50);
        translate([length - radius, width - radius, 0]) cylinder(h=10, r=radius, $fn=50);
    }
}

// Generate the Mortise Template
module mortise_template() {
    difference() {
        // Base Template
        cube([template_length, template_width, template_thickness]); 
        
        // Mortise Cutout with Properly Rounded Corners
        translate([cutout_x_position, cutout_y_position, 0])
            rounded_rectangle(cutout_length, cutout_width, corner_radius);
    }
}

// Edge Stop Module (Moves Left or Right)
module edge_stop() {
    translate([0, edge_x_offset, template_thickness]) 
        cube([template_length, edge_thickness, edge_height]);
}

// Render the Template and Edge Stop
mortise_template();
edge_stop();`;

    return scadContent;
  }
}

export const storage = new MemStorage();
