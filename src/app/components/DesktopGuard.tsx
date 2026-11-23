import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../i18n/i18n';
import { useEffect, useState } from 'react';
import { Monitor } from 'lucide-react';

interface DesktopGuardProps {
  children: React.ReactNode;
}

export function DesktopGuard({ children }: DesktopGuardProps) {
  useCerigaTranslation();

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
          <h1 className="text-3xl font-bold mb-4">{cerigaTranslate("interface.text_69f84d680ccf1cf8")}</h1>
          <p className="text-lg opacity-90">{cerigaTranslate("interface.text_3399389b97e7220b")}</p>
          <p className="text-sm opacity-75 mt-6">{cerigaTranslate("interface.text_191015222bb0d56b")}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
