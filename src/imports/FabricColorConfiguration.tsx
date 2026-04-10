import svgPaths from "./svg-dl18g0s353";
import imgTechnicalGarmentPreview from "figma:asset/37b67f908b8b15738d002b3697a1d51154a5478c.png";
import imgImage from "figma:asset/f84ad6d75c01f5865641dba32416e817dee06ff5.png";

function Label() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Label">
      <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal justify-center leading-[0] not-italic relative shrink-0 text-[#a1a1a6] text-[10px] tracking-[1px] uppercase w-full">
        <p className="leading-[15px]">Step 03 / 08</p>
      </div>
    </div>
  );
}

function Heading() {
  return (
    <div className="content-stretch flex flex-col items-start pt-[4px] relative shrink-0 w-full" data-name="Heading 1">
      <div className="flex flex-col font-['Plus_Jakarta_Sans:Regular',sans-serif] font-normal justify-center leading-[0] relative shrink-0 text-[30px] text-white tracking-[-1.5px] uppercase w-full">
        <p className="leading-[30px]">{`Fabric & Color`}</p>
      </div>
    </div>
  );
}

function Container1() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal justify-center leading-[0] not-italic relative shrink-0 text-[#a1a1a6] text-[12px] w-full">
        <p className="leading-[19.5px] mb-0">Select the base material weight and technical dye</p>
        <p className="leading-[19.5px]">specification for the main body panels.</p>
      </div>
    </div>
  );
}

function Container() {
  return (
    <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0 w-full" data-name="Container">
      <Label />
      <Heading />
      <Container1 />
    </div>
  );
}

function Margin() {
  return (
    <div className="relative shrink-0 w-full" data-name="Margin">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pb-[32px] relative w-full">
        <Container />
      </div>
    </div>
  );
}

function Label1() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Label">
      <div className="flex flex-col font-['Inter:Semi_Bold',sans-serif] font-semibold justify-center leading-[0] not-italic relative shrink-0 text-[#ff3b30] text-[10px] tracking-[1px] uppercase w-full">
        <p className="leading-[15px]">Material Profile</p>
      </div>
    </div>
  );
}

function Svg() {
  return (
    <div className="relative shrink-0 size-[18px]" data-name="SVG">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18 18">
        <g id="SVG">
          <path d="M5.4 7.2L9 10.8L12.6 7.2" id="Vector" stroke="var(--stroke-0, #6B7280)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.35" />
        </g>
      </svg>
    </div>
  );
}

function ImageFill() {
  return (
    <div className="absolute content-stretch flex flex-col h-[50px] items-start justify-center left-0 overflow-clip pl-[304px] pr-[9px] py-[16px] top-0 w-[331px]" data-name="image fill">
      <Svg />
    </div>
  );
}

function Container4() {
  return (
    <div className="-translate-y-1/2 absolute content-stretch flex flex-col items-start left-[17px] overflow-clip right-[17px] top-1/2" data-name="Container">
      <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal h-[16px] justify-center leading-[0] not-italic relative shrink-0 text-[#e5e2e3] text-[12px] w-[190.67px]">
        <p className="leading-[16px]">240GSM Organic Combed Cotton</p>
      </div>
    </div>
  );
}

function Options() {
  return (
    <div className="bg-[#1a1a1d] h-[50px] relative rounded-[2px] shrink-0 w-full" data-name="Options">
      <div aria-hidden="true" className="absolute border border-[#353436] border-solid inset-0 pointer-events-none rounded-[2px]" />
      <ImageFill />
      <Container4 />
    </div>
  );
}

function Container3() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <Options />
      <div className="absolute bottom-[43.25%] right-[22.02px] top-[41.95%] w-[12px]" data-name="Icon">
        <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 12 7.4">
          <path d={svgPaths.p1adfde00} fill="var(--fill-0, #A1A1A6)" id="Icon" />
        </svg>
      </div>
    </div>
  );
}

function Container2() {
  return (
    <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0 w-full" data-name="Container">
      <Label1 />
      <Container3 />
    </div>
  );
}

function Label2() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Label">
      <div className="flex flex-col font-['Inter:Semi_Bold',sans-serif] font-semibold h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#ff3b30] text-[10px] tracking-[1px] uppercase w-[132.13px]">
        <p className="leading-[15px]">Color Specification</p>
      </div>
    </div>
  );
}

function Container6() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#a1a1a6] text-[10px] tracking-[-0.5px] uppercase w-[65.61px]">
        <p className="leading-[15px]">HEX: #0B0B0C</p>
      </div>
    </div>
  );
}

function Container5() {
  return (
    <div className="content-stretch flex items-end justify-between relative shrink-0 w-full" data-name="Container">
      <Label2 />
      <Container6 />
    </div>
  );
}

