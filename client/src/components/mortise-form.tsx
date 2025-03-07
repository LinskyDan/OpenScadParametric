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

      const result = await response.json();
      return result.previewUrl;
    },
    onSuccess: (previewUrl) => {
      setPreviewUrl(previewUrl);
      setShowPreview(true);
      toast({
        title: "Success!",
        description: "STL file has been generated. You can preview it now.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate STL file.",
        variant: "destructive",
      });
    },
  });

  const downloadFile = async () => {
    if (!previewUrl) return;

    const downloadUrl = previewUrl.replace('preview', 'download');
    const response = await fetch(downloadUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mortise_template.stl";
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    setShowPreview(false);
  };

  const onSubmit = (data: MortiseTemplate) => {
    mutation.mutate(data);
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="unit_system"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Measurement System</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select measurement system" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="imperial">Imperial (inches)</SelectItem>
                      <SelectItem value="metric">Metric (mm)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>Choose your preferred measurement system</FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bushing_OD_in"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bushing Outside Diameter</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step={getStepSize()}
                      {...field}
                      value={formatValue(field.value)}
                      onChange={e => field.onChange(parseValue(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>Outside diameter of the guide bushing ({getUnitLabel()})</FormDescription>
                </FormItem>
              )}
            />

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
                  <FormDescription>Outside diameter of the router bit ({getUnitLabel()})</FormDescription>
                </FormItem>
              )}
            />

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
                  <FormDescription>Distance from the edge ({getUnitLabel()})</FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="extension_length_in"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Extension Length</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step={getStepSize()}
                      {...field}
                      value={formatValue(field.value)}
                      onChange={e => field.onChange(parseValue(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>Extra length beyond the cutout ({getUnitLabel()})</FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="extension_width_in"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Extension Width</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step={getStepSize()}
                      {...field}
                      value={formatValue(field.value)}
                      onChange={e => field.onChange(parseValue(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>Extra width beyond the cutout ({getUnitLabel()})</FormDescription>
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
                  <FormDescription>Thickness of the template ({getUnitLabel()})</FormDescription>
                </FormItem>
              )}
            />
          </div>

          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? (
              "Generating..."
            ) : (
              <>
                <Ruler className="mr-2 h-4 w-4" />
                Generate Preview
              </>
            )}
          </Button>
        </form>
      </Form>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Preview Mortise Template</DialogTitle>
                <DialogDescription>
                  View and interact with your generated mortise template. Use mouse to rotate and zoom the 3D model.
                </DialogDescription>
              </DialogHeader>
              {previewUrl ? (
                <div className="aspect-square w-full bg-black/5 rounded-lg overflow-hidden" aria-label="3D preview of mortise template">
                  <StlViewer
                    url={previewUrl}
                    style={{ width: '100%', height: '100%' }}
                    orbitControls
                    shadows
                    modelProps={{
                      scale: 1,
                      rotationX: 0,
                      rotationY: 0,
                      rotationZ: 0
                    }}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center aspect-square w-full bg-black/5 rounded-lg">
                  <p className="text-muted-foreground">Loading preview...</p>
                </div>
              )}
              <Button onClick={downloadFile} className="mt-4">
                <Download className="mr-2 h-4 w-4" />
                Download STL File
              </Button>
            </DialogContent>
          </Dialog>
    </>
  );
}