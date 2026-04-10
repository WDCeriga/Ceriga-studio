import svgPaths from "./svg-9fb69qcrt0";
import imgHighDetailTechnicalIllustrationOfAMinimalistHeavyweightCottonTShirtNeckDetailWithCrispRedStitchingAccentsOnAMatteBlackBackground from "figma:asset/9c9b5ee113560ec7bb6982f5450b0adc4ee63d74.png";

function Heading() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Heading 1">
      <div className="flex flex-col font-['Plus_Jakarta_Sans:ExtraBold',sans-serif] font-extrabold justify-center leading-[0] relative shrink-0 text-[30px] text-white tracking-[-1.5px] uppercase w-full">
        <p className="leading-[36px] mb-0">Collar</p>
        <p className="leading-[36px]">Construction</p>
      </div>
    </div>
  );
}

function Container1() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Inter:Light',sans-serif] font-light justify-center leading-[0] not-italic relative shrink-0 text-[#e7bdb7] text-[14px] w-full">
        <p className="leading-[20px]">Select the neckline geometry for the garment base.</p>
      </div>
    </div>
  );
}

function Container() {
  return (
    <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold h-[15px] justify-center leading-[0] relative shrink-0 text-[#ff3b30] text-[10px] tracking-[2px] uppercase w-[85.75px]">
        <p className="leading-[15px]">Step 04 / 08</p>
      </div>
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

function Container2() {
  return (
    <div className="relative shrink-0 w-full" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative w-full">
        <div className="relative shrink-0 size-[30px]" data-name="Icon">
          <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 30 30">
            <path d={svgPaths.p12629e80} fill="var(--fill-0, #A1A1A6)" id="Icon" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Container3() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold justify-center leading-[0] relative shrink-0 text-[10px] text-white tracking-[1px] uppercase w-full">
        <p className="leading-[15px]">Crew Neck</p>
      </div>
    </div>
  );
}

function Margin1() {
  return (
    <div className="relative shrink-0 w-full" data-name="Margin">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pt-[16px] relative w-full">
        <Container3 />
      </div>
    </div>
  );
}

function ButtonOptionCard() {
  return (
    <div className="bg-[#201f20] col-1 content-stretch flex flex-col items-start justify-self-start p-[17px] relative row-1 self-start shrink-0" data-name="Button - Option Card 1">
      <div aria-hidden="true" className="absolute border border-[#1a1a1d] border-solid inset-0 pointer-events-none" />
      <Container2 />
      <Margin1 />
      <div className="absolute right-[10.69px] size-[11.667px] top-[13.17px]" data-name="Icon">
        <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 32">
          <path d={svgPaths.p3cf2be00} fill="var(--fill-0, #FF3B30)" id="Icon" opacity="0" />
        </svg>
      </div>
    </div>
  );
}

function Container4() {
  return (
    <div className="relative shrink-0 w-full" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative w-full">
        <div className="h-[3px] relative shrink-0 w-[24px]" data-name="Icon">
          <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 24 3">
            <path d="M0 3V0H24V3H0V3" fill="var(--fill-0, #A1A1A6)" id="Icon" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Container5() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold justify-center leading-[0] relative shrink-0 text-[10px] text-white tracking-[1px] uppercase w-full">
        <p className="leading-[15px]">V-Neck</p>
      </div>
    </div>
  );
}

function Margin2() {
  return (
    <div className="relative shrink-0 w-full" data-name="Margin">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pt-[16px] relative w-full">
        <Container5 />
      </div>
    </div>
  );
}

function ButtonOptionCard1() {
  return (
    <div className="bg-[#201f20] col-2 content-stretch flex flex-col items-start p-[17px] relative row-1 self-start shrink-0 w-[58px]" data-name="Button - Option Card 2">
      <div aria-hidden="true" className="absolute border border-[#1a1a1d] border-solid inset-0 pointer-events-none" />
      <Container4 />
      <Margin2 />
    </div>
  );
}

function Container6() {
  return (
    <div className="relative shrink-0 w-full" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative w-full">
        <div className="h-[11.1px] relative shrink-0 w-[18px]" data-name="Icon">
          <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18 11.1">
            <path d={svgPaths.p17c37280} fill="var(--fill-0, #A1A1A6)" id="Icon" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Container7() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold justify-center leading-[0] relative shrink-0 text-[10px] text-white tracking-[1px] uppercase w-full">
        <p className="leading-[15px]">Mock Neck</p>
      </div>
    </div>
  );
}

function Margin3() {
  return (
    <div className="relative shrink-0 w-full" data-name="Margin">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pt-[16px] relative w-full">
        <Container7 />
      </div>
    </div>
  );
}

function ButtonOptionCard2() {
  return (
    <div className="bg-[#201f20] col-1 content-stretch flex flex-col items-start p-[17px] relative row-2 self-start shrink-0 w-[52px]" data-name="Button - Option Card 3">
      <div aria-hidden="true" className="absolute border border-[#1a1a1d] border-solid inset-0 pointer-events-none" />
      <Container6 />
      <Margin3 />
    </div>
  );
}

function Container8() {
  return (
    <div className="relative shrink-0 w-full" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative w-full">
        <div className="h-[11.1px] relative shrink-0 w-[18px]" data-name="Icon">
          <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18 11.1">
            <path d={svgPaths.p163ad800} fill="var(--fill-0, #A1A1A6)" id="Icon" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Container9() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold justify-center leading-[0] relative shrink-0 text-[10px] text-white tracking-[1px] uppercase w-full">
        <p className="leading-[15px]">Scoop Neck</p>
      </div>
    </div>
  );
}

function Margin4() {
  return (
    <div className="relative shrink-0 w-full" data-name="Margin">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pt-[16px] relative w-full">
        <Container9 />
      </div>
    </div>
  );
}

function ButtonOptionCard3() {
  return (
    <div className="bg-[#201f20] col-2 content-stretch flex flex-col items-start p-[17px] relative row-2 self-start shrink-0 w-[52px]" data-name="Button - Option Card 4">
      <div aria-hidden="true" className="absolute border border-[#1a1a1d] border-solid inset-0 pointer-events-none" />
      <Container8 />
      <Margin4 />
    </div>
  );
}

function VisualCardsGrid() {
  return (
    <div className="gap-x-[12px] gap-y-[12px] grid grid-cols-[repeat(2,minmax(0,1fr))] grid-rows-[__105px_105px] relative shrink-0 w-full" data-name="Visual Cards Grid">
      <ButtonOptionCard />
      <ButtonOptionCard1 />
      <ButtonOptionCard2 />
      <ButtonOptionCard3 />
    </div>
  );
}

function VisualCardsGridMargin() {
  return (
    <div className="relative shrink-0 w-full" data-name="Visual Cards Grid:margin">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pb-[40px] relative w-full">
        <VisualCardsGrid />
      </div>
    </div>
  );
}

function Label() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Label">
      <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold h-[15px] justify-center leading-[0] relative shrink-0 text-[#a1a1a6] text-[10px] tracking-[1px] uppercase w-[96.03px]">
        <p className="leading-[15px]">Rib Height (cm)</p>
      </div>
    </div>
  );
}

function Container12() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold h-[18px] justify-center leading-[0] relative shrink-0 text-[12px] text-white w-[39.61px]">
        <p className="leading-[18px]">2.5 cm</p>
      </div>
    </div>
  );
}