function ButtonRedSwatches() {
  return (
    <div className="bg-[#ff3b30] col-1 relative rounded-[2px] row-1 shrink-0 size-[48.5px]" data-name="Button - Red Swatches">
      <div className="absolute bg-[rgba(255,255,255,0)] inset-0 rounded-[2px] shadow-[0px_0px_0px_2px_rgba(255,255,255,0.2)]" data-name="Button - Red Swatches:shadow" />
    </div>
  );
}

function ButtonDarkSwatches() {
  return (
    <div className="bg-[#0b0b0c] col-4 relative rounded-[2px] row-1 shrink-0 size-[48.5px]" data-name="Button - Dark Swatches">
      <div className="absolute bg-[rgba(255,255,255,0)] inset-0 rounded-[2px] shadow-[0px_0px_0px_2px_#ff3b30,0px_0px_10px_0px_rgba(255,59,48,0.3)]" data-name="Button - Dark Swatches:shadow" />
    </div>
  );
}

function Container7() {
  return (
    <div className="gap-x-[8px] gap-y-[8px] grid grid-cols-[repeat(6,minmax(0,1fr))] grid-rows-[__48.50px_48.50px] relative shrink-0 w-full" data-name="Container">
      <ButtonRedSwatches />
      <div className="bg-[#b31217] col-2 rounded-[2px] row-1 shrink-0 size-[48.5px]" data-name="Button" />
      <div className="bg-[#7a0003] col-3 rounded-[2px] row-1 shrink-0 size-[48.5px]" data-name="Button" />
      <ButtonDarkSwatches />
      <div className="bg-[#1a1a1d] col-5 rounded-[2px] row-1 shrink-0 size-[48.5px]" data-name="Button" />
      <div className="bg-[#353436] col-6 rounded-[2px] row-1 shrink-0 size-[48.5px]" data-name="Button" />
      <div className="bg-white col-1 rounded-[2px] row-2 shrink-0 size-[48.5px]" data-name="Button - Neutral Swatches" />
      <div className="bg-[#e5e2e3] col-2 rounded-[2px] row-2 shrink-0 size-[48.5px]" data-name="Button" />
      <div className="bg-[#a1a1a6] col-3 rounded-[2px] row-2 shrink-0 size-[48.5px]" data-name="Button" />
      <div className="bg-[#4a3f35] col-4 rounded-[2px] row-2 shrink-0 size-[48.5px]" data-name="Button - Earth Swatches" />
      <div className="bg-[#2d3a3a] col-5 rounded-[2px] row-2 shrink-0 size-[48.5px]" data-name="Button" />
      <div className="bg-[#1e2a4a] col-6 rounded-[2px] row-2 shrink-0 size-[48.5px]" data-name="Button" />
    </div>
  );
}

function Container8() {
  return (
    <div className="relative shrink-0 size-[11.667px]" data-name="Container">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 11.6667 11.6667">
        <g id="Container">
          <path d={svgPaths.p1c8df880} fill="var(--fill-0, #A1A1A6)" id="Icon" />
        </g>
      </svg>
    </div>
  );
}

function Button() {
  return (
    <div className="content-stretch flex gap-[7.99px] items-center justify-center px-px py-[9px] relative shrink-0 w-full" data-name="Button">
      <div aria-hidden="true" className="absolute border border-[#353436] border-dashed inset-0 pointer-events-none" />
      <Container8 />
      <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#a1a1a6] text-[10px] text-center tracking-[1px] uppercase w-[121.23px]">
        <p className="leading-[15px]">Custom Dye Match</p>
      </div>
    </div>
  );
}

function ColorPickerGrid() {
  return (
    <div className="content-stretch flex flex-col gap-[16px] items-start relative shrink-0 w-full" data-name="Color Picker Grid">
      <Container5 />
      <Container7 />
      <Button />
    </div>
  );
}

function Container9() {
  return (
    <div className="relative shrink-0 w-full" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative w-full">
        <div className="flex flex-col font-['Inter:Semi_Bold',sans-serif] font-semibold justify-center leading-[0] not-italic relative shrink-0 text-[#ff3b30] text-[9px] tracking-[1.8px] uppercase w-full">
          <p className="leading-[13.5px]">Production Note</p>
        </div>
      </div>
    </div>
  );
}

