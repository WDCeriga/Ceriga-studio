import { useEffect, useState } from 'react';
import { Monitor } from 'lucide-react';

interface DesktopGuardProps {
  children: React.ReactNode;
}

export function DesktopGuard({ children }: DesktopGuardProps) {
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);

    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  if (!isDesktop) {
    return (
      <div className="fixed inset-0 bg-[#534AB7] flex items-center justify-center p-6">
        <div className="text-center text-white max-w-md">
          <Monitor className="w-24 h-24 mx-auto mb-6 opacity-90" />
          <h1 className="text-3xl font-bold mb-4">Desktop Required</h1>
          <p className="text-lg opacity-90">
            Ceriga Studio is a desktop-first application. Please use a desktop browser to access the garment builder and all features.
          </p>
          <p className="text-sm opacity-75 mt-6">
            Minimum screen width: 1024px
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