function Container11() {
  return (
    <div className="content-stretch flex items-center justify-between pb-[8px] relative shrink-0 w-full" data-name="Container">
      <Label />
      <Container12 />
    </div>
  );
}

function Container14() {
  return <div className="flex-[1_0_0] h-[16px] min-h-px min-w-px" data-name="Container" />;
}

function Container13() {
  return (
    <div className="absolute content-stretch flex items-center justify-center left-0 right-0 top-[-6px]" data-name="Container">
      <Container14 />
    </div>
  );
}

function Input() {
  return (
    <div className="bg-[#2a2a2b] h-[4px] relative rounded-[8px] shrink-0 w-full" data-name="Input">
      <Container13 />
    </div>
  );
}

function Container16() {
  return (
    <div className="content-stretch flex flex-col items-start relative self-stretch shrink-0" data-name="Container">
      <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[#47464a] text-[8px] w-[10.41px]">
        <p className="leading-[12px]">1.0</p>
      </div>
    </div>
  );
}

function Container17() {
  return (
    <div className="content-stretch flex flex-col items-start relative self-stretch shrink-0" data-name="Container">
      <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[#47464a] text-[8px] w-[15.25px]">
        <p className="leading-[12px]">10.0</p>
      </div>
    </div>
  );
}

function Container15() {
  return (
    <div className="content-stretch flex h-[12px] items-start justify-between relative shrink-0 w-full" data-name="Container">
      <Container16 />
      <Container17 />
    </div>
  );
}

function Container10() {
  return (
    <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0 w-full" data-name="Container">
      <Container11 />
      <Input />
      <Container15 />
    </div>
  );
}

function Label1() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Label">
      <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold justify-center leading-[0] relative shrink-0 text-[#a1a1a6] text-[10px] tracking-[1px] uppercase w-full">
        <p className="leading-[15px]">Stitch Type</p>
      </div>
    </div>
  );
}

function Border() {
  return (
    <div className="relative rounded-[9999px] shrink-0 size-[16px]" data-name="Border">
      <div aria-hidden="true" className="absolute border border-[#ff3b30] border-solid inset-0 pointer-events-none rounded-[9999px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center p-px relative size-full">
        <div className="bg-[#ff3b30] rounded-[9999px] shrink-0 size-[8px]" data-name="Background" />
      </div>
    </div>
  );
}

function Container20() {
  return (
    <div className="relative shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative">
        <div className="flex flex-col font-['Inter:Semi_Bold',sans-serif] font-semibold h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[10px] text-white tracking-[0.5px] uppercase w-[155.23px]">
          <p className="leading-[15px]">Double-Needle Topstitch</p>
        </div>
      </div>
    </div>
  );
}

function BackgroundBorder() {
  return (
    <div className="bg-[#201f20] relative shrink-0 w-full" data-name="Background+Border">
      <div aria-hidden="true" className="absolute border border-[#1a1a1d] border-solid inset-0 pointer-events-none" />
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex gap-[12px] items-center p-[13px] relative w-full">
          <Border />
          <Container20 />
        </div>
      </div>
    </div>
  );
}

function Container21() {
  return (
    <div className="relative shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative">
        <div className="flex flex-col font-['Inter:Semi_Bold',sans-serif] font-semibold h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[10px] text-white tracking-[0.5px] uppercase w-[79.98px]">
          <p className="leading-[15px]">Cover Stitch</p>
        </div>
      </div>
    </div>
  );
}

function BackgroundBorder1() {
  return (
    <div className="bg-[#201f20] opacity-50 relative shrink-0 w-full" data-name="Background+Border">
      <div aria-hidden="true" className="absolute border border-[#1a1a1d] border-solid inset-0 pointer-events-none" />
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex gap-[12px] items-center p-[13px] relative w-full">
          <div className="relative rounded-[9999px] shrink-0 size-[16px]" data-name="Border">
            <div aria-hidden="true" className="absolute border border-[#47464a] border-solid inset-0 pointer-events-none rounded-[9999px]" />
          </div>
          <Container21 />
        </div>
      </div>
    </div>
  );
}

function Container19() {
  return (
    <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0 w-full" data-name="Container">
      <BackgroundBorder />
      <BackgroundBorder1 />
    </div>
  );
}

function Container18() {
  return (
    <div className="content-stretch flex flex-col gap-[16px] items-start relative shrink-0 w-full" data-name="Container">
      <Label1 />
      <Container19 />
    </div>
  );
}

function Parameters() {
  return (
    <div className="relative shrink-0 w-full" data-name="Parameters">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[32px] items-start relative w-full">
        <Container10 />
        <Container18 />
      </div>
    </div>
  );
}

function AsideLeftSelectionPanel() {
  return (
    <div className="bg-[#0e0e0f] relative self-stretch shrink-0 w-[384px]" data-name="Aside - Left Selection Panel">
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col items-start pl-[24px] pr-[25px] py-[24px] relative size-full">
          <Margin />
          <VisualCardsGridMargin />
          <Parameters />
        </div>
      </div>
      <div aria-hidden="true" className="absolute border-[#1a1a1d] border-r border-solid inset-0 pointer-events-none" />
    </div>
  );
}

function HighDetailTechnicalIllustrationOfAMinimalistHeavyweightCottonTShirtNeckDetailWithCrispRedStitchingAccentsOnAMatteBlackBackground() {
  return (
    <div className="flex-[1_0_0] h-full min-h-px min-w-px relative" data-name="high-detail technical illustration of a minimalist heavyweight cotton t-shirt neck detail with crisp red stitching accents on a matte black background">
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 overflow-hidden">
          <img alt="" className="absolute h-full left-[-12.5%] max-w-none top-0 w-[125%]" src={imgHighDetailTechnicalIllustrationOfAMinimalistHeavyweightCottonTShirtNeckDetailWithCrispRedStitchingAccentsOnAMatteBlackBackground} />
        </div>
        <div className="absolute bg-white inset-0 mix-blend-saturation" />
      </div>
    </div>
  );
}

function OverlayVerticalBorderOverlayBlur() {
  return (
    <div className="absolute backdrop-blur-[4px] bg-[rgba(0,0,0,0.8)] content-stretch flex flex-col inset-[32px_356.16px_537px_32px] items-start pl-[18px] pr-[16px] py-[8px]" data-name="Overlay+VerticalBorder+OverlayBlur">
      <div aria-hidden="true" className="absolute border-[#ff3b30] border-l-2 border-solid inset-0 pointer-events-none" />
      <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold h-[15px] justify-center leading-[0] relative shrink-0 text-[#ff3b30] text-[10px] tracking-[1px] uppercase w-[57.84px]">
        <p className="leading-[15px]">Live View</p>
      </div>
    </div>
  );
}

function OverlayOverlayBlur() {
  return (
    <div className="absolute backdrop-blur-[4px] bg-[rgba(0,0,0,0.8)] content-stretch flex flex-col inset-[32px_32px_537px_314.05px] items-start px-[16px] py-[8px]" data-name="Overlay+OverlayBlur">
      <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold h-[15px] justify-center leading-[0] relative shrink-0 text-[10px] text-white tracking-[1px] uppercase w-[101.95px]">
        <p className="leading-[15px]">Cam_04.Coll_A</p>
      </div>
    </div>
  );
}

function Container22() {
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

function Button() {
  return (
    <div className="absolute backdrop-blur-[4px] bg-[rgba(0,0,0,0.8)] content-stretch flex inset-[528px_80px_32px_360px] items-center justify-center p-px" data-name="Button">
      <div aria-hidden="true" className="absolute border border-[rgba(255,255,255,0.1)] border-solid inset-0 pointer-events-none" />
      <Container22 />
    </div>
  );
}

function Container23() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="Container">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="Container">
          <path d={svgPaths.p22307a00} fill="var(--fill-0, white)" id="Icon" />
        </g>
      </svg>
    </div>
  );
}

function Button1() {
  return (
    <div className="absolute backdrop-blur-[4px] bg-[rgba(0,0,0,0.8)] content-stretch flex inset-[528px_32px_32px_408px] items-center justify-center p-px" data-name="Button">
      <div aria-hidden="true" className="absolute border border-[rgba(255,255,255,0.1)] border-solid inset-0 pointer-events-none" />
      <Container23 />
    </div>
  );
}

function LivePreviewContainer() {
  return (
    <div className="bg-[#131314] content-stretch flex flex-[1_0_0] items-center justify-center max-w-[672px] min-h-px min-w-px overflow-clip relative shadow-[0px_0px_80px_0px_rgba(0,0,0,0.5)]" data-name="Live Preview Container">
      <div className="flex flex-[1_0_0] flex-row items-center self-stretch">
        <HighDetailTechnicalIllustrationOfAMinimalistHeavyweightCottonTShirtNeckDetailWithCrispRedStitchingAccentsOnAMatteBlackBackground />
      </div>
      <OverlayVerticalBorderOverlayBlur />
      <OverlayOverlayBlur />
      <Button />
      <Button1 />
    </div>
  );
}

function SectionCenterPreviewPanel() {
  return (
    <div className="bg-[#0e0e0f] flex-[1_0_0] min-h-px min-w-px relative self-stretch" data-name="Section - Center Preview Panel">
      <div className="flex flex-row items-center justify-center overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex items-center justify-center p-[48px] relative size-full">
          <div className="absolute inset-0 opacity-20" data-name="Gradient" style={{ backgroundImage: "url('data:image/svg+xml;utf8,<svg viewBox=\\'0 0 576 960\\' xmlns=\\'http://www.w3.org/2000/svg\\' preserveAspectRatio=\\'none\\'><rect x=\\'0\\' y=\\'0\\' height=\\'100%\\' width=\\'100%\\' fill=\\'url(%23grad)\\' opacity=\\'1\\'/><defs><radialGradient id=\\'grad\\' gradientUnits=\\'userSpaceOnUse\\' cx=\\'0\\' cy=\\'0\\' r=\\'10\\' gradientTransform=\\'matrix(55.977 0 0 55.977 288 480)\\'><stop stop-color=\\'rgba(255,59,48,1)\\' offset=\\'0\\'/><stop stop-color=\\'rgba(255,59,48,0)\\' offset=\\'0.7\\'/></radialGradient></defs></svg>')" }} />
          <LivePreviewContainer />
          <div className="-translate-y-1/2 absolute flex flex-col font-['Inter:Regular',sans-serif] font-normal h-[12px] justify-center leading-[0] left-[32px] not-italic text-[#47464a] text-[8px] top-[38px] tracking-[4px] uppercase w-[282.52px]">
            <p className="leading-[12px]">Ceriga_Studio_Tech_Pipeline_V1.04</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MainContentCanvas() {
  return (
    <div className="h-[1024px] min-h-[1024px] relative shrink-0 w-full" data-name="Main Content Canvas">
      <div className="content-stretch flex items-start min-h-[inherit] pr-[320px] pt-[64px] relative size-full">
        <AsideLeftSelectionPanel />
        <SectionCenterPreviewPanel />
      </div>
    </div>
  );
}

function Heading1() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Heading 2">
      <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold h-[15px] justify-center leading-[0] relative shrink-0 text-[10px] text-white tracking-[1px] uppercase w-[89.84px]">
        <p className="leading-[15px]">Specification</p>
      </div>
    </div>
  );
}

function Container24() {
  return (
    <div className="relative shrink-0 w-full" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[12px] items-center relative w-full">
        <div className="bg-[#ff3b30] rounded-[9999px] shrink-0 size-[8px]" data-name="Background" />
        <Heading1 />
      </div>
    </div>
  );
}

function Container25() {
  return (
    <div className="relative shrink-0 w-full" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative w-full">
        <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal justify-center leading-[0] not-italic relative shrink-0 text-[#a1a1a6] text-[10px] tracking-[1px] uppercase w-full">
          <p className="leading-[15px]">V1.04-Production</p>
        </div>
      </div>
    </div>
  );
}

function HorizontalBorder() {
  return (
    <div className="relative shrink-0 w-full" data-name="HorizontalBorder">
      <div aria-hidden="true" className="absolute border-[#1a1a1d] border-b border-solid inset-0 pointer-events-none" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[8px] items-start pb-[33px] pt-[32px] px-[32px] relative w-full">
        <Container24 />
        <Container25 />
      </div>
    </div>
  );
}

function Container28() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold justify-center leading-[0] relative shrink-0 text-[14px] text-white w-full">
        <p className="leading-[20px]">240GSM COTTON</p>
      </div>
    </div>
  );
}

