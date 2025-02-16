import { z } from "zod";
import { pgTable, serial, decimal, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// Schema for mortise template parameters
export const mortiseTemplateSchema = z.object({
  unit_system: z.enum(["imperial", "metric"]),
  bushing_OD_in: z.number().min(0.1).max(50),
  bit_diameter_in: z.number().min(0.1).max(50),
  mortise_length_in: z.number().min(0.1).max(250),
  mortise_width_in: z.number().min(0.1).max(250),
  edge_distance_in: z.number().min(0.1).max(125),
  edge_position: z.enum(["left", "right"]),
  extension_length_in: z.number().min(0.1).max(250),
  extension_width_in: z.number().min(0.1).max(250),
});

// Database table definition
export const mortiseTemplates = pgTable('mortise_templates', {
  id: serial('id').primaryKey(),
  unit_system: text('unit_system', { enum: ['imperial', 'metric'] }).notNull(),
  bushing_OD_in: decimal('bushing_od_in', { precision: 10, scale: 4 }).notNull(),
  bit_diameter_in: decimal('bit_diameter_in', { precision: 10, scale: 4 }).notNull(),
  mortise_length_in: decimal('mortise_length_in', { precision: 10, scale: 4 }).notNull(),
  mortise_width_in: decimal('mortise_width_in', { precision: 10, scale: 4 }).notNull(),
  edge_distance_in: decimal('edge_distance_in', { precision: 10, scale: 4 }).notNull(),
  edge_position: text('edge_position', { enum: ['left', 'right'] }).notNull(),
  extension_length_in: decimal('extension_length_in', { precision: 10, scale: 4 }).notNull(),
  extension_width_in: decimal('extension_width_in', { precision: 10, scale: 4 }).notNull(),
  created_at: timestamp('created_at').defaultNow(),
});

// Types for database operations
export type MortiseTemplate = z.infer<typeof mortiseTemplateSchema>;
export type InsertMortiseTemplate = z.infer<typeof insertMortiseTemplateSchema>;
export type DBMortiseTemplate = typeof mortiseTemplates.$inferSelect;

// Schema for inserting new templates
export const insertMortiseTemplateSchema = createInsertSchema(mortiseTemplates)
  .extend(mortiseTemplateSchema.shape)
  .omit({ 
    id: true, 
    created_at: true 
  });