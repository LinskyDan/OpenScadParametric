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
import { useState, useEffect, useRef } from "react";
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const defaultValues: MortiseTemplate = {
  unit_system: "imperial",
  bushing_OD_in: 0.3125,
  bit_diameter_in: 0.25,
  mortise_length_in: 1.75,
  mortise_width_in: 0.375,
  edge_distance_in: 0.25,
  edge_position: "left",
  extension_length_in: 3.0,
  extension_width_in: 3.0,
  template_thickness_in: 0.25,
};

const mmToInch = (mm: number) => mm / 25.4;
const inchToMm = (inch: number) => inch * 25.4;

export function MortiseForm() {
  const { toast } = useToast();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [stlError, setStlError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const frameRef = useRef<number>(0);

  const cleanup = () => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }
    if (rendererRef.current) {
      rendererRef.current.dispose();
    }
    if (sceneRef.current) {
      sceneRef.current.clear();
    }
    if (controlsRef.current) {
      controlsRef.current.dispose();
    }
    if (containerRef.current && rendererRef.current?.domElement) {
      containerRef.current.removeChild(rendererRef.current.domElement);
    }
  };

  const initScene = () => {
    if (!containerRef.current) return;

    cleanup();

    const width = 600;
    const height = 400;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f8fafc');
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 5;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    rendererRef.current = renderer;
    containerRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
  };

  const loadSTL = async (url: string) => {
    if (!sceneRef.current) return;

    try {
      setStlError(null);
      const loader = new STLLoader();
      const geometry = await loader.loadAsync(url);

      geometry.center();

      const box = new THREE.Box3().setFromObject(new THREE.Mesh(geometry));
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2 / maxDim;
      geometry.scale(scale, scale, scale);

      const material = new THREE.MeshPhongMaterial({
        color: 0x3b82f6,
        shininess: 30,
        specular: 0x111111
      });
      const mesh = new THREE.Mesh(geometry, material);

      sceneRef.current.clear();
      sceneRef.current.add(mesh);

      if (cameraRef.current) {
        cameraRef.current.position.z = 5;
      }

    } catch (err) {
      console.error('Error loading STL:', err);
      setStlError((err as Error).message);
    }
  };

  useEffect(() => {
    if (showPreview && previewUrl) {
      initScene();
      loadSTL(previewUrl);
    }
    return cleanup;
  }, [previewUrl, showPreview]);

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
      try {
        setStlError(null);
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          throw new Error(`Failed to generate STL file: ${response.statusText}`);
        }

        const blob = await response.blob();
        if (blob.size === 0) {
          throw new Error("Generated STL file is empty");
        }

        return URL.createObjectURL(blob);
      } catch (error) {
        setStlError((error as Error).message);
        throw error;
      }
    },
    onSuccess: (url) => {
      setPreviewUrl(url);
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
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
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

        <div className="space-y-4 border rounded-lg p-4">
          <h3 className="text-lg font-semibold">3. Customize Your Template</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

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
            <div className="h-[400px] w-full relative bg-slate-50">
              {mutation.isPending && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
                  <div className="text-center">
                    <Ruler className="h-8 w-8 animate-spin mx-auto mb-2" />
                    <p>Generating template...</p>
                  </div>
                </div>
              )}
              <div ref={containerRef} className="h-full w-full" />
              {stlError && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-red-50 p-4 rounded-md text-red-700">
                    <p className="font-semibold">Error loading model:</p>
                    <p>{stlError}</p>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="mt-2"
                      onClick={() => setStlError(null)}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <Button
              type="button"
              onClick={handleDownload}
              className="mt-4"
              disabled={!previewUrl || mutation.isPending}
            >
              <Download className="mr-2 h-4 w-4" />
              Download STL
            </Button>
          </DialogContent>
        </Dialog>
      </form>
    </Form>
  );
}