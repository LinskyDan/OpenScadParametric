import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { Download, Ruler } from "lucide-react";
import { type MortiseTemplate } from "@shared/schema";
import { formSchema } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useState } from "react";
import { StlViewer } from "react-stl-viewer";

const defaultValues: MortiseTemplate = {
  unit_system: "imperial",
  bushing_OD_in: 0.3125,
  bit_diameter_in: 0.25,
  mortise_length_in: 1.75,
  mortise_width_in: 0.375,
  edge_distance_in: 0.25,
  edge_position: "right",
  extension_length_in: 3.0,
  extension_width_in: 3.0,
  template_thickness_in: 0.25, // Default template thickness (1/4 inch)
};

const mmToInch = (mm: number) => mm / 25.4;
const inchToMm = (inch: number) => inch * 25.4;

export function MortiseForm() {
  const { toast } = useToast();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const form = useForm<MortiseTemplate>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const unitSystem = form.watch("unit_system");

  const getStepSize = () => unitSystem === "imperial" ? 0.0625 : 0.1;
  const formatValue = (value: number) => unitSystem === "imperial" ? value : inchToMm(value);
  const parseValue = (value: string) => {
    const num = parseFloat(value);
    return unitSystem === "imperial" ? num : mmToInch(num);
  };

  const getUnitLabel = () => unitSystem === "imperial" ? "inches" : "mm";

  const mutation = useMutation({
    mutationFn: async (data: MortiseTemplate) => {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to generate STL file");
      }

      // Get the file name from Content-Disposition header
      const contentDisposition = response.headers.get("content-disposition");
      const fileName = contentDisposition
        ? contentDisposition.split("filename=")[1].replace(/"/g, "")
        : "mortise_template.stl";

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      return { url, fileName };
    },
    onSuccess: (data) => {
      setPreviewUrl(data.url);
      setShowPreview(true);
      toast({
        title: "Success",
        description: "STL file generated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: MortiseTemplate) => {
    mutation.mutate(data);
  };

  const handleDownload = () => {
    if (!previewUrl) return;

    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = "mortise_template.stl";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="unit_system"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Unit System</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit system" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="imperial">Imperial (inches)</SelectItem>
                  <SelectItem value="metric">Metric (mm)</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>Choose your preferred unit system</FormDescription>
            </FormItem>
          )}
        />

        {/* Category 1: Define Your Mortise Size */}
        <div className="space-y-4 border rounded-lg p-4">
          <h3 className="text-lg font-semibold">1. Define Your Mortise Size</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="mortise_length_in"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mortise Length</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step={getStepSize()}
                      {...field}
                      value={formatValue(field.value)}
                      onChange={e => field.onChange(parseValue(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>Desired mortise length ({getUnitLabel()})</FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="mortise_width_in"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mortise Width</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step={getStepSize()}
                      {...field}
                      value={formatValue(field.value)}
                      onChange={e => field.onChange(parseValue(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>Desired mortise width ({getUnitLabel()})</FormDescription>
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Category 2: Set Your Bit and Bushing Diameter */}
        <div className="space-y-4 border rounded-lg p-4">
          <h3 className="text-lg font-semibold">2. Set Your Bit and Bushing Diameter</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="bit_diameter_in"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Router Bit Diameter</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step={getStepSize()}
                      {...field}
                      value={formatValue(field.value)}
                      onChange={e => field.onChange(parseValue(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>Outside diameter of router bit ({getUnitLabel()})</FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bushing_OD_in"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Guide Bushing Diameter</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step={getStepSize()}
                      {...field}
                      value={formatValue(field.value)}
                      onChange={e => field.onChange(parseValue(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>Outside diameter of guide bushing ({getUnitLabel()})</FormDescription>
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Category 3: Customize Your Template */}
        <div className="space-y-4 border rounded-lg p-4">
          <h3 className="text-lg font-semibold">3. Customize Your Template</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="edge_position"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Edge Position</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select edge position" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>The edge the template will be aligned to</FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="edge_distance_in"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Edge Distance</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step={getStepSize()}
                      {...field}
                      value={formatValue(field.value)}
                      onChange={e => field.onChange(parseValue(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>Distance from edge to mortise ({getUnitLabel()})</FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="extension_length_in"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template Length</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step={getStepSize()}
                      {...field}
                      value={formatValue(field.value)}
                      onChange={e => field.onChange(parseValue(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>Total template length ({getUnitLabel()})</FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="extension_width_in"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template Width</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step={getStepSize()}
                      {...field}
                      value={formatValue(field.value)}
                      onChange={e => field.onChange(parseValue(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>Total template width ({getUnitLabel()})</FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="template_thickness_in"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template Thickness</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step={getStepSize()}
                      {...field}
                      value={formatValue(field.value)}
                      onChange={e => field.onChange(parseValue(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>Thickness of template ({getUnitLabel()})</FormDescription>
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
          <Button type="submit" className="flex-1" disabled={mutation.isPending}>
            {mutation.isPending ? "Generating..." : "Generate Template"}
          </Button>
          {previewUrl && (
            <Button type="button" onClick={handleDownload} variant="outline" className="flex-1">
              <Download className="mr-2 h-4 w-4" />
              Download STL
            </Button>
          )}
        </div>

        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>3D Preview</DialogTitle>
              <DialogDescription>
                Preview your mortise template. Click and drag to rotate.
              </DialogDescription>
            </DialogHeader>
            {previewUrl && (
              <div className="h-[400px] w-full">
                <StlViewer
                  url={previewUrl}
                  modelColor="#3b82f6"
                  backgroundColor="#f8fafc"
                  rotate={true}
                  orbitControls={true}
                  shadows={true}
                  style={{ width: "100%", height: "100%" }}
                />
              </div>
            )}
            <Button type="button" onClick={handleDownload} className="mt-4">
              <Download className="mr-2 h-4 w-4" />
              Download STL
            </Button>
          </DialogContent>
        </Dialog>
      </form>
    </Form>
  );
}