function Container10() {
  return (
    <div className="relative shrink-0 w-full" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pb-[0.755px] relative w-full">
        <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal justify-center leading-[0] not-italic relative shrink-0 text-[#a1a1a6] text-[11px] w-full">
          <p className="leading-[17.88px] mb-0">Reactive dye recommended for 240GSM cotton to</p>
          <p className="leading-[17.88px] mb-0">maintain high color fastness during industrial wash</p>
          <p className="leading-[17.88px]">cycles.</p>
        </div>
      </div>
    </div>
  );
}

function TextureInfo() {
  return (
    <div className="bg-[#141416] relative rounded-[2px] shrink-0 w-full" data-name="Texture Info">
      <div aria-hidden="true" className="absolute border-[#ff3b30] border-l-2 border-solid inset-0 pointer-events-none rounded-[2px]" />
      <div className="content-stretch flex flex-col gap-[2.875px] items-start pl-[18px] pr-[16px] py-[16px] relative w-full">
        <Container9 />
        <Container10 />
      </div>
    </div>
  );
}

function FabricTypeDropdown() {
  return (
    <div className="relative shrink-0 w-full" data-name="Fabric Type Dropdown">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[24px] items-start relative w-full">
        <Container2 />
        <ColorPickerGrid />
        <TextureInfo />
      </div>
    </div>
  );
}

function AsideLeftPanelConfiguration() {
  return (
    <div className="bg-[#0b0b0c] h-full relative shrink-0 w-[380px]" data-name="Aside - Left Panel: Configuration">
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col items-start pl-[24px] pr-[25px] py-[24px] relative size-full">
          <Margin />
          <FabricTypeDropdown />
        </div>
      </div>
      <div aria-hidden="true" className="absolute border-[#1a1a1d] border-r border-solid inset-0 pointer-events-none" />
    </div>
  );
}

function TechnicalGarmentPreview() {
  return (
    <div className="aspect-[576/576] mix-blend-screen relative shadow-[0px_20px_50px_0px_rgba(0,0,0,0.8)] shrink-0 w-full" data-name="Technical garment preview">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <img alt="" className="absolute left-0 max-w-none size-full top-0" src={imgTechnicalGarmentPreview} />
      </div>
    </div>
  );
}

function Container11() {
  return (
    <div className="content-stretch flex flex-col items-start max-w-[672px] px-[48px] relative shrink-0 w-[672px]" data-name="Container">
      <TechnicalGarmentPreview />
      <div className="absolute bottom-[-29.25px] flex flex-col font-['Inter:Regular',sans-serif] font-normal h-[13.5px] justify-center leading-[0] left-[28.17%] not-italic right-[60.82%] text-[#a1a1a6] text-[9px] tracking-[1.8px] translate-y-1/2 uppercase">
        <p className="leading-[13.5px]">Front View</p>
      </div>
      <div className="absolute bg-[#ff3b30] bottom-[-48px] h-[4px] left-[33.37%] right-[66.03%] rounded-[9999px]" data-name="Background" />
      <div className="absolute bottom-[-35.25px] flex flex-col font-['Inter:Regular',sans-serif] font-normal h-[13.5px] justify-center leading-[0] left-[43.94%] not-italic opacity-40 right-[46.23%] text-[#a1a1a6] text-[9px] tracking-[1.8px] translate-y-1/2 uppercase">
        <p className="leading-[13.5px]">Back View</p>
      </div>
      <div className="absolute bottom-[-35.25px] flex flex-col font-['Inter:Regular',sans-serif] font-normal h-[13.5px] justify-center leading-[0] left-[58.54%] not-italic opacity-40 right-[28.17%] text-[#a1a1a6] text-[9px] tracking-[1.8px] translate-y-1/2 uppercase">
        <p className="leading-[13.5px]">Detail Stitch</p>
      </div>
    </div>
  );
}

function Container12() {
  return (
    <div className="relative shrink-0 size-[18px]" data-name="Container">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18 18">
        <g id="Container">
          <path d={svgPaths.p3fc48a20} fill="var(--fill-0, white)" id="Icon" />
        </g>
      </svg>
    </div>
  );
}

function Button1() {
  return (
    <div className="absolute backdrop-blur-[6px] bg-[rgba(0,0,0,0.6)] content-stretch flex items-center justify-center opacity-0 right-[24px] rounded-[9999px] size-[40px] top-[24px]" data-name="Button">
      <div className="absolute bg-[rgba(255,255,255,0)] left-0 rounded-[9999px] shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)] size-[40px] top-0" data-name="Button:shadow" />
      <Container12 />
    </div>
  );
}

function Container13() {
  return (
    <div className="h-[20.95px] relative shrink-0 w-[17.95px]" data-name="Container">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 17.95 20.95">
        <g id="Container">
          <path d={svgPaths.p21f63600} fill="var(--fill-0, white)" id="Icon" />
        </g>
      </svg>
    </div>
  );
}

function Button2() {
  return (
    <div className="absolute backdrop-blur-[6px] bg-[rgba(0,0,0,0.6)] content-stretch flex items-center justify-center opacity-0 right-[24px] rounded-[9999px] size-[40px] top-[72px]" data-name="Button">
      <div className="absolute bg-[rgba(255,255,255,0)] left-0 rounded-[9999px] shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)] size-[40px] top-0" data-name="Button:shadow" />
      <Container13 />
    </div>
  );
}

function SectionCenterPanelLivePreview() {
  return (
    <div className="bg-black content-stretch flex flex-[1_0_0] h-full items-center justify-center min-h-px min-w-px overflow-clip relative" data-name="Section - Center Panel: Live Preview">
      <div className="absolute inset-0" data-name="Gradient" style={{ backgroundImage: "url('data:image/svg+xml;utf8,<svg viewBox=\\'0 0 900 904\\' xmlns=\\'http://www.w3.org/2000/svg\\' preserveAspectRatio=\\'none\\'><rect x=\\'0\\' y=\\'0\\' height=\\'100%\\' width=\\'100%\\' fill=\\'url(%23grad)\\' opacity=\\'1\\'/><defs><radialGradient id=\\'grad\\' gradientUnits=\\'userSpaceOnUse\\' cx=\\'0\\' cy=\\'0\\' r=\\'10\\' gradientTransform=\\'matrix(63.781 0 0 63.781 450 452)\\'><stop stop-color=\\'rgba(255,59,48,0.08)\\' offset=\\'0\\'/><stop stop-color=\\'rgba(255,59,48,0)\\' offset=\\'0.7\\'/></radialGradient></defs></svg>')" }} />
      <Container11 />
      <Button1 />
      <Button2 />
    </div>
  );
}

function MainContentCanvas() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative w-full" data-name="Main Content Canvas">
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex items-start pb-[56px] pt-[64px] relative size-full">
          <AsideLeftPanelConfiguration />
          <SectionCenterPanelLivePreview />
        </div>
      </div>
    </div>
  );
}