function Container27() {
  return (
    <div className="content-stretch flex flex-col gap-[8.5px] items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold h-[15px] justify-center leading-[0] relative shrink-0 text-[#a1a1a6] text-[10px] tracking-[2px] uppercase w-[48.53px]">
        <p className="leading-[15px]">Fabric</p>
      </div>
      <Container28 />
    </div>
  );
}

function Container30() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold justify-center leading-[0] relative shrink-0 text-[#ff3b30] text-[14px] w-full">
        <p className="leading-[20px]">[ PENDING SELECTION ]</p>
      </div>
    </div>
  );
}

function Container29() {
  return (
    <div className="content-stretch flex flex-col gap-[8.5px] items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold h-[15px] justify-center leading-[0] relative shrink-0 text-[#a1a1a6] text-[10px] tracking-[2px] uppercase w-[35.89px]">
        <p className="leading-[15px]">Neck</p>
      </div>
      <Container30 />
    </div>
  );
}

function Container32() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold justify-center leading-[0] relative shrink-0 text-[14px] text-white w-full">
        <p className="leading-[20px]">OVERSIZED BLOCK</p>
      </div>
    </div>
  );
}

function Container31() {
  return (
    <div className="content-stretch flex flex-col gap-[8.5px] items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold h-[15px] justify-center leading-[0] relative shrink-0 text-[#a1a1a6] text-[10px] tracking-[2px] uppercase w-[105.75px]">
        <p className="leading-[15px]">Construction</p>
      </div>
      <Container32 />
    </div>
  );
}

