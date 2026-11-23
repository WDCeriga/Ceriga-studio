import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { Link } from 'react-router';

const LABS = [
  {
    to: '/lab/create-designs',
    title: 'Create page designs',
    blurb:
      'Temp mockups vs shipped Create: tech pack, upload for quote, packaging only.',
  },
  {
    to: '/lab/garment-json',
    title: 'Garment JSON editor',
    blurb:
      'Edit parametric piece JSON (sleeve length, body, neck, cuff), drag landmarks, export.',
  },
  {
    to: '/lab/sleeve-color',
    title: 'Sleeve colour methods',
    blurb:
      'Compare fill strategies on static potrace sleeve assets — coded lines vs flood fill.',
  },
];

export function LabIndex() {
  useCerigaTranslation();

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <header className="border-b border-white/10 bg-[#111113]/90 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">{cerigaTranslate("interface.text_efdcf466b553a068")}</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{cerigaTranslate("interface.text_2542b50e36bc5360")}</h1>
            <p className="mt-1 text-sm text-white/55">{cerigaTranslate("interface.text_b7f0a221aaa414b6")}</p>
          </div>
          <Link
            to="/catalog"
            className="text-sm text-white/50 underline-offset-4 hover:text-white hover:underline"
          >{cerigaTranslate("marketing.catalog")}</Link>
        </div>
      </header>

      <ul className="mx-auto max-w-3xl space-y-3 px-4 py-8 sm:px-6">
        {LABS.map((lab) => (
          <li key={lab.to}>
            <Link
              to={lab.to}
              className="block rounded-2xl border border-[#252528] bg-[#111113] px-5 py-4 transition hover:border-white/20 hover:bg-[#161618]"
            >
              <h2 className="text-base font-medium text-white">{cerigaTranslateLabel(lab.title)}</h2>
              <p className="mt-1 text-sm text-white/50">{lab.blurb}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
