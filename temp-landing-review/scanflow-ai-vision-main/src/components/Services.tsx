import { Scan, Brain, Workflow, FileCheck, Zap, Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const services = [
  {
    icon: Scan,
    title: "Intelligent Scanning",
    description: "Advanced OCR technology with multi-format support and batch processing capabilities for seamless document digitization.",
  },
  {
    icon: Brain,
    title: "AI Data Extraction",
    description: "Machine learning-powered extraction of structured data from unstructured documents with 99.9% accuracy.",
  },
  {
    icon: Workflow,
    title: "Workflow Automation",
    description: "Streamline your processes with automated routing, approvals, and intelligent document classification.",
  },
  {
    icon: FileCheck,
    title: "Quality Assurance",
    description: "Built-in validation and verification systems ensure data integrity and compliance at every step.",
  },
  {
    icon: Zap,
    title: "Real-time Processing",
    description: "Lightning-fast document processing with instant results and real-time status updates.",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "Bank-level encryption, compliance certifications, and robust access controls protect your sensitive data.",
  },
];

const Services = () => {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <h2 className="text-4xl lg:text-5xl font-bold">
            Our <span className="text-gradient">Services</span>
          </h2>
          <p className="text-xl text-muted-foreground">
            Comprehensive AI solutions for document management and workflow automation
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, index) => (
            <Card
              key={index}
              className="bg-card/50 backdrop-blur-sm border-primary/20 hover-lift card-glow group"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CardHeader>
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <service.icon className="w-7 h-7 text-white" />
                </div>
                <CardTitle className="text-xl">{service.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-muted-foreground leading-relaxed">
                  {service.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;
