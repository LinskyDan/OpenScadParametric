
// Basic dimensions
total_length = 198.43749999999997;
total_width = 96.83749999999999;
thickness = 6.35;
edge_height = 12.7;
edge_thickness = 9.525;
cutout_length = 46.037499999999994;
cutout_width = 11.112499999999999;
cutout_x = 76.19999999999999;
cutout_y = 16.66875;
corner_radius = 3.96875;
text_depth = 0.8;

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

// Text module
module template_text() {
    text_size = 3;
    line_spacing = 4;
    text_x = cutout_x;
    text_y = cutout_y + cutout_width + 5;

    translate([text_x, text_y, thickness - text_depth]) {
        linear_extrude(height = text_depth + 0.1) {
            text("Bushing OD: 5/16"", size = text_size);
            translate([0, -line_spacing * 1, 0])
                text("Bit Dia: 1/4"", size = text_size);
            translate([0, -line_spacing * 2, 0])
                text("Length: 1-3/4"", size = text_size);
            translate([0, -line_spacing * 3, 0])
                text("Width: 3/8"", size = text_size);
            translate([0, -line_spacing * 4, 0])
                text("Edge Dist: 1/4"", size = text_size);
            translate([0, -line_spacing * 5, 0])
                text("Offset: 1/16"", size = text_size);
        }
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
}

// Add text
template_text();
