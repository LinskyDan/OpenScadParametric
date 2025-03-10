
// Set render quality
$fn = 100;

// Main dimensions
total_length = 196.84999999999997;
total_width = 95.24999999999999;
thickness = 6.35;
edge_height = 12.7;
edge_thickness = 9.525;

// Mortise dimensions
mortise_length = 44.449999999999996;
mortise_width = 9.524999999999999;
offset = 0.79375;

// Cutout dimensions
cutout_x = 76.19999999999999;
cutout_y = 15.875;
cutout_length = 46.037499999999994;
cutout_width = 11.112499999999999;

// Rounded rectangle module
module rounded_rect(length, width, height, radius) {
    hull() {
        translate([radius, radius, 0])
            cylinder(h=height, r=radius);
        translate([length - radius, radius, 0])
            cylinder(h=height, r=radius);
        translate([radius, width - radius, 0])
            cylinder(h=height, r=radius);
        translate([length - radius, width - radius, 0])
            cylinder(h=height, r=radius);
    }
}

// Guide hole module
module guide_hole(x, y) {
    translate([x, y, -0.1])
        cylinder(h=thickness + 0.2, r=3.96875);
}

// Main template module
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

    // Text engravings
    translate([cutout_x + mortise_length + 10, edge_thickness + 5, thickness - 0.5]) {
        linear_extrude(height = 1.0) {
            text(str("Mortise Template"), size = 4, halign = "left");
            translate([0, -7, 0])
                text(str("Length: ", "1.75""), size = 3, halign = "left");
            translate([0, -12, 0])
                text(str("Width: ", "0.375""), size = 3, halign = "left");
            translate([0, -17, 0])
                text(str("Edge Dist: ", "0.25""), size = 3, halign = "left");
            translate([0, -22, 0])
                text(str("Bit: ", "0.25""), size = 3, halign = "left");
            translate([0, -27, 0])
                text(str("Bushing: ", "0.3125""), size = 3, halign = "left");
        }
    }
}
