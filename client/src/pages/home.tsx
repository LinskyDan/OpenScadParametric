import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
            <CardTitle className="text-2xl font-bold">OpenSCAD Mortise Template Generator</CardTitle>
          </CardHeader>
          <CardContent>
            <MortiseForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
