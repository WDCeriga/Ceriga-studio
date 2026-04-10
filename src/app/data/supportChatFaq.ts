export type SupportFaq = {
  id: string;
  question: string;
  answer: string;
};

/** Premade answers shown in the dashboard live chat panel. */
export const SUPPORT_FAQS: SupportFaq[] = [
  {
    id: 'start-project',
    question: 'How do I start a new project?',
    answer:
      'Open Catalog from the sidebar, pick a garment, and choose your flow (tech pack, packaging, or manufacturer). You will land in the builder where you can add measurements, fabrics, and export your pack.',
  },
  {
    id: 'drafts',
    question: 'Where are my saved drafts?',
    answer:
      'Go to Drafts in the sidebar. Anything you have not submitted stays there with autosave. You can resume a draft anytime from that list.',
  },
  {
    id: 'orders',
    question: 'How do I track an order?',
    answer:
      'Use Orders in the sidebar to see status, shipment updates, and line items. Tap an order for full detail and any notes from the team.',
  },
  {
    id: 'payment',
    question: 'When am I charged?',
    answer:
      'Billing depends on your plan and checkout flow. You will see a clear summary before you confirm. For questions about an invoice, open Notifications and look for payment messages from admin.',
  },
  {
    id: 'files',
    question: 'How do I download my tech pack?',
    answer:
      'In the builder, use the export or download step when your pack is ready. Files are generated for production and can be shared with your factory.',
  },
  {
    id: 'support-human',
    question: 'Can I talk to a real person?',
    answer:
      'Yes. Use Studio messaging or email support for escalations. This quick help covers common questions; our team can pick up anything more specific.',
  },
];
