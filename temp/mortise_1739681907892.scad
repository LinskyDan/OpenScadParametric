
// Constants and Conversion
scale_factor = 25.4;  // mm per inch
text_depth = 0.75;    // depth of embossed text

// Template Parameters
template_thickness = 6.35;  // converted to mm
bushing_OD = 7.9375;                 // converted to mm
bit_diameter = 6.35;             // converted to mm

// User Parameters (in mm)
mortise_length = 1.75 * scale_factor;
mortise_width = 0.375 * scale_factor;
edge_distance = 0.25 * scale_factor;
extension_length = 3 * scale_factor;
extension_width = 3 * scale_factor;

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
            text(str("Bushing OD: ", "5/16", """), size = text_size);
            translate([0, -line_spacing * 1, 0])
                text(str("Bit Dia: ", "1/4", """), size = text_size);
            translate([0, -line_spacing * 2, 0])
                text(str("Length: ", "1-3/4", """), size = text_size);
            translate([0, -line_spacing * 3, 0])
                text(str("Width: ", "3/8", """), size = text_size);
            translate([0, -line_spacing * 4, 0])
                text(str("Edge Dist: ", "1/4", """), size = text_size);
            translate([0, -line_spacing * 5, 0])
                text(str("Offset: ", "1/16", """), size = text_size);
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