function Heading1() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Heading 2">
      <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold justify-center leading-[0] relative shrink-0 text-[12px] text-white tracking-[2.4px] uppercase w-full">
        <p className="leading-[16px]">Specification</p>
      </div>
    </div>
  );
}

function Container15() {
  return (
    <div className="content-stretch flex flex-col gap-[3.5px] items-start relative shrink-0 w-full" data-name="Container">
      <Heading1 />
      <div className="flex flex-col font-['Plus_Jakarta_Sans:Regular',sans-serif] font-normal h-[15px] justify-center leading-[0] relative shrink-0 text-[#a1a1a6] text-[10px] tracking-[1px] uppercase w-[115.38px]">
        <p className="leading-[15px]">V1.04-PRODUCTION</p>
      </div>
    </div>
  );
}

function Margin1() {
  return (
    <div className="content-stretch flex flex-col items-start pb-[32px] relative shrink-0 w-full" data-name="Margin">
      <Container15 />
    </div>
  );
}

function Container19() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#a1a1a6] text-[10px] tracking-[1px] uppercase w-[29.84px]">
        <p className="leading-[15px]">Type</p>
      </div>
    </div>
  );
}

function Container20() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Inter:Medium',sans-serif] font-medium h-[16px] justify-center leading-[0] not-italic relative shrink-0 text-[12px] text-white uppercase w-[82.72px]">
        <p className="leading-[16px]">Hoodie Core</p>
      </div>
    </div>
  );
}

function Container18() {
  return (
    <div className="content-stretch flex flex-col gap-[4px] items-start relative shrink-0 w-[82.72px]" data-name="Container">
      <Container19 />
      <Container20 />
    </div>
  );
}

function Container17() {
  return (
    <div className="content-stretch flex items-start justify-between relative shrink-0 w-full" data-name="Container">
      <Container18 />
      <div className="relative shrink-0 size-[10.5px]" data-name="Icon">
        <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 32">
          <path d={svgPaths.p2cbc1080} fill="var(--fill-0, #FF3B30)" id="Icon" opacity="0" />
        </svg>
      </div>
    </div>
  );
}

function Container23() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#a1a1a6] text-[10px] tracking-[1px] uppercase w-[18.05px]">
        <p className="leading-[15px]">Fit</p>
      </div>
    </div>
  );
}

function Container24() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Inter:Medium',sans-serif] font-medium h-[16px] justify-center leading-[0] not-italic relative shrink-0 text-[12px] text-white uppercase w-[66.91px]">
        <p className="leading-[16px]">Oversized</p>
      </div>
    </div>
  );
}

