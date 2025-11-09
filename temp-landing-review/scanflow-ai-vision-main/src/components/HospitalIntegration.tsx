import { Activity, Radio, Wifi } from "lucide-react";
import medicalEquipment from "@/assets/medical-equipment.png";

const HospitalIntegration = () => {
  const devices = [
    { name: "MRI Scanner", status: "Connected", delay: "0s" },
    { name: "CT Scanner", status: "Connected", delay: "0.2s" },
    { name: "X-Ray Machine", status: "Connected", delay: "0.4s" },
    { name: "Ultrasound", status: "Connected", delay: "0.6s" },
    { name: "Patient Monitor", status: "Connected", delay: "0.8s" },
  ];

  return (
    <section className="py-24 relative overflow-hidden">
      {/* Animated Background Grid */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(to right, hsl(var(--primary) / 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(var(--primary) / 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-4xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <Radio className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Real-Time Integration</span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold">
            Seamless{" "}
            <span className="text-gradient">Hospital Equipment</span>{" "}
            Integration
          </h2>
          <p className="text-xl text-muted-foreground">
            Connect all your medical devices directly to Scan FlowAI Cloud for instant document processing and data synchronization.
          </p>
        </div>

        {/* Main Integration Visual */}
        <div className="max-w-6xl mx-auto">
          {/* Cloud Hub Center */}
          <div className="flex flex-col items-center gap-12">
            {/* Cloud Icon with Animation */}
            <div className="relative">
              <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-2xl animate-float">
                <Activity className="w-16 h-16 text-white" />
              </div>
              {/* Pulse Rings */}
              <div className="absolute inset-0 rounded-2xl border-2 border-primary animate-ping opacity-20" />
              <div className="absolute inset-0 rounded-2xl border-2 border-primary animate-ping opacity-10" style={{ animationDelay: "1s" }} />
              
              <div className="text-center mt-4">
                <div className="text-xl font-bold text-gradient">Scan FlowAI Cloud</div>
                <div className="text-sm text-muted-foreground">Central Processing Hub</div>
              </div>
            </div>

            {/* Medical Equipment Strip */}
            <div className="w-full relative">
              {/* Connection Lines Animation */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-20 bg-gradient-to-b from-primary to-transparent" />
              
              {/* Equipment Image */}
              <div className="relative rounded-2xl overflow-hidden border border-primary/30 shadow-2xl">
                <img
                  src={medicalEquipment}
                  alt="Hospital medical equipment connected to Scan FlowAI Cloud"
                  className="w-full h-auto"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
              </div>

              {/* Device Status Indicators */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-8">
                {devices.map((device, index) => (
                  <div
                    key={index}
                    className="bg-card/50 backdrop-blur-sm border border-primary/20 rounded-xl p-4 text-center animate-slide-in-up"
                    style={{ animationDelay: device.delay }}
                  >
                    <Wifi className="w-6 h-6 text-primary mx-auto mb-2 animate-pulse" />
                    <div className="font-semibold text-sm mb-1">{device.name}</div>
                    <div className="flex items-center justify-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-xs text-muted-foreground">{device.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Data Flow Indicators */}
            <div className="grid md:grid-cols-3 gap-6 w-full max-w-4xl">
              <div className="text-center space-y-2">
                <div className="text-3xl font-bold text-gradient">24/7</div>
                <div className="text-sm text-muted-foreground">Real-Time Monitoring</div>
              </div>
              <div className="text-center space-y-2">
                <div className="text-3xl font-bold text-gradient">100ms</div>
                <div className="text-sm text-muted-foreground">Average Response Time</div>
              </div>
              <div className="text-center space-y-2">
                <div className="text-3xl font-bold text-gradient">100+</div>
                <div className="text-sm text-muted-foreground">Device Types Supported</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HospitalIntegration;
