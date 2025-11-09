import { Cloud, Shield, Zap, Database, CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "./ui/button";

const CloudStorageSection = () => {
  const features = [
    {
      icon: Shield,
      title: "HIPAA Compliant",
      description: "Enterprise-grade security with end-to-end encryption and compliance monitoring."
    },
    {
      icon: Zap,
      title: "High Performance",
      description: "Lightning-fast data processing with 99.9% uptime and global CDN distribution."
    },
    {
      icon: Database,
      title: "Scalable Storage",
      description: "Unlimited storage capacity that grows with your healthcare organization's needs."
    },
    {
      icon: Cloud,
      title: "Cloud Integration",
      description: "Seamless integration with existing healthcare systems and PACS infrastructure."
    },
    {
      icon: CheckCircle,
      title: "Quality Assurance",
      description: "Automated quality checks and validation for all medical imaging data."
    },
    {
      icon: ArrowRight,
      title: "Workflow Automation",
      description: "Streamlined workflows that reduce manual tasks and improve efficiency."
    }
  ];

  const stats = [
    { value: "50%", label: "Cost Reduction" },
    { value: "99.99%", label: "Uptime Guarantee" },
    { value: "100%", label: "HIPAA Compliant" }
  ];

  return (
    <section className="py-24 bg-slate-800 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-32 left-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-32 right-32 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
            Secure Cloud Storage for{" "}
            <span className="text-gradient bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              Healthcare
            </span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Enterprise-grade cloud infrastructure designed specifically for medical imaging with uncompromising security and performance.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group bg-slate-700/30 backdrop-blur-sm border border-slate-600/30 rounded-xl p-6 hover:bg-slate-700/50 transition-all duration-300 hover:scale-105"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <feature.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3 group-hover:text-emerald-400 transition-colors">
                {feature.title}
              </h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Statistics */}
        <div className="bg-slate-700/20 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-8 mb-12">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            {stats.map((stat, index) => (
              <div key={index} className="group">
                <div className="text-4xl lg:text-5xl font-bold text-gradient bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent mb-2 group-hover:scale-110 transition-transform">
                  {stat.value}
                </div>
                <div className="text-gray-300 font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <Button
            size="lg"
            className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold text-lg px-8 py-4 rounded-xl shadow-lg hover:shadow-emerald-500/25 transition-all duration-300"
          >
            Start Free Trial
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default CloudStorageSection;