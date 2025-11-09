import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Users, Target, Award, Lightbulb } from "lucide-react";

const About = () => {
  const values = [
    {
      icon: Target,
      title: "Our Mission",
      description: "To revolutionize healthcare through AI-powered medical imaging solutions that enhance diagnostic accuracy and improve patient outcomes."
    },
    {
      icon: Lightbulb,
      title: "Innovation",
      description: "We continuously push the boundaries of medical imaging technology, integrating cutting-edge AI algorithms with clinical workflows."
    },
    {
      icon: Users,
      title: "Healthcare Focus",
      description: "Our solutions are designed by healthcare professionals for healthcare professionals, ensuring practical and effective implementations."
    },
    {
      icon: Award,
      title: "Excellence",
      description: "We maintain the highest standards of quality, security, and compliance in all our medical imaging solutions."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-900">
      <Navbar />
      
      {/* Hero Section */}
      <div className="pt-32 pb-16 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        </div>
        
        <div className="container mx-auto px-4 lg:px-8 text-center relative z-10">
          <h1 className="text-5xl lg:text-6xl font-bold mb-6 text-white">
            About <span className="text-gradient bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">ScanFlowAI</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
            We're revolutionizing medical imaging with AI-powered technology that transforms how healthcare professionals diagnose, analyze, and manage medical images.
          </p>
        </div>
      </div>

      {/* Values Section */}
      <section className="py-24 bg-slate-800 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-32 left-32 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-32 right-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
              Our <span className="text-gradient bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">Values</span>
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Built on a foundation of innovation, excellence, and dedication to improving healthcare outcomes worldwide.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {values.map((value, index) => (
              <div
                key={index}
                className="group bg-slate-700/30 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-8 hover:bg-slate-700/50 transition-all duration-300 hover:scale-105"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <value.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4 group-hover:text-purple-400 transition-colors">
                  {value.title}
                </h3>
                <p className="text-gray-300 leading-relaxed">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 bg-slate-900">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-12">
            <div className="grid md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-4xl lg:text-5xl font-bold text-gradient bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-2">
                  500+
                </div>
                <div className="text-gray-300 font-medium">Healthcare Facilities</div>
              </div>
              <div>
                <div className="text-4xl lg:text-5xl font-bold text-gradient bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent mb-2">
                  10M+
                </div>
                <div className="text-gray-300 font-medium">Images Processed</div>
              </div>
              <div>
                <div className="text-4xl lg:text-5xl font-bold text-gradient bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent mb-2">
                  99.9%
                </div>
                <div className="text-gray-300 font-medium">Accuracy Rate</div>
              </div>
              <div>
                <div className="text-4xl lg:text-5xl font-bold text-gradient bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent mb-2">
                  24/7
                </div>
                <div className="text-gray-300 font-medium">Support Available</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default About;
