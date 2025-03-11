
// Dimensions in mm
total_length = 198.43749999999997;
total_width = 96.83749999999999;
thickness = 6.35;
edge_height = 12.7;
edge_thickness = 9.525;
cutout_length = 46.037499999999994;
cutout_width = 11.112499999999999;
cutout_x = 76.19999999999999;
cutout_y = 15.08125;
corner_radius = 3.96875;

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
            text(str("Bushing OD: ", "5/16\""), 
                size = 3, halign = "left");
            translate([0, -5, 0])
                text(str("Bit Dia: ", "1/4\""), 
                    size = 3, halign = "left");
            translate([0, -10, 0])
                text(str("Length: ", "1-3/4\""), 
                    size = 3, halign = "left");
            translate([0, -15, 0])
                text(str("Width: ", "3/8\""), 
                    size = 3, halign = "left");
            translate([0, -20, 0])
                text(str("Edge Dist: ", "1/4\""), 
                    size = 3, halign = "left");
            translate([0, -25, 0])
                text(str("Offset: ", "1/16\""), 
                    size = 3, halign = "left");
        }
    }
}
