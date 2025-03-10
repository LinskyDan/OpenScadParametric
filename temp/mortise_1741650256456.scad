
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

// Guide hole module
module guide_hole(x, y) {
    translate([x, y, -0.1])
        cylinder(h=thickness + 0.2, r=3.96875);
}

// Main template
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

    // Text engravings - simplified for debugging
    translate([cutout_x + mortise_length + 5, edge_thickness + 5, thickness - 0.5]) {
        linear_extrude(height = 1.0) {
            text("Mortise Template", size = 4, halign = "left");
        }
    }
}
