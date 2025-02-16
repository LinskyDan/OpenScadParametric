import { z } from "zod";

// Schema for mortise template parameters
export const mortiseTemplateSchema = z.object({
  units: z.enum(["imperial", "metric"]),
  bushing_OD_in: z.number().min(0.1).max(2),
  bit_diameter_in: z.number().min(0.1).max(2),
  mortise_length_in: z.number().min(0.1).max(10),
  mortise_width_in: z.number().min(0.1).max(10),
  edge_distance_in: z.number().min(0.1).max(5),
  edge_position: z.enum(["left", "right"]),
  extension_length_in: z.number().min(0.1).max(10),
  extension_width_in: z.number().min(0.1).max(10),
});

export type MortiseTemplate = z.infer<typeof mortiseTemplateSchema>;