function Container22() {
  return (
    <div className="content-stretch flex flex-col gap-[4px] items-start relative shrink-0 w-[66.91px]" data-name="Container">
      <Container23 />
      <Container24 />
    </div>
  );
}

function Container21() {
  return (
    <div className="content-stretch flex items-start justify-between relative shrink-0 w-full" data-name="Container">
      <Container22 />
      <div className="relative shrink-0 size-[10.5px]" data-name="Icon">
        <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 32">
          <path d={svgPaths.p2cbc1080} fill="var(--fill-0, #FF3B30)" id="Icon" opacity="0" />
        </svg>
      </div>
    </div>
  );
}

function Container27() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Inter:Semi_Bold',sans-serif] font-semibold h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#ff3b30] text-[10px] tracking-[1px] uppercase w-[41.5px]">
        <p className="leading-[15px]">Fabric</p>
      </div>
    </div>
  );
}

function Container28() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Inter:Medium_Italic',sans-serif] font-medium h-[16px] italic justify-center leading-[0] relative shrink-0 text-[#a1a1a6] text-[12px] uppercase w-[133.23px]">
        <p className="leading-[16px]">[Pending Selection]</p>
      </div>
    </div>
  );
}

function Container26() {
  return (
    <div className="content-stretch flex flex-col gap-[4px] items-start relative shrink-0 w-[133.23px]" data-name="Container">
      <Container27 />
      <Container28 />
    </div>
  );
}

function Margin2() {
  return (
    <div className="content-stretch flex flex-col h-[12px] items-start pt-[4px] relative shrink-0 w-[8px]" data-name="Margin">
      <div className="bg-[#ff3b30] rounded-[9999px] shrink-0 size-[8px]" data-name="Background" />
    </div>
  );
}

function Container25() {
  return (
    <div className="content-stretch flex items-start justify-between relative shrink-0 w-full" data-name="Container">
      <Container26 />
      <Margin2 />
    </div>
  );
}

function ConfigItems() {
  return (
    <div className="content-stretch flex flex-col gap-[16px] items-start relative shrink-0 w-full" data-name="Config Items">
      <Container17 />
      <Container21 />
      <Container25 />
    </div>
  );
}

function Container30() {
  return (
    <div className="content-stretch flex flex-col items-start relative self-stretch shrink-0" data-name="Container">
      <div className="h-[18px] relative shrink-0 w-[18.025px]" data-name="Icon">
        <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18.025 18">
          <path d={svgPaths.p1ebc0d40} fill="var(--fill-0, #FF3B30)" id="Icon" />
        </svg>
      </div>
    </div>
  );
}

function Container31() {
  return (
    <div className="content-stretch flex flex-col items-start relative self-stretch shrink-0" data-name="Container">
      <div className="h-[12px] relative shrink-0 w-[20px]" data-name="Icon">
        <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 12">
          <path d={svgPaths.p28cfa800} fill="var(--fill-0, white)" fillOpacity="0.2" id="Icon" />
        </svg>
      </div>
    </div>
  );
}

function Container29() {
  return (
    <div className="h-[18px] relative shrink-0 w-full" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start justify-between relative size-full">
        <Container30 />
        <Container31 />
      </div>
    </div>
  );
}

function Container33() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal justify-center leading-[0] not-italic relative shrink-0 text-[10px] text-white w-full">
        <p className="leading-[15px]">Preview 240GSM Cotton</p>
      </div>
    </div>
  );
}

function Container32() {
  return (
    <div className="relative shrink-0 w-full" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative w-full">
        <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal h-[14px] justify-center leading-[0] not-italic relative shrink-0 text-[#a1a1a6] text-[9px] tracking-[0.9px] uppercase w-[88.23px]">
          <p className="leading-[13.5px]">Macro Texture</p>
        </div>
        <Container33 />
      </div>
    </div>
  );
}

function MaterialVisualizationCard() {
  return (
    <div className="bg-[#1a1a1d] relative rounded-[2px] shrink-0 w-full" data-name="Material Visualization Card">
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col items-start justify-between p-[17px] relative w-full">
          <div className="absolute bg-size-[24px_22px] bg-top-left inset-[1px_1px_0.56px_1px] opacity-10" data-name="Image" style={{ backgroundImage: `url('${imgImage}')` }} />
          <Container29 />
          <Container32 />
        </div>
      </div>
      <div aria-hidden="true" className="absolute border border-[#353436] border-solid inset-0 pointer-events-none rounded-[2px]" />
    </div>
  );
}

function Container16() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col gap-[32px] items-start min-h-px min-w-px relative w-full" data-name="Container">
      <ConfigItems />
      <MaterialVisualizationCard />
    </div>
  );
}

