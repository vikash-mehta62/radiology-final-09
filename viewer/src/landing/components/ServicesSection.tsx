import { Brain, FileText, Shield, Zap, Database, Stethoscope } from "lucide-react";

const ServicesSection = () => {
  const services = [
    {
      icon: Brain,
      title: "AI Scanning",
      description: "Advanced AI algorithms for automated medical image analysis and pattern recognition with 99.9% accuracy."
    },
    {
      icon: FileText,
      title: "AI Text Checker",
      description: "Intelligent text analysis and validation for medical reports, ensuring accuracy and compliance standards."
    },
    {
      icon: Shield,
      title: "Secure Automation",
      description: "HIPAA-compliant automated workflows with enterprise-grade security and data protection protocols."
    },
    {
      icon: Zap,
      title: "Quality Assurance",
      description: "Real-time quality control and validation systems to ensure the highest standards of medical imaging."
    },
    {
      icon: Database,
      title: "Data Processing",
      description: "High-performance data processing and storage solutions optimized for medical imaging workflows."
    },
    {
      icon: Stethoscope,
      title: "Complete Workflow",
      description: "End-to-end medical imaging workflow management from acquisition to diagnosis and reporting."
    }
  ];

  return (
    <section className="py-24 bg-slate-900 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
            Our <span className="text-gradient bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Services</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Comprehensive AI-powered solutions designed to transform medical imaging workflows and enhance diagnostic accuracy.
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service, index) => (
            <div
              key={index}
              className="group relative bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 hover:bg-slate-800/70 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-cyan-500/20"
            >
              {/* Icon */}
              <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <service.icon className="w-8 h-8 text-white" />
              </div>

              {/* Content */}
              <h3 className="text-2xl font-bold text-white mb-4 group-hover:text-cyan-400 transition-colors">
                {service.title}
              </h3>
              <p className="text-gray-300 leading-relaxed">
                {service.description}
              </p>

              {/* Hover Effect Border */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;