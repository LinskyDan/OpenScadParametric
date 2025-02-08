
// User Inputs (In Inches)
bushing_OD_in = 0.3125;       // Outside diameter of the guide bushing
bit_diameter_in = 0.25;       // Outside diameter of the router bit
mortise_length_in = 1.75;     // Desired mortise length
mortise_width_in = 0.375;     // Desired mortise width
edge_distance_in = 0.25;      // Distance from the inside of the raised edge fence
edge_position = "right";      // Options: "left" or "right"
extension_length_in = 3;    // Extra length beyond the cutout (inches)
extension_width_in = 3;     // Extra width beyond the cutout, opposite the fence (inches)

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
text_depth = 0.75;

// Offset Calculation
offset = (bushing_OD - bit_diameter) / 2;

// Template Dimensions
cutout_length = mortise_length + (offset * 2);
cutout_width = mortise_width + (offset * 2);
corner_radius = bushing_OD / 2;
template_length = cutout_length + (extension_length * 2);
template_width = cutout_width + (2 * scale_factor) + extension_width;

// Edge and Cutout Positioning
cutout_y_position = (edge_position == "left") 
    ? edge_distance_in * scale_factor + edge_thickness
    : template_width - edge_distance_in * scale_factor - cutout_width - edge_thickness;
edge_x_offset = (edge_position == "left") ? 0 : template_width - edge_thickness;
cutout_x_position = (template_length - cutout_length) / 2;

// Text content
text_size = 3;
line_spacing = 5;
text_start_x = cutout_x_position;
text_start_y = (edge_position == "left") 
    ? cutout_y_position + cutout_width + 10
    : cutout_y_position - 25;

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
            text(str("Bushing OD: 5/16""), size = text_size, halign = "left");
            translate([0, -line_spacing, 0])
                text(str("Bit Dia: 1/4""), size = text_size, halign = "left");
            translate([0, -2*line_spacing, 0])
                text(str("Length: 1-3/4""), size = text_size, halign = "left");
            translate([0, -3*line_spacing, 0])
                text(str("Width: 3/8""), size = text_size, halign = "left");
            translate([0, -4*line_spacing, 0])
                text(str("Edge Dist: 1/4""), size = text_size, halign = "left");
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