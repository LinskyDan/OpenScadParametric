
// Set render quality
$fn = 100;

// Base dimensions in mm
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

// Rounded rectangle module with high resolution
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

// Main template
union() {
    difference() {
        union() {
            // Base plate
            cube([total_length, total_width, thickness]);
            // Edge stop
            cube([total_length, edge_thickness, thickness + edge_height]);
        }

        // Mortise cutout with rounded corners
        translate([cutout_x, cutout_y, -0.1])
            rounded_rect(cutout_length, cutout_width, thickness + 0.2, corner_radius);

        // Engraved text (measurements)
        translate([cutout_x + cutout_length + 10, edge_thickness + 5, thickness - 0.5]) {
            linear_extrude(height = 1.0) {
                text(str("Mortise Template"), size = 4, halign = "left");
                translate([0, -7, 0])
                    text(str("Length: 1.75\""), size = 3, halign = "left");
                translate([0, -12, 0])
                    text(str("Width: 0.375\""), size = 3, halign = "left");
                translate([0, -17, 0])
                    text(str("Edge Dist: 0.25\""), size = 3, halign = "left");
                translate([0, -22, 0])
                    text(str("Bit: 0.25\""), size = 3, halign = "left");
                translate([0, -27, 0])
                    text(str("Bushing: 0.3125\""), size = 3, halign = "left");
            }
        }
    }
    
// Test cube
translate([-20, -20, 0])
  cube([10, 10, 10]);

}
