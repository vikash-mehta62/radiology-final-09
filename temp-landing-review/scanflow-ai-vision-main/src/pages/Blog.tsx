import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Calendar, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const Blog = () => {
  const blogPosts = [
    {
      title: "The Future of Document Processing with AI",
      excerpt: "Discover how artificial intelligence is revolutionizing the way organizations handle documents and automate workflows.",
      date: "March 15, 2024",
      readTime: "5 min read",
      category: "AI Technology",
    },
    {
      title: "10 Ways to Improve Document Workflow Efficiency",
      excerpt: "Learn practical strategies to streamline your document management processes and boost team productivity.",
      date: "March 10, 2024",
      readTime: "7 min read",
      category: "Best Practices",
    },
    {
      title: "Enterprise Security in Document Management",
      excerpt: "Understanding the critical security features every document management system should have in 2024.",
      date: "March 5, 2024",
      readTime: "6 min read",
      category: "Security",
    },
    {
      title: "OCR Technology: From Basic to Advanced",
      excerpt: "A comprehensive guide to optical character recognition and how modern AI enhances accuracy.",
      date: "February 28, 2024",
      readTime: "8 min read",
      category: "Technology",
    },
    {
      title: "Case Study: Fortune 500 Digital Transformation",
      excerpt: "How we helped a major corporation reduce document processing time by 85% with AI automation.",
      date: "February 20, 2024",
      readTime: "10 min read",
      category: "Case Studies",
    },
    {
      title: "Compliance and Regulatory Requirements",
      excerpt: "Navigating GDPR, HIPAA, and other regulations in document management systems.",
      date: "February 15, 2024",
      readTime: "9 min read",
      category: "Compliance",
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
              Our <span className="text-gradient">Blog</span>
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Insights, updates, and best practices from the world of AI-powered document management.
            </p>
          </div>

          {/* Blog Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {blogPosts.map((post, index) => (
              <article
                key={index}
                className="bg-card/50 backdrop-blur-sm border border-primary/20 rounded-2xl overflow-hidden hover-lift group"
              >
                <div className="h-48 bg-gradient-to-br from-primary/20 to-accent/20" />
                <div className="p-6 space-y-4">
                  <div className="inline-block px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary">
                    {post.category}
                  </div>
                  <h3 className="text-xl font-bold group-hover:text-gradient transition-colors">
                    {post.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {post.excerpt}
                  </p>
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {post.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {post.readTime}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary hover:text-accent group/btn"
                    >
                      Read
                      <ArrowRight className="w-4 h-4 ml-1 group-hover/btn:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Blog;
