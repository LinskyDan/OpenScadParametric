import { mortiseTemplateSchema } from "@shared/schema";
import { z } from "zod";

export const formSchema = mortiseTemplateSchema.extend({
  bushing_OD_in: z.number()
    .min(0.1, "Must be at least 0.1mm in metric or 0.004\" in imperial")
    .max(50, "Must be less than 50mm in metric or 2\" in imperial")
    .describe("Outside diameter of the guide bushing"),
  bit_diameter_in: z.number()
    .min(0.1, "Must be at least 0.1mm in metric or 0.004\" in imperial")
    .max(50, "Must be less than 50mm in metric or 2\" in imperial")
    .describe("Outside diameter of the router bit"),
  mortise_length_in: z.number()
    .min(0.1, "Must be at least 0.1mm in metric or 0.004\" in imperial")
    .max(250, "Must be less than 250mm in metric or 10\" in imperial")
    .describe("Desired mortise length"),
  mortise_width_in: z.number()
    .min(0.1, "Must be at least 0.1mm in metric or 0.004\" in imperial")
    .max(250, "Must be less than 250mm in metric or 10\" in imperial")
    .describe("Desired mortise width"),
  edge_distance_in: z.number()
    .min(0.1, "Must be at least 0.1mm in metric or 0.004\" in imperial")
    .max(125, "Must be less than 125mm in metric or 5\" in imperial")
    .describe("Distance from edge"),
  edge_position: z.enum(["left", "right"]).describe("Edge fence position"),
  extension_length_in: z.number()
    .min(0.1, "Must be at least 0.1mm in metric or 0.004\" in imperial")
    .max(250, "Must be less than 250mm in metric or 10\" in imperial")
    .describe("Extra length beyond cutout"),
  extension_width_in: z.number()
    .min(0.1, "Must be at least 0.1mm in metric or 0.004\" in imperial")
    .max(250, "Must be less than 250mm in metric or 10\" in imperial")
    .describe("Extra width beyond cutout"),
  template_thickness_in: z.number()
    .min(0.1, "Must be at least 0.1mm in metric or 0.004\" in imperial")
    .max(2, "Must be less than 50mm in metric or 2\" in imperial")
    .describe("Thickness of the template"),
  unit_system: z.enum(["imperial", "metric"]).describe("Measurement system")
});