function ActiveSpecs() {
  return (
    <div className="content-stretch flex flex-col gap-[24px] items-start relative shrink-0 w-full" data-name="Active Specs">
      <Container27 />
      <Container29 />
      <Container31 />
    </div>
  );
}

function Container33() {
  return (
    <div className="h-[12px] relative shrink-0 w-[20px]" data-name="Container">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 12">
        <g id="Container">
          <path d={svgPaths.p28cfa800} fill="var(--fill-0, #FF3B30)" id="Icon" />
        </g>
      </svg>
    </div>
  );
}

function Container34() {
  return (
    <div className="relative shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative">
        <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold h-[15px] justify-center leading-[0] relative shrink-0 text-[#ff3b30] text-[10px] tracking-[1px] uppercase w-[94.3px]">
          <p className="leading-[15px]">Measurements</p>
        </div>
      </div>
    </div>
  );
}

function BackgroundVerticalBorder() {
  return (
    <div className="bg-[#1a1a1d] relative shrink-0 w-full" data-name="Background+VerticalBorder">
      <div aria-hidden="true" className="absolute border-[#ff3b30] border-r-2 border-solid inset-0 pointer-events-none" />
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex gap-[16px] items-center pl-[16px] pr-[18px] py-[16px] relative w-full">
          <Container33 />
          <Container34 />
        </div>
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

function Container37() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold h-[15px] justify-center leading-[0] relative shrink-0 text-[#a1a1a6] text-[10px] tracking-[1px] uppercase w-[64.34px]">
        <p className="leading-[15px]">Materials</p>
      </div>
    </div>
  );
}

function Container35() {
  return (
    <div className="relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex gap-[16px] items-center p-[16px] relative w-full">
          <Container36 />
          <Container37 />
        </div>
      </div>
    </div>
  );
}

function Container39() {
  return (
    <div className="h-[16px] relative shrink-0 w-[22px]" data-name="Container">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 22 16">
        <g id="Container">
          <path d={svgPaths.p26835240} fill="var(--fill-0, #A1A1A6)" id="Icon" />
        </g>
      </svg>
    </div>
  );
}

function Container40() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold h-[15px] justify-center leading-[0] relative shrink-0 text-[#a1a1a6] text-[10px] tracking-[1px] uppercase w-[53.7px]">
        <p className="leading-[15px]">Costing</p>
      </div>
    </div>
  );
}

function Container38() {
  return (
    <div className="relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex gap-[16px] items-center p-[16px] relative w-full">
          <Container39 />
          <Container40 />
        </div>
      </div>
    </div>
  );
}

function Container42() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="Container">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="Container">
          <path d={svgPaths.p11741000} fill="var(--fill-0, #A1A1A6)" id="Icon" />
        </g>
      </svg>
    </div>
  );
}