function Container34() {
  return (
    <div className="relative shrink-0 size-[9.333px]" data-name="Container">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 9.33333 9.33333">
        <g id="Container">
          <path d={svgPaths.pce77c00} fill="var(--fill-0, white)" id="Icon" />
        </g>
      </svg>
    </div>
  );
}

function Button3() {
  return (
    <div className="bg-[#ff3b30] relative rounded-[2px] shrink-0 w-full" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[8px] items-center justify-center py-[16px] relative w-full">
        <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold h-[16px] justify-center leading-[0] relative shrink-0 text-[12px] text-center text-white tracking-[2.4px] uppercase w-[116.98px]">
          <p className="leading-[16px]">Finalize Spec</p>
        </div>
        <Container34 />
      </div>
    </div>
  );
}

function HorizontalBorder() {
  return (
    <div className="content-stretch flex flex-col items-start pt-[25px] relative shrink-0 w-full" data-name="HorizontalBorder">
      <div aria-hidden="true" className="absolute border-[#1a1a1d] border-solid border-t inset-0 pointer-events-none" />
      <Button3 />
    </div>
  );
}

function Container14() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative w-full" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start justify-between p-[24px] relative size-full">
        <Margin1 />
        <Container16 />
        <HorizontalBorder />
      </div>
    </div>
  );
}

function Container35() {
  return (
    <div className="relative shrink-0 size-[18px]" data-name="Container">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18 18">
        <g id="Container">
          <path d={svgPaths.p4c2b800} fill="var(--fill-0, #FF3B30)" id="Icon" />
        </g>
      </svg>
    </div>
  );
}

function BackgroundBorder() {
  return (
    <div className="absolute bg-[#1a1a1d] left-[-47px] size-[48px] top-[48px]" data-name="Background+Border">
      <div aria-hidden="true" className="absolute border border-[#1a1a1d] border-solid inset-0 pointer-events-none" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center p-px relative size-full">
        <Container35 />
      </div>
    </div>
  );
}

function Container36() {
  return (
    <div className="h-[18px] relative shrink-0 w-[18.025px]" data-name="Container">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18.025 18">
        <g id="Container">
          <path d={svgPaths.p1ebc0d40} fill="var(--fill-0, #A1A1A6)" id="Icon" />
        </g>
      </svg>
    </div>
  );
}

function BackgroundBorder1() {
  return (
    <div className="absolute bg-[#0b0b0c] left-[-47px] size-[48px] top-[104px]" data-name="Background+Border">
      <div aria-hidden="true" className="absolute border border-[#1a1a1d] border-solid inset-0 pointer-events-none" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center p-px relative size-full">
        <Container36 />
      </div>
    </div>
  );
}

function Container37() {
  return (
    <div className="h-[12px] relative shrink-0 w-[20px]" data-name="Container">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 12">
        <g id="Container">
          <path d={svgPaths.p28cfa800} fill="var(--fill-0, #A1A1A6)" id="Icon" />
        </g>
      </svg>
    </div>
  );
}

function BackgroundBorder2() {
  return (
    <div className="absolute bg-[#0b0b0c] left-[-47px] size-[48px] top-[160px]" data-name="Background+Border">
      <div aria-hidden="true" className="absolute border border-[#1a1a1d] border-solid inset-0 pointer-events-none" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center p-px relative size-full">
        <Container37 />
      </div>
    </div>
  );
}

function AsideRightPanelSpecificationSummary() {
  return (
    <div className="absolute bg-[#0b0b0c] content-stretch flex flex-col h-[960px] items-start justify-center pl-px right-0 top-[64px] w-[320px]" data-name="Aside - Right Panel: Specification Summary">
      <div aria-hidden="true" className="absolute border-[#1a1a1d] border-l border-solid inset-0 pointer-events-none" />
      <Container14 />
      <BackgroundBorder />
      <BackgroundBorder1 />
      <BackgroundBorder2 />
    </div>
  );
}

function Container39() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Plus_Jakarta_Sans:ExtraBold',sans-serif] font-extrabold h-[28px] justify-center leading-[0] relative shrink-0 text-[20px] text-white tracking-[2px] uppercase w-[181.48px]">
        <p className="leading-[28px]">Ceriga Engine</p>
      </div>
    </div>
  );
}

function Container40() {
  return (
    <div className="h-[16.5px] relative shrink-0 w-[24.09px]" data-name="Container">
      <div className="-translate-y-1/2 absolute flex flex-col font-['Plus_Jakarta_Sans:Regular',sans-serif] font-normal h-[17px] justify-center leading-[0] left-0 text-[#a1a1a6] text-[11px] top-[7.5px] tracking-[-0.55px] uppercase w-[24.09px]">
        <p className="leading-[16.5px]">Type</p>
      </div>
    </div>
  );
}

