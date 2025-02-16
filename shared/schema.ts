import { z } from "zod";

// Schema for mortise template parameters
export const mortiseTemplateSchema = z.object({
  units: z.enum(["imperial", "metric"]),
  bushing_OD_in: z.number().min(0.1).max(2),
  bit_diameter_in: z.number().min(0.1).max(2),
  mortise_length_in: z.number().min(0.1).max(5),
  mortise_width_in: z.number().min(0.1).max(5),
  edge_distance_in: z.number().min(0.1).max(2),
  edge_position: z.enum(["left", "right"]),
  extension_length_in: z.number().min(0.1).max(4),
  extension_width_in: z.number().min(0.1).max(4),
}).refine((data) => {
  const scale_factor = 25.4; // Convert inches to mm
  const total_length = (data.mortise_length_in + (2 * data.extension_length_in)) * scale_factor;
  const total_width = (data.mortise_width_in + data.extension_width_in + 2) * scale_factor;
  return total_length <= 256 && total_width <= 256;
}, { message: "Total model dimensions must not exceed 256mm x 256mm" });

export type MortiseTemplate = z.infer<typeof mortiseTemplateSchema>;
