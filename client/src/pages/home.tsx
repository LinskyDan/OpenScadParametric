import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MortiseForm } from "@/components/mortise-form";
import { Ruler } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="container mx-auto max-w-3xl">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Ruler className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">3D Mortise Template Generator</CardTitle>
            <CardDescription className="mt-4 text-center max-w-2xl mx-auto">
              Welcome to the 3D Mortise Template Generator! This tool helps woodworkers create precise templates for mortise and tenon joinery. Simply enter your measurements below, and we'll generate a custom 3D template that you can download and print for your woodworking projects.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 p-4 bg-muted rounded-md">
              <h3 className="font-medium mb-2">How It Works:</h3>
              <ol className="list-decimal pl-5 space-y-2 text-sm">
                <li>Enter the dimensions for your mortise template</li>
                <li>Click "Generate Template" to create your custom 3D model</li>
                <li>Download the STL file</li>
                <li>Print the template and use it in your workshop</li>
              </ol>
            </div>
            <MortiseForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