function Container41() {
  return (
    <div className="h-[16.5px] relative shrink-0 w-[13.2px]" data-name="Container">
      <div className="-translate-y-1/2 absolute flex flex-col font-['Plus_Jakarta_Sans:Regular',sans-serif] font-normal h-[17px] justify-center leading-[0] left-0 text-[#a1a1a6] text-[11px] top-[7.5px] tracking-[-0.55px] uppercase w-[13.2px]">
        <p className="leading-[16.5px]">Fit</p>
      </div>
    </div>
  );
}

function HorizontalBorder1() {
  return (
    <div className="h-[22.5px] relative shrink-0 w-[35.8px]" data-name="HorizontalBorder">
      <div aria-hidden="true" className="absolute border-[#ff3b30] border-b-2 border-solid inset-0 pointer-events-none" />
      <div className="-translate-y-1/2 absolute flex flex-col font-['Plus_Jakarta_Sans:Regular',sans-serif] font-normal h-[17px] justify-center leading-[0] left-0 text-[#ff3b30] text-[11px] top-[7.5px] tracking-[-0.55px] uppercase w-[35.8px]">
        <p className="leading-[16.5px]">Fabric</p>
      </div>
    </div>
  );
}

function Container42() {
  return (
    <div className="h-[16.5px] relative shrink-0 w-[28.42px]" data-name="Container">
      <div className="-translate-y-1/2 absolute flex flex-col font-['Plus_Jakarta_Sans:Regular',sans-serif] font-normal h-[17px] justify-center leading-[0] left-0 text-[#a1a1a6] text-[11px] top-[7.5px] tracking-[-0.55px] uppercase w-[28.42px]">
        <p className="leading-[16.5px]">Neck</p>
      </div>
    </div>
  );
}

function Container43() {
  return (
    <div className="h-[16.5px] relative shrink-0 w-[43.58px]" data-name="Container">
      <div className="-translate-y-1/2 absolute flex flex-col font-['Plus_Jakarta_Sans:Regular',sans-serif] font-normal h-[17px] justify-center leading-[0] left-0 text-[#a1a1a6] text-[11px] top-[7.5px] tracking-[-0.55px] uppercase w-[43.58px]">
        <p className="leading-[16.5px]">Sleeves</p>
      </div>
    </div>
  );
}

function Container44() {
  return (
    <div className="h-[16.5px] relative shrink-0 w-[22.38px]" data-name="Container">
      <div className="-translate-y-1/2 absolute flex flex-col font-['Plus_Jakarta_Sans:Regular',sans-serif] font-normal h-[17px] justify-center leading-[0] left-0 text-[#a1a1a6] text-[11px] top-[7.5px] tracking-[-0.55px] uppercase w-[22.38px]">
        <p className="leading-[16.5px]">Hem</p>
      </div>
    </div>
  );
}

function Container45() {
  return (
    <div className="h-[16.5px] relative shrink-0 w-[48.14px]" data-name="Container">
      <div className="-translate-y-1/2 absolute flex flex-col font-['Plus_Jakarta_Sans:Regular',sans-serif] font-normal h-[17px] justify-center leading-[0] left-0 text-[#a1a1a6] text-[11px] top-[7.5px] tracking-[-0.55px] uppercase w-[48.14px]">
        <p className="leading-[16.5px]">Pockets</p>
      </div>
    </div>
  );
}

function Container46() {
  return (
    <div className="h-[16.5px] relative shrink-0 w-[38.03px]" data-name="Container">
      <div className="-translate-y-1/2 absolute flex flex-col font-['Plus_Jakarta_Sans:Regular',sans-serif] font-normal h-[17px] justify-center leading-[0] left-0 text-[#a1a1a6] text-[11px] top-[7.5px] tracking-[-0.55px] uppercase w-[38.03px]">
        <p className="leading-[16.5px]">Review</p>
      </div>
    </div>
  );
}

function Nav() {
  return (
    <div className="content-stretch flex gap-[24px] items-center relative shrink-0" data-name="Nav">
      <Container40 />
      <Container41 />
      <HorizontalBorder1 />
      <Container42 />
      <Container43 />
      <Container44 />
      <Container45 />
      <Container46 />
    </div>
  );
}

function Container38() {
  return (
    <div className="relative shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[24px] items-center relative">
        <Container39 />
        <Nav />
      </div>
    </div>
  );
}

