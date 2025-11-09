import { Activity, Wifi, Monitor, Stethoscope, ArrowRight } from "lucide-react";
import { Button } from "./ui/button";
import medicalEquipment from "../assets/medical-equipment.png";

const HospitalIntegrationSection = () => {
  const integrationFeatures = [
    {
      icon: Activity,
      title: "Real-time Monitoring",
      description: "24/7 system monitoring with instant alerts and automated failover capabilities."
    },
    {
      icon: Wifi,
      title: "Seamless Connectivity",
      description: "Direct integration with existing PACS, RIS, and HIS systems without disruption."
    },
    {
      icon: Monitor,
      title: "Multi-Device Support",
      description: "Compatible with all major medical imaging devices and workstations."
    },
    {
      icon: Stethoscope,
      title: "Clinical Workflow",
      description: "Optimized for clinical workflows with intuitive interfaces and smart automation."
    }
  ];

  const equipmentStats = [
    { value: "24/7", label: "System Uptime" },
    { value: "500ms", label: "Response Time" },
    { value: "100+", label: "Device Types" }
  ];

  return (
    <section className="py-24 bg-slate-900 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 right-20 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
            Seamless{" "}
            <span className="text-gradient bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
              Hospital Equipment
            </span>
            <br />
            Integration
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Connect all your medical imaging equipment with our unified platform. Smart discovery, automated configuration, and real-time synchronization.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 items-center mb-16">
          {/* Left Content */}
          <div className="space-y-8">
            <div className="grid gap-6">
              {integrationFeatures.map((feature, index) => (
                <div
                  key={index}
                  className="group flex items-start gap-4 p-6 bg-slate-800/30 backdrop-blur-sm border border-slate-700/30 rounded-xl hover:bg-slate-800/50 transition-all duration-300"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-gray-300 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Image */}
          <div className="relative">
            <div className="relative rounded-2xl overflow-hidden bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 p-8">
              <img
                src={medicalEquipment}
                alt="Medical Equipment Integration"
                className="w-full h-auto object-contain"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/10 to-indigo-500/10 rounded-2xl" />
            </div>

            {/* Floating Stats */}
            <div className="absolute -bottom-8 -left-8 bg-slate-800/90 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 shadow-2xl">
              <div className="grid grid-cols-3 gap-4 text-center">
                {equipmentStats.map((stat, index) => (
                  <div key={index}>
                    <div className="text-2xl font-bold text-gradient bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
                      {stat.value}
                    </div>
                    <div className="text-xs text-gray-300 font-medium">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Integration Process */}
        <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/30 rounded-2xl p-8 mb-12">
          <h3 className="text-2xl font-bold text-white text-center mb-8">
            Simple Integration Process
          </h3>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: "01", title: "Connect", desc: "Plug in your devices" },
              { step: "02", title: "Discover", desc: "Auto-detect equipment" },
              { step: "03", title: "Configure", desc: "Smart setup wizard" },
              { step: "04", title: "Monitor", desc: "Real-time dashboard" }
            ].map((item, index) => (
              <div key={index} className="text-center group">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <span className="text-white font-bold text-lg">{item.step}</span>
                </div>
                <h4 className="text-lg font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">
                  {item.title}
                </h4>
                <p className="text-gray-300 text-sm">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Button
            size="lg"
            className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-semibold text-lg px-8 py-4 rounded-xl shadow-lg hover:shadow-purple-500/25 transition-all duration-300"
          >
            Schedule Integration Demo
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default HospitalIntegrationSection;