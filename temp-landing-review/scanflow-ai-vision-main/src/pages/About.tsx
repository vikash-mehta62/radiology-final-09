import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Target, Users, Award, TrendingUp } from "lucide-react";

const About = () => {
  const values = [
    {
      icon: Target,
      title: "Our Mission",
      description: "To revolutionize document management through cutting-edge AI technology, making workflows seamless and intelligent.",
    },
    {
      icon: Users,
      title: "Our Team",
      description: "A diverse group of AI researchers, engineers, and industry experts passionate about solving real-world problems.",
    },
    {
      icon: Award,
      title: "Excellence",
      description: "Committed to delivering the highest quality solutions with 99.9% accuracy and industry-leading performance.",
    },
    {
      icon: TrendingUp,
      title: "Innovation",
      description: "Continuously pushing boundaries with advanced machine learning and computer vision technologies.",
    },
  ];

  return (
    <div className="min-h-screen">
      <Navbar />
      
      <main className="pt-32 pb-20">
        <div className="container mx-auto px-4 lg:px-8">
          {/* Hero Section */}
          <div className="text-center max-w-4xl mx-auto mb-20 space-y-6">
            <h1 className="text-5xl lg:text-6xl font-bold">
              About <span className="text-gradient">Scan FlowAI</span>
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed">
              We're on a mission to transform how organizations handle documents, combining artificial intelligence with intuitive design to create powerful workflow automation solutions.
            </p>
          </div>

          {/* Story Section */}
          <div className="max-w-4xl mx-auto mb-20 space-y-6 text-lg text-muted-foreground leading-relaxed">
            <p>
              Founded in 2020, Scan FlowAI emerged from a simple observation: organizations were drowning in documents, spending countless hours on manual data entry and processing. We knew there had to be a better way.
            </p>
            <p>
              Today, we serve over 500 enterprise clients worldwide, processing millions of documents monthly with our advanced AI technology. Our platform has helped organizations save thousands of hours and millions of dollars while improving accuracy and compliance.
            </p>
          </div>

          {/* Values Grid */}
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {values.map((value, index) => (
              <div
                key={index}
                className="bg-card/50 backdrop-blur-sm border border-primary/20 rounded-xl p-8 hover-lift"
              >
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-6">
                  <value.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-3">{value.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default About;
