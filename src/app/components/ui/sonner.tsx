"use client";

import { useCerigaTranslation } from '../../i18n/i18n';

import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const { t, label } = useCerigaTranslation();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
      containerAriaLabel={props.containerAriaLabel ? label(props.containerAriaLabel) : t('nav.notifications')}
      toastOptions={{ ...props.toastOptions, closeButtonAriaLabel: props.toastOptions?.closeButtonAriaLabel ? label(props.toastOptions.closeButtonAriaLabel) : t('common.close') }}
    />
  );
};

export { Toaster };
