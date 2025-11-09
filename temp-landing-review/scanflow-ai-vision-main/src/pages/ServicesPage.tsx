import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Services from "@/components/Services";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const ServicesPage = () => {
  const features = [
    "Multi-format document support (PDF, Images, Scans)",
    "Batch processing capabilities",
    "Real-time data extraction",
    "Custom workflow builders",
    "Advanced analytics and reporting",
    "API integration support",
    "24/7 technical support",
    "Enterprise-grade security",
  ];

  return (
    <div className="min-h-screen">
      <Navbar />
      
      <main className="pt-32 pb-20">
        <div className="container mx-auto px-4 lg:px-8">
          {/* Hero Section */}
          <div className="text-center max-w-4xl mx-auto mb-20 space-y-6">
            <h1 className="text-5xl lg:text-6xl font-bold">
              Our <span className="text-gradient">Services</span>
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Comprehensive AI-powered solutions designed to transform your document workflows and boost productivity.
            </p>
          </div>

          {/* Services Component */}
          <Services />

          {/* Features Section */}
          <div className="mt-20 max-w-5xl mx-auto">
            <div className="bg-card/50 backdrop-blur-sm border border-primary/20 rounded-2xl p-12">
              <h2 className="text-3xl font-bold mb-8 text-center">
                Everything You Need in <span className="text-gradient">One Platform</span>
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-muted-foreground">{feature}</span>
                  </div>
                ))}
              </div>
              <div className="mt-8 text-center">
                <Link to="/contact">
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground font-semibold text-lg px-8 shadow-glow"
                  >
                    Get Started Today
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ServicesPage;
