import { mortiseTemplateSchema } from "@shared/schema";
import { z } from "zod";

export const formSchema = mortiseTemplateSchema.extend({
  bushing_OD_in: z.number().min(0.1).max(2).describe("Outside diameter of the guide bushing (inches)"),
  bit_diameter_in: z.number().min(0.1).max(2).describe("Outside diameter of the router bit (inches)"),
  mortise_length_in: z.number().min(0.1).max(10).describe("Desired mortise length (inches)"),
  mortise_width_in: z.number().min(0.1).max(10).describe("Desired mortise width (inches)"),
  edge_distance_in: z.number().min(0.1).max(5).describe("Distance from edge (inches)"),
  edge_position: z.enum(["left", "right"]).describe("Edge fence position"),
  extension_length_in: z.number().min(0.1).max(10).describe("Extra length beyond cutout (inches)"),
  extension_width_in: z.number().min(0.1).max(10).describe("Extra width beyond cutout (inches)")
});