function Container43() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold h-[15px] justify-center leading-[0] relative shrink-0 text-[#a1a1a6] text-[10px] tracking-[1px] uppercase w-[78.59px]">
        <p className="leading-[15px]">Production</p>
      </div>
    </div>
  );
}

function Container41() {
  return (
    <div className="relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex gap-[16px] items-center p-[16px] relative w-full">
          <Container42 />
          <Container43 />
        </div>
      </div>
    </div>
  );
}

function TabNavigationIcons() {
  return (
    <div className="content-stretch flex flex-col gap-[8px] items-start pt-[32px] relative shrink-0 w-full" data-name="Tab Navigation Icons">
      <BackgroundVerticalBorder />
      <Container35 />
      <Container38 />
      <Container41 />
    </div>
  );
}

function Container26() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative w-full" data-name="Container">
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[32px] items-start p-[32px] relative size-full">
          <ActiveSpecs />
          <TabNavigationIcons />
        </div>
      </div>
    </div>
  );
}

function Button2() {
  return (
    <div className="bg-[#1a1a1d] relative shrink-0 w-full" data-name="Button">
      <div aria-hidden="true" className="absolute border border-[#ff3b30] border-solid inset-0 pointer-events-none" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center px-px py-[17px] relative w-full">
        <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold h-[15px] justify-center leading-[0] relative shrink-0 text-[#ff3b30] text-[10px] text-center tracking-[1px] uppercase w-[84.48px]">
          <p className="leading-[15px]">Finalize Spec</p>
        </div>
      </div>
    </div>
  );
}

function OverlayHorizontalBorder() {
  return (
    <div className="bg-[rgba(0,0,0,0.5)] relative shrink-0 w-full" data-name="Overlay+HorizontalBorder">
      <div aria-hidden="true" className="absolute border-[#1a1a1d] border-solid border-t inset-0 pointer-events-none" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pb-[32px] pt-[33px] px-[32px] relative w-full">
        <Button2 />
      </div>
    </div>
  );
}

function AsideSideNavigationBarRightPanelSpecificationSummary() {
  return (
    <div className="absolute bg-[#0b0b0c] content-stretch flex flex-col h-[960px] items-start pl-px right-0 top-[64px] w-[320px]" data-name="Aside - Side Navigation Bar (Right Panel: Specification Summary)">
      <div aria-hidden="true" className="absolute border-[#1a1a1d] border-l border-solid inset-0 pointer-events-none" />
      <HorizontalBorder />
      <Container26 />
      <OverlayHorizontalBorder />
    </div>
  );
}

function Container44() {
  return (
    <div className="relative shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative">
        <div className="flex flex-col font-['Plus_Jakarta_Sans:ExtraBold',sans-serif] font-extrabold h-[28px] justify-center leading-[0] relative shrink-0 text-[20px] text-white tracking-[2px] uppercase w-[181.48px]">
          <p className="leading-[28px]">Ceriga Engine</p>
        </div>
      </div>
    </div>
  );
}

function Link() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Link">
      <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold h-[15px] justify-center leading-[0] relative shrink-0 text-[#a1a1a6] text-[10px] tracking-[1px] uppercase w-[28.45px]">
        <p className="leading-[15px]">Type</p>
      </div>
    </div>
  );
}