function Container49() {
  return (
    <div className="content-stretch flex flex-col items-start relative self-stretch shrink-0" data-name="Container">
      <div className="h-[20px] relative shrink-0 w-[20.1px]" data-name="Icon">
        <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20.1 20">
          <path d={svgPaths.p3cdadd00} fill="var(--fill-0, #A1A1A6)" id="Icon" />
        </svg>
      </div>
    </div>
  );
}

function Container50() {
  return (
    <div className="content-stretch flex flex-col items-start relative self-stretch shrink-0" data-name="Container">
      <div className="relative shrink-0 size-[20px]" data-name="Icon">
        <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
          <path d={svgPaths.p2816f2c0} fill="var(--fill-0, #A1A1A6)" id="Icon" />
        </svg>
      </div>
    </div>
  );
}

function Container48() {
  return (
    <div className="content-stretch flex gap-[12px] h-[20px] items-start relative shrink-0" data-name="Container">
      <Container49 />
      <Container50 />
    </div>
  );
}

function Margin3() {
  return (
    <div className="content-stretch flex flex-col items-start pr-[16px] relative shrink-0" data-name="Margin">
      <Container48 />
    </div>
  );
}

function Button4() {
  return (
    <div className="bg-[#ff3b30] content-stretch flex flex-col items-center justify-center px-[24px] py-[8px] relative rounded-[2px] shrink-0" data-name="Button">
      <div className="flex flex-col font-['Inter:Semi_Bold',sans-serif] font-semibold h-[16px] justify-center leading-[0] not-italic relative shrink-0 text-[12px] text-center text-white tracking-[1.2px] uppercase w-[86.73px]">
        <p className="leading-[16px]">Save Draft</p>
      </div>
    </div>
  );
}

function Container47() {
  return (
    <div className="relative shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[16.01px] items-center relative">
        <Margin3 />
        <Button4 />
      </div>
    </div>
  );
}

function HeaderTopNavigationShell() {
  return (
    <div className="absolute backdrop-blur-[6px] bg-[rgba(11,11,12,0.8)] content-stretch flex h-[64px] items-center justify-between left-0 pb-px px-[32px] top-0 w-[1280px]" data-name="Header - Top Navigation Shell">
      <div aria-hidden="true" className="absolute border-[#1a1a1d] border-b border-solid inset-0 pointer-events-none shadow-[0px_0px_20px_0px_rgba(255,59,48,0.1)]" />
      <Container38 />
      <Container47 />
    </div>
  );
}

function Container51() {
  return (
    <div className="relative shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative">
        <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#a1a1a6] text-[10px] tracking-[1px] uppercase w-[385.61px]">
          <p className="leading-[15px]">© 2024 CERIGA FABRIC ENGINE | INDUSTRIAL GRADE PRODUCTION</p>
        </div>
      </div>
    </div>
  );
}

function Container53() {
  return (
    <div className="content-stretch flex flex-col items-start relative self-stretch shrink-0" data-name="Container">
      <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#a1a1a6] text-[10px] tracking-[1px] uppercase w-[111.13px]">
        <p className="leading-[15px]">Terms of Service</p>
      </div>
    </div>
  );
}

function Container54() {
  return (
    <div className="content-stretch flex flex-col items-start relative self-stretch shrink-0" data-name="Container">
      <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#a1a1a6] text-[10px] tracking-[1px] uppercase w-[125.72px]">
        <p className="leading-[15px]">Factory Standards</p>
      </div>
    </div>
  );
}

function Container55() {
  return (
    <div className="content-stretch flex flex-col items-start relative self-stretch shrink-0" data-name="Container">
      <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#a1a1a6] text-[10px] tracking-[1px] uppercase w-[54.17px]">
        <p className="leading-[15px]">Support</p>
      </div>
    </div>
  );
}

function Container52() {
  return (
    <div className="h-[15px] relative shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[32px] h-full items-start relative">
        <Container53 />
        <Container54 />
        <Container55 />
      </div>
    </div>
  );
}

function FooterShell() {
  return (
    <div className="absolute backdrop-blur-[2px] bg-[rgba(0,0,0,0.9)] bottom-0 content-stretch flex items-center justify-between left-0 pb-[16px] pt-[17px] px-[32px] w-[1280px]" data-name="Footer Shell">
      <div aria-hidden="true" className="absolute border-[#1a1a1d] border-solid border-t inset-0 pointer-events-none" />
      <Container51 />
      <Container52 />
    </div>
  );
}

export default function FabricColorConfiguration() {
  return (
    <div className="bg-[#0b0b0c] content-stretch flex flex-col items-start justify-center relative size-full" data-name="Fabric & Color Configuration">
      <MainContentCanvas />
      <AsideRightPanelSpecificationSummary />
      <HeaderTopNavigationShell />
      <FooterShell />
    </div>
  );
}