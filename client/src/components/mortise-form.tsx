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
  const meshRef = useRef<THREE.Mesh | null>(null);

  // Initialize form first to avoid circular dependency
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

  const cleanup = () => {
    console.log('Cleaning up 3D viewer resources');
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }
    if (meshRef.current) {
      if (meshRef.current.geometry) {
        meshRef.current.geometry.dispose();
      }
      if (meshRef.current.material instanceof THREE.Material) {
        meshRef.current.material.dispose();
      }
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
    if (!containerRef.current) {
      console.error('Container ref is not available');
      return;
    }

    console.log('Initializing 3D scene');
    cleanup();

    try {
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      console.log('Container dimensions:', { width, height });

      // Scene setup
      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#f8fafc');
      sceneRef.current = scene;

      // Camera setup
      const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      camera.position.set(0, 0, 5);
      cameraRef.current = camera;

      // Renderer setup
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(window.devicePixelRatio);
      rendererRef.current = renderer;
      containerRef.current.appendChild(renderer.domElement);

      // Controls setup
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.enableZoom = true;
      controlsRef.current = controls;

      // Lighting setup
      const ambientLight = new THREE.AmbientLight(0x404040, 1);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
      directionalLight.position.set(1, 1, 1);
      scene.add(directionalLight);

      const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
      backLight.position.set(-1, -1, -1);
      scene.add(backLight);

      console.log('Scene initialized successfully');

      // Animation loop
      const animate = () => {
        frameRef.current = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

    } catch (error) {
      console.error('Error initializing Three.js scene:', error);
      setStlError('Failed to initialize 3D viewer');
    }
  };

  const loadSTL = async (url: string) => {
    if (!sceneRef.current || !cameraRef.current) {
      console.error('Scene or camera not initialized');
      return;
    }

    try {
      setStlError(null);
      console.log('Loading STL from URL:', url);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load STL: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      console.log('Received STL buffer size:', buffer.byteLength);

      if (buffer.byteLength === 0) {
        throw new Error('Received empty STL data');
      }

      const loader = new STLLoader();
      const geometry = loader.parse(buffer);

      console.log('STL parsed successfully:', {
        vertices: geometry.attributes.position?.count || 0,
        faces: geometry.attributes.position?.count / 3 || 0
      });

      if (!geometry.attributes.position) {
        throw new Error('Invalid STL: No vertex data found');
      }

      // Center and scale the geometry
      geometry.computeBoundingBox();
      const box = geometry.boundingBox;
      if (!box) {
        throw new Error('Failed to compute model boundaries');
      }

      const center = new THREE.Vector3();
      box.getCenter(center);
      geometry.translate(-center.x, -center.y, -center.z);

      const maxDim = Math.max(
        box.max.x - box.min.x,
        box.max.y - box.min.y,
        box.max.z - box.min.z
      );
      const scale = 3 / maxDim;
      geometry.scale(scale, scale, scale);

      // Create mesh with phong material for better lighting
      const material = new THREE.MeshPhongMaterial({
        color: 0x3b82f6,
        shininess: 30,
        specular: 0x111111,
      });

      // Clean up existing mesh if any
      if (meshRef.current) {
        sceneRef.current.remove(meshRef.current);
        if (meshRef.current.geometry) {
          meshRef.current.geometry.dispose();
        }
        if (meshRef.current.material instanceof THREE.Material) {
          meshRef.current.material.dispose();
        }
      }

      const mesh = new THREE.Mesh(geometry, material);
      meshRef.current = mesh;
      sceneRef.current.add(mesh);

      // Reset camera position
      cameraRef.current.position.set(0, 0, 5);
      if (controlsRef.current) {
        controlsRef.current.reset();
      }

      console.log('STL loaded and mesh added to scene');

    } catch (err) {
      console.error('Error loading STL:', err);
      setStlError((err as Error).message);
    }
  };

  useEffect(() => {
    if (showPreview && previewUrl) {
      console.log('Initializing 3D viewer with URL:', previewUrl);
      initScene();
      loadSTL(previewUrl);
    }
    return cleanup;
  }, [previewUrl, showPreview]);

  const mutation = useMutation({
    mutationFn: async (data: MortiseTemplate) => {
      try {
        setStlError(null);
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Accept": "application/stl" 
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          throw new Error(`Failed to generate STL file: ${response.statusText}`);
        }

        const blob = await response.blob();
        console.log('Response blob size:', blob.size, 'bytes');
        console.log('Response type:', blob.type);

        if (blob.size === 0) {
          throw new Error("Generated STL file is empty");
        }

        return URL.createObjectURL(blob);
      } catch (error) {
        console.error('STL generation error:', error);
        setStlError((error as Error).message);
        throw error;
      }
    },
    onSuccess: (url) => {
      console.log('STL generated successfully, preview URL:', url);
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
                Preview your mortise template. Click and drag to rotate, scroll to zoom.
              </DialogDescription>
            </DialogHeader>
            <div className="h-[400px] w-full relative bg-slate-50 rounded-lg overflow-hidden">
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