function Link1() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Link">
      <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold h-[15px] justify-center leading-[0] relative shrink-0 text-[#a1a1a6] text-[10px] tracking-[1px] uppercase w-[17.08px]">
        <p className="leading-[15px]">Fit</p>
      </div>
    </div>
  );
}

function Link2() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Link">
      <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold h-[15px] justify-center leading-[0] relative shrink-0 text-[#a1a1a6] text-[10px] tracking-[1px] uppercase w-[42.53px]">
        <p className="leading-[15px]">Fabric</p>
      </div>
    </div>
  );
}

function Link3() {
  return (
    <div className="content-stretch flex flex-col items-start pb-[6px] relative shrink-0" data-name="Link">
      <div aria-hidden="true" className="absolute border-[#ff3b30] border-b-2 border-solid inset-0 pointer-events-none" />
      <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold h-[15px] justify-center leading-[0] relative shrink-0 text-[#ff3b30] text-[10px] tracking-[1px] uppercase w-[31.89px]">
        <p className="leading-[15px]">Neck</p>
      </div>
    </div>
  );
}

function Link4() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Link">
      <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold h-[15px] justify-center leading-[0] relative shrink-0 text-[#a1a1a6] text-[10px] tracking-[1px] uppercase w-[50.2px]">
        <p className="leading-[15px]">Sleeves</p>
      </div>
    </div>
  );
}

