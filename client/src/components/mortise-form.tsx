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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { StlViewer } from "react-stl-viewer";

const defaultValues: MortiseTemplate = {
  bushing_OD_in: 0.3125,
  bit_diameter_in: 0.25,
  mortise_length_in: 1.75,
  mortise_width_in: 0.375,
  edge_distance_in: 0.25,
  edge_position: "right",
  extension_length_in: 3.0,
  extension_width_in: 3.0,
};

export function MortiseForm() {
  const { toast } = useToast();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const form = useForm<MortiseTemplate>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

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
              name="bushing_OD_in"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bushing Outside Diameter</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.0625" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                  </FormControl>
                  <FormDescription>Outside diameter of the guide bushing (inches)</FormDescription>
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
                    <Input type="number" step="0.0625" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                  </FormControl>
                  <FormDescription>Outside diameter of the router bit (inches)</FormDescription>
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
                    <Input type="number" step="0.125" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                  </FormControl>
                  <FormDescription>Desired mortise length (inches)</FormDescription>
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
                    <Input type="number" step="0.125" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                  </FormControl>
                  <FormDescription>Desired mortise width (inches)</FormDescription>
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
                    <Input type="number" step="0.125" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                  </FormControl>
                  <FormDescription>Distance from the edge (inches)</FormDescription>
                </FormItem>
              )}
            />

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
                  <FormDescription>Position of the edge fence</FormDescription>
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
                    <Input type="number" step="0.125" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                  </FormControl>
                  <FormDescription>Extra length beyond the cutout (inches)</FormDescription>
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
                    <Input type="number" step="0.125" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                  </FormControl>
                  <FormDescription>Extra width beyond the cutout (inches)</FormDescription>
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
          </DialogHeader>
          {previewUrl && (
            <div className="aspect-square w-full bg-black/5 rounded-lg overflow-hidden">
              <StlViewer
                url={previewUrl}
                style={{ width: '100%', height: '100%' }}
                orbitControls
                shadows
                modelColor="#4A5568"
              />
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