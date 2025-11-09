import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-6">
        <h1 className="text-8xl font-bold text-gradient">404</h1>
        <p className="text-2xl text-muted-foreground">Oops! Page not found</p>
        <a href="/" className="inline-block text-primary hover:text-accent transition-colors font-medium">
          Return to Home →
        </a>
      </div>
    </div>
  );
};

export default NotFound;