function Link5() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Link">
      <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold h-[15px] justify-center leading-[0] relative shrink-0 text-[#a1a1a6] text-[10px] tracking-[1px] uppercase w-[25.22px]">
        <p className="leading-[15px]">Hem</p>
      </div>
    </div>
  );
}

function Link6() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Link">
      <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold h-[15px] justify-center leading-[0] relative shrink-0 text-[#a1a1a6] text-[10px] tracking-[1px] uppercase w-[54.64px]">
        <p className="leading-[15px]">Pockets</p>
      </div>
    </div>
  );
}

function Link7() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Link">
      <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold h-[15px] justify-center leading-[0] relative shrink-0 text-[#a1a1a6] text-[10px] tracking-[1px] uppercase w-[44.48px]">
        <p className="leading-[15px]">Review</p>
      </div>
    </div>
  );
}

function Container45() {
  return (
    <div className="relative shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[24px] items-center relative">
        <Link />
        <Link1 />
        <Link2 />
        <Link3 />
        <Link4 />
        <Link5 />
        <Link6 />
        <Link7 />
      </div>
    </div>
  );
}

function Button3() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="Button">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="Button">
          <path d={svgPaths.p2816f2c0} fill="var(--fill-0, #A1A1A6)" id="Icon" />
        </g>
      </svg>
    </div>
  );
}

