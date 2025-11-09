import { Shield, DollarSign, Server, Lock, CheckCircle, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const CloudStorage = () => {
  const features = [
    {
      icon: Shield,
      title: "HIPAA Compliant",
      description: "Full compliance with healthcare regulations and data protection standards",
    },
    {
      icon: DollarSign,
      title: "50% Cost Savings",
      description: "Reduce storage costs by up to 50% compared to traditional solutions",
    },
    {
      icon: Server,
      title: "99.99% Uptime",
      description: "Enterprise-grade reliability with redundant infrastructure",
    },
    {
      icon: Lock,
      title: "End-to-End Encryption",
      description: "Military-grade AES-256 encryption for data at rest and in transit",
    },
    {
      icon: CheckCircle,
      title: "Automated Backups",
      description: "Daily automated backups with point-in-time recovery",
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Sub-second access times with global CDN distribution",
    },
  ];

  return (
    <section className="py-24 relative overflow-hidden bg-gradient-to-b from-background to-background/50">
      {/* Background decoration */}
      <div className="absolute top-1/4 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-4xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">HIPAA Compliant Storage</span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold">
            Secure Cloud Storage for{" "}
            <span className="text-gradient">Healthcare</span>
          </h2>
          <p className="text-xl text-muted-foreground">
            Enterprise-grade cloud storage with HIPAA compliance, saving you up to 50% on costs while maintaining the highest security standards.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="bg-card/50 backdrop-blur-sm border-primary/20 hover-lift card-glow"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Cost Savings Highlight */}
        <div className="max-w-4xl mx-auto bg-gradient-to-r from-primary/20 to-accent/20 rounded-2xl p-8 border border-primary/30">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-gradient mb-2">50%</div>
              <div className="text-sm text-muted-foreground">Cost Reduction</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-gradient mb-2">99.99%</div>
              <div className="text-sm text-muted-foreground">Uptime SLA</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-gradient mb-2">100%</div>
              <div className="text-sm text-muted-foreground">HIPAA Compliant</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CloudStorage;
