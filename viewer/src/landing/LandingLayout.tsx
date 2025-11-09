import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';

const LandingLayout = () => {
  useEffect(() => {
    // Override body styles for landing page
    document.body.style.backgroundColor = 'hsl(0 0% 100%)';
    document.body.style.color = 'hsl(222.2 84% 4.9%)';
    document.body.style.overflow = 'auto';
    
    return () => {
      // Restore original styles when leaving landing page
      document.body.style.backgroundColor = '#121212';
      document.body.style.color = '#ffffff';
      document.body.style.overflow = 'hidden';
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Outlet />
    </div>
  );
};

export default LandingLayout;