function Button4() {
  return (
    <div className="h-[20px] relative shrink-0 w-[20.1px]" data-name="Button">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20.1 20">
        <g id="Button">
          <path d={svgPaths.p3cdadd00} fill="var(--fill-0, #A1A1A6)" id="Icon" />
        </g>
      </svg>
    </div>
  );
}

function Button5() {
  return (
    <div className="bg-[#ff3b30] content-stretch flex flex-col items-center justify-center px-[24px] py-[8px] relative shrink-0" data-name="Button">
      <div className="flex flex-col font-['Plus_Jakarta_Sans:Bold',sans-serif] font-bold h-[15px] justify-center leading-[0] relative shrink-0 text-[#5c0002] text-[10px] text-center tracking-[1px] uppercase w-[70.19px]">
        <p className="leading-[15px]">Save Draft</p>
      </div>
    </div>
  );
}

function Container46() {
  return (
    <div className="relative shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[16px] items-center relative">
        <Button3 />
        <Button4 />
        <Button5 />
      </div>
    </div>
  );
}

function TopNavigationBar() {
  return (
    <div className="absolute backdrop-blur-[6px] bg-[rgba(11,11,12,0.8)] content-stretch flex h-[64px] items-center justify-between left-0 pb-px pl-[32px] pr-[32.01px] top-0 w-[1280px]" data-name="Top Navigation Bar">
      <div aria-hidden="true" className="absolute border-[#1a1a1d] border-b border-solid inset-0 pointer-events-none" />
      <Container44 />
      <Container45 />
      <Container46 />
    </div>
  );
}

function Container47() {
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

function Link8() {
  return (
    <div className="content-stretch flex flex-col items-start relative self-stretch shrink-0" data-name="Link">
      <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#a1a1a6] text-[10px] tracking-[1px] uppercase w-[111.13px]">
        <p className="leading-[15px]">Terms of Service</p>
      </div>
    </div>
  );
}

function Link9() {
  return (
    <div className="content-stretch flex flex-col items-start relative self-stretch shrink-0" data-name="Link">
      <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#a1a1a6] text-[10px] tracking-[1px] uppercase w-[125.72px]">
        <p className="leading-[15px]">Factory Standards</p>
      </div>
    </div>
  );
}

function Link10() {
  return (
    <div className="content-stretch flex flex-col items-start relative self-stretch shrink-0" data-name="Link">
      <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#a1a1a6] text-[10px] tracking-[1px] uppercase w-[54.17px]">
        <p className="leading-[15px]">Support</p>
      </div>
    </div>
  );
}

function Container48() {
  return (
    <div className="h-[15px] relative shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[32px] h-full items-start relative">
        <Link8 />
        <Link9 />
        <Link10 />
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div className="absolute backdrop-blur-[2px] bg-[rgba(0,0,0,0.9)] bottom-0 content-stretch flex items-center justify-between left-0 pb-[16px] pt-[17px] px-[32px] w-[1280px]" data-name="Footer">
      <div aria-hidden="true" className="absolute border-[#1a1a1d] border-solid border-t inset-0 pointer-events-none" />
      <Container47 />
      <Container48 />
    </div>
  );
}

export default function NeckCollarConfiguration() {
  return (
    <div className="bg-[#131314] content-stretch flex flex-col items-start relative size-full" data-name="Neck & Collar Configuration">
      <MainContentCanvas />
      <AsideSideNavigationBarRightPanelSpecificationSummary />
      <TopNavigationBar />
      <Footer />
    </div>
  );
}