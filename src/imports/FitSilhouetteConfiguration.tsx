import svgPaths from "./svg-amotr0ktvt";
import imgAb6AXuARlVqWcw0NUpGwVProj4Z7M98Kz6M3EYwLdrbfGvijFsawf3Q41Q1Wk9KK17YKOlApRxyubi3XYseoUiH8AyOelEh6Mubxzt2N9D92DYMbQttDwEkhG6GNf433OQpRNhbrKtBmR1NW1D7B6QC9FgLNlsSius4PyaTo7CtobDuRjAr9LeOaqyYbGfoAgbaI13VijkPp0AwK14O0Ga2NPdYCuaTUkEmYbDEysEeAbHjrSfNggNrrBq9PB1LpdHws48328Ih from "figma:asset/dc7e1b87af9925dbdfe84b6e7684a31665bfa932.png";

function Heading() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Heading 1">
      <div className="flex flex-col font-['Liberation_Serif:Bold',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[24px] text-white tracking-[-1.2px] uppercase w-full">
        <p className="leading-[32px]">{`Fit & Silhouette`}</p>
      </div>
    </div>
  );
}

function Container() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal justify-center leading-[0] not-italic relative shrink-0 text-[#e7bdb7] text-[10px] tracking-[1px] uppercase w-full">
        <p className="leading-[15px]">Configuration Step 02</p>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0 w-full" data-name="Header">
      <Heading />
      <Container />
    </div>
  );
}

function HeaderMargin() {
  return (
    <div className="relative shrink-0 w-full" data-name="Header:margin">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pb-[40px] relative w-full">
        <Header />
      </div>
    </div>
  );
}

function Label() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Label">
      <div className="flex flex-col font-['Liberation_Serif:Bold',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#ff3b30] text-[10px] tracking-[2px] uppercase w-full">
        <p className="leading-[15px]">Select Profile</p>
      </div>
    </div>
  );
}

function Container2() {
  return (
    <div className="relative shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-center relative">
        <div className="flex flex-col font-['Inter:Semi_Bold',sans-serif] font-semibold h-[16px] justify-center leading-[0] not-italic relative shrink-0 text-[#e5e2e3] text-[12px] text-center tracking-[1.2px] uppercase w-[33.78px]">
          <p className="leading-[16px]">Slim</p>
        </div>
      </div>
    </div>
  );
}

function Container3() {
  return (
    <div className="relative shrink-0 size-[11.667px]" data-name="Container">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 11.6667 11.6667">
        <g id="Container">
          <path d={svgPaths.p24dc5920} fill="var(--fill-0, #E7BDB7)" id="Icon" />
        </g>
      </svg>
    </div>
  );
}

function Button() {
  return (
    <div className="col-1 content-stretch flex items-center justify-between justify-self-start p-[17px] relative rounded-[4px] row-1 self-start shrink-0" data-name="Button">
      <div aria-hidden="true" className="absolute border border-[#1a1a1d] border-solid inset-0 pointer-events-none rounded-[4px]" />
      <Container2 />
      <Container3 />
    </div>
  );
}

function Container4() {
  return (
    <div className="relative shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-center relative">
        <div className="flex flex-col font-['Inter:Semi_Bold',sans-serif] font-semibold h-[16px] justify-center leading-[0] not-italic relative shrink-0 text-[12px] text-center text-white tracking-[1.2px] uppercase w-[64.66px]">
          <p className="leading-[16px]">Regular</p>
        </div>
      </div>
    </div>
  );
}

function Container5() {
  return (
    <div className="relative shrink-0 size-[11.667px]" data-name="Container">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 11.6667 11.6667">
        <g id="Container">
          <path d={svgPaths.p3cf2be00} fill="var(--fill-0, #FF3B30)" id="Icon" />
        </g>
      </svg>
    </div>
  );
}

function Button1() {
  return (
    <div className="bg-[#1a1a1d] col-1 content-stretch flex items-center justify-between justify-self-start p-[17px] relative rounded-[4px] row-2 self-start shrink-0" data-name="Button">
      <div aria-hidden="true" className="absolute border border-[#ff3b30] border-solid inset-0 pointer-events-none rounded-[4px]" />
      <Container4 />
      <Container5 />
    </div>
  );
}

function Container6() {
  return (
    <div className="relative shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-center relative">
        <div className="flex flex-col font-['Inter:Semi_Bold',sans-serif] font-semibold h-[16px] justify-center leading-[0] not-italic relative shrink-0 text-[#e5e2e3] text-[12px] text-center tracking-[1.2px] uppercase w-[63.58px]">
          <p className="leading-[16px]">Relaxed</p>
        </div>
      </div>
    </div>
  );
}

function Container7() {
  return (
    <div className="relative shrink-0 size-[11.667px]" data-name="Container">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 11.6667 11.6667">
        <g id="Container">
          <path d={svgPaths.p24dc5920} fill="var(--fill-0, #E7BDB7)" id="Icon" />
        </g>
      </svg>
    </div>
  );
}

function Button2() {
  return (
    <div className="col-1 content-stretch flex items-center justify-between justify-self-start p-[17px] relative rounded-[4px] row-3 self-start shrink-0" data-name="Button">
      <div aria-hidden="true" className="absolute border border-[#1a1a1d] border-solid inset-0 pointer-events-none rounded-[4px]" />
      <Container6 />
      <Container7 />
    </div>
  );
}

function Container8() {
  return (
    <div className="relative shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-center relative">
        <div className="flex flex-col font-['Inter:Semi_Bold',sans-serif] font-semibold h-[16px] justify-center leading-[0] not-italic relative shrink-0 text-[#e5e2e3] text-[12px] text-center tracking-[1.2px] uppercase w-[78.28px]">
          <p className="leading-[16px]">Oversized</p>
        </div>
      </div>
    </div>
  );
}

function Container9() {
  return (
    <div className="relative shrink-0 size-[11.667px]" data-name="Container">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 11.6667 11.6667">
        <g id="Container">
          <path d={svgPaths.p24dc5920} fill="var(--fill-0, #E7BDB7)" id="Icon" />
        </g>
      </svg>
    </div>
  );
}

function Button3() {
  return (
    <div className="col-1 content-stretch flex items-center justify-between justify-self-start p-[17px] relative rounded-[4px] row-4 self-start shrink-0" data-name="Button">
      <div aria-hidden="true" className="absolute border border-[#1a1a1d] border-solid inset-0 pointer-events-none rounded-[4px]" />
      <Container8 />
      <Container9 />
    </div>
  );
}

function Container10() {
  return (
    <div className="relative shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-center relative">
        <div className="flex flex-col font-['Inter:Semi_Bold',sans-serif] font-semibold h-[16px] justify-center leading-[0] not-italic relative shrink-0 text-[#e5e2e3] text-[12px] text-center tracking-[1.2px] uppercase w-[38.58px]">
          <p className="leading-[16px]">Boxy</p>
        </div>
      </div>
    </div>
  );
}

function Container11() {
  return (
    <div className="relative shrink-0 size-[11.667px]" data-name="Container">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 11.6667 11.6667">
        <g id="Container">
          <path d={svgPaths.p24dc5920} fill="var(--fill-0, #E7BDB7)" id="Icon" />
        </g>
      </svg>
    </div>
  );
}

function Button4() {
  return (
    <div className="col-1 content-stretch flex items-center justify-between justify-self-start p-[17px] relative rounded-[4px] row-5 self-start shrink-0" data-name="Button">
      <div aria-hidden="true" className="absolute border border-[#1a1a1d] border-solid inset-0 pointer-events-none rounded-[4px]" />
      <Container10 />
      <Container11 />
    </div>
  );
}

function Container1() {
  return (
    <div className="gap-x-[8px] gap-y-[8px] grid grid-cols-[repeat(1,minmax(0,1fr))] grid-rows-[_____54px_54px_54px_54px_54px] relative shrink-0 w-full" data-name="Container">
      <Button />
      <Button1 />
      <Button2 />
      <Button3 />
      <Button4 />
    </div>
  );
}

function Section() {
  return (
    <div className="content-stretch flex flex-col gap-[16px] items-start relative shrink-0 w-full" data-name="Section">
      <Label />
      <Container1 />
    </div>
  );
}

function Label1() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Label">
      <div className="flex flex-col font-['Liberation_Serif:Bold',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#ff3b30] text-[10px] tracking-[2px] uppercase w-full">
        <p className="leading-[15px]">Size Range</p>
      </div>
    </div>
  );
}

function Container13() {
  return (
    <div className="absolute content-stretch flex flex-col items-start left-[16px] overflow-clip right-[31px] top-[17px]" data-name="Container">
      <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[14px] text-[rgba(231,189,183,0.3)] w-[161.23px]">
        <p className="leading-[normal]">Enter sizing (e.g. 28-42)</p>
      </div>
    </div>
  );
}

function Container15() {
  return <div className="flex-[1_0_0] h-[20px] min-h-px min-w-px" data-name="Container" />;
}

function RectangleAlignStretch() {
  return (
    <div className="content-stretch flex h-full items-start relative shrink-0" data-name="Rectangle:align-stretch">
      <div className="h-full min-w-[15px] opacity-0 shrink-0 w-[15px]" data-name="Rectangle" />
    </div>
  );
}

function Container14() {
  return (
    <div className="absolute content-stretch flex items-center left-[16px] right-[16px] top-[16px]" data-name="Container">
      <Container15 />
      <div className="flex flex-row items-center self-stretch">
        <RectangleAlignStretch />
      </div>
    </div>
  );
}

function Input() {
  return (
    <div className="bg-[#2a2a2b] h-[52px] overflow-clip relative rounded-[4px] shrink-0 w-full" data-name="Input">
      <Container13 />
      <Container14 />
    </div>
  );
}

function Container12() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <Input />
      <div className="absolute bottom-[35.58%] flex flex-col font-['Inter:Regular',sans-serif] font-normal justify-center leading-[0] not-italic right-[44.97px] text-[#e7bdb7] text-[10px] top-[35.58%] tracking-[1px] translate-x-full uppercase w-[28.97px]">
        <p className="leading-[15px]">INCH</p>
      </div>
    </div>
  );
}

function Container16() {
  return (
    <div className="relative shrink-0 w-full" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative w-full">
        <div className="flex flex-col font-['Inter:Italic',sans-serif] font-normal italic justify-center leading-[0] relative shrink-0 text-[#e7bdb7] text-[10px] w-full">
          <p className="leading-[16.25px] mb-0">Machine learning will adjust pattern gradients</p>
          <p className="leading-[16.25px] mb-0">based on the selected regular fit profile and</p>
          <p className="leading-[16.25px]">specified size range.</p>
        </div>
      </div>
    </div>
  );
}

function OverlayBorder() {
  return (
    <div className="bg-[rgba(255,59,48,0.05)] relative rounded-[4px] shrink-0 w-full" data-name="Overlay+Border">
      <div aria-hidden="true" className="absolute border border-[rgba(255,59,48,0.1)] border-solid inset-0 pointer-events-none rounded-[4px]" />
      <div className="content-stretch flex flex-col items-start p-[17px] relative w-full">
        <Container16 />
      </div>
    </div>
  );
}

function Section1() {
  return (
    <div className="content-stretch flex flex-col gap-[16px] items-start relative shrink-0 w-full" data-name="Section">
      <Label1 />
      <Container12 />
      <OverlayBorder />
    </div>
  );
}

function SelectionChips() {
  return (
    <div className="relative shrink-0 w-full" data-name="Selection Chips">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[32px] items-start relative w-full">
        <Section />
        <Section1 />
      </div>
    </div>
  );
}

function LeftSelectionPanel() {
  return (
    <div className="bg-[#0e0e0f] h-full relative shrink-0 w-[320px]" data-name="Left Selection Panel">
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col items-start pl-[32px] pr-[33px] py-[32px] relative size-full">
          <HeaderMargin />
          <SelectionChips />
        </div>
      </div>
      <div aria-hidden="true" className="absolute border-[#1a1a1d] border-r border-solid inset-0 pointer-events-none" />
    </div>
  );
}

function Ab6AXuARlVqWcw0NUpGwVProj4Z7M98Kz6M3EYwLdrbfGvijFsawf3Q41Q1Wk9KK17YKOlApRxyubi3XYseoUiH8AyOelEh6Mubxzt2N9D92DYMbQttDwEkhG6GNf433OQpRNhbrKtBmR1NW1D7B6QC9FgLNlsSius4PyaTo7CtobDuRjAr9LeOaqyYbGfoAgbaI13VijkPp0AwK14O0Ga2NPdYCuaTUkEmYbDEysEeAbHjrSfNggNrrBq9PB1LpdHws48328Ih() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative shadow-[0px_0px_30px_0px_rgba(255,59,48,0.15)] w-full" data-name="AB6AXuARlVqWcw0nUpGW-VProj4z7M98Kz6m3eYWLdrbfGvijFSAWF3q41q1Wk9kK17y_kOlApRXYUBI3_XYseoUiH8ayOELEh6mubxzt2N_9d92D_yMbQttDWEkhG6gNF433oQpRNhbrKT-bmR1nW1D7b6qC9FgLNlsSius4pyaTo7CtobDURjAR9LEOaqyYBGfoAgbaI13VIJKPp0AwK14o0GA2NPdYCuaT_ukEmYbDEysEe-abHjrSFNggNrrBQ9p-B1LpdHWS48328Ih">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <img alt="" className="absolute h-[66.42%] left-0 max-w-none top-[16.79%] w-full" src={imgAb6AXuARlVqWcw0NUpGwVProj4Z7M98Kz6M3EYwLdrbfGvijFsawf3Q41Q1Wk9KK17YKOlApRxyubi3XYseoUiH8AyOelEh6Mubxzt2N9D92DYMbQttDwEkhG6GNf433OQpRNhbrKtBmR1NW1D7B6QC9FgLNlsSius4PyaTo7CtobDuRjAr9LeOaqyYbGfoAgbaI13VijkPp0AwK14O0Ga2NPdYCuaTUkEmYbDEysEeAbHjrSfNggNrrBq9PB1LpdHws48328Ih} />
      </div>
    </div>
  );
}

function Container17() {
  return (
    <div className="content-stretch flex flex-col h-[819px] items-start justify-center max-h-[819px] max-w-[896px] relative shrink-0 w-full" data-name="Container">
      <div className="absolute left-[-16px] size-[32px] top-[-16px]" data-name="Corner Brackets">
        <div aria-hidden="true" className="absolute border-[rgba(255,59,48,0.3)] border-l-2 border-solid border-t-2 inset-0 pointer-events-none" />
      </div>
      <div className="absolute right-[-16px] size-[32px] top-[-16px]" data-name="Border">
        <div aria-hidden="true" className="absolute border-[rgba(255,59,48,0.3)] border-r-2 border-solid border-t-2 inset-0 pointer-events-none" />
      </div>
      <div className="absolute bottom-[-16px] left-[-16px] size-[32px]" data-name="Border">
        <div aria-hidden="true" className="absolute border-[rgba(255,59,48,0.3)] border-b-2 border-l-2 border-solid inset-0 pointer-events-none" />
      </div>
      <div className="absolute bottom-[-16px] right-[-16px] size-[32px]" data-name="Border">
        <div aria-hidden="true" className="absolute border-[rgba(255,59,48,0.3)] border-b-2 border-r-2 border-solid inset-0 pointer-events-none" />
      </div>
      <Ab6AXuARlVqWcw0NUpGwVProj4Z7M98Kz6M3EYwLdrbfGvijFsawf3Q41Q1Wk9KK17YKOlApRxyubi3XYseoUiH8AyOelEh6Mubxzt2N9D92DYMbQttDwEkhG6GNf433OQpRNhbrKtBmR1NW1D7B6QC9FgLNlsSius4PyaTo7CtobDuRjAr9LeOaqyYbGfoAgbaI13VijkPp0AwK14O0Ga2NPdYCuaTUkEmYbDEysEeAbHjrSfNggNrrBq9PB1LpdHws48328Ih />
      <div className="-translate-y-1/2 absolute flex flex-col font-['Liberation_Serif:Regular',sans-serif] h-[15px] justify-center leading-[0] left-[32px] not-italic text-[#ff3b30] text-[10px] top-[39.5px] tracking-[1px] uppercase w-[110.19px]">
        <p className="leading-[15px]">Precision Render</p>
      </div>
      <div className="-translate-y-1/2 absolute flex flex-col font-['Inter:Regular',sans-serif] font-normal h-[16px] justify-center leading-[0] left-[32px] not-italic text-[12px] text-[rgba(255,255,255,0.5)] top-[59px] tracking-[-0.6px] w-[122.31px]">
        <p className="leading-[16px]">SIM_MODE: ACTIVE_04</p>
      </div>
      <div className="absolute bottom-[59.5px] flex flex-col font-['Liberation_Serif:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic right-[164.8px] text-[#ff3b30] text-[10px] tracking-[1px] translate-x-full translate-y-1/2 uppercase w-[132.8px]">
        <p className="leading-[15px]">Silhouette Variance</p>
      </div>
      <div className="absolute bottom-[40px] flex flex-col font-['Inter:Regular',sans-serif] font-normal h-[16px] justify-center leading-[0] not-italic right-[125.77px] text-[12px] text-[rgba(255,255,255,0.5)] tracking-[-0.6px] translate-x-full translate-y-1/2 w-[93.77px]">
        <p className="leading-[16px]">± 2.5MM MARGIN</p>
      </div>
    </div>
  );
}

function Button5() {
  return (
    <div className="relative shrink-0 size-[34px]" data-name="Button">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 34 34">
        <g id="Button">
          <path d={svgPaths.p3c7b3700} fill="var(--fill-0, white)" id="Icon" />
        </g>
      </svg>
    </div>
  );
}

function Margin() {
  return (
    <div className="h-[16px] relative shrink-0 w-[17px]" data-name="Margin">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start px-[8px] relative size-full">
        <div className="bg-[rgba(255,255,255,0.2)] h-[16px] shrink-0 w-px" data-name="Vertical Divider" />
      </div>
    </div>
  );
}

function Button6() {
  return (
    <div className="relative shrink-0 size-[36px]" data-name="Button">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 36 36">
        <g id="Button">
          <path d={svgPaths.p3d36be00} fill="var(--fill-0, white)" id="Icon" />
        </g>
      </svg>
    </div>
  );
}

function Margin1() {
  return (
    <div className="h-[16px] relative shrink-0 w-[17px]" data-name="Margin">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start px-[8px] relative size-full">
        <div className="bg-[rgba(255,255,255,0.2)] h-[16px] shrink-0 w-px" data-name="Vertical Divider" />
      </div>
    </div>
  );
}

function Button7() {
  return (
    <div className="h-[35.05px] relative shrink-0 w-[34px]" data-name="Button">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 34 35.05">
        <g id="Button">
          <path d={svgPaths.p20ba8da0} fill="var(--fill-0, white)" id="Icon" />
        </g>
      </svg>
    </div>
  );
}

function Margin2() {
  return (
    <div className="h-[16px] relative shrink-0 w-[17px]" data-name="Margin">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start px-[8px] relative size-full">
        <div className="bg-[rgba(255,255,255,0.2)] h-[16px] shrink-0 w-px" data-name="Vertical Divider" />
      </div>
    </div>
  );
}

function Button8() {
  return (
    <div className="h-[34px] relative shrink-0 w-[36px]" data-name="Button">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 36 34">
        <g id="Button">
          <path d={svgPaths.p5b4af20} fill="var(--fill-0, white)" id="Icon" />
        </g>
      </svg>
    </div>
  );
}

function ToolbarOverlay() {
  return (
    <div className="absolute backdrop-blur-[12px] bg-[rgba(0,0,0,0.6)] bottom-[32px] content-stretch flex gap-[8px] items-center left-[25.85%] px-[25px] py-[13px] right-[25.85%] rounded-[9999px]" data-name="Toolbar Overlay">
      <div aria-hidden="true" className="absolute border border-[rgba(255,255,255,0.1)] border-solid inset-0 pointer-events-none rounded-[9999px]" />
      <Button5 />
      <Margin />
      <Button6 />
      <Margin1 />
      <Button7 />
      <Margin2 />
      <Button8 />
    </div>
  );
}

function CenterPreviewArea() {
  return (
    <div className="bg-[#0e0e0f] flex-[1_0_0] h-full min-h-px min-w-px relative" data-name="Center Preview Area">
      <div className="flex flex-col justify-center overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col items-start justify-center px-[48px] relative size-full">
          <div className="absolute inset-0 opacity-3" data-name="Background Decorative Grid" style={{ backgroundImage: "url('data:image/svg+xml;utf8,<svg viewBox=\\'0 0 640 920\\' xmlns=\\'http://www.w3.org/2000/svg\\' preserveAspectRatio=\\'none\\'><rect x=\\'0\\' y=\\'0\\' height=\\'100%\\' width=\\'100%\\' fill=\\'url(%23grad)\\' opacity=\\'1\\'/><defs><radialGradient id=\\'grad\\' gradientUnits=\\'userSpaceOnUse\\' cx=\\'0\\' cy=\\'0\\' r=\\'10\\' gradientTransform=\\'matrix(45.255 0 0 65.054 320 460)\\'><stop stop-color=\\'rgba(255,59,48,1)\\' offset=\\'0.029463\\'/><stop stop-color=\\'rgba(255,59,48,0)\\' offset=\\'0.029463\\'/></radialGradient></defs></svg>')" }} />
          <Container17 />
          <ToolbarOverlay />
        </div>
      </div>
    </div>
  );
}

function MainContentCanvas() {
  return (
    <div className="absolute content-stretch flex inset-[64px_320px_40px_0] items-start overflow-clip" data-name="Main Content Canvas">
      <LeftSelectionPanel />
      <CenterPreviewArea />
    </div>
  );
}

function Container19() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Serif:Bold',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[14px] text-white tracking-[1.4px] w-full">
        <p className="leading-[20px]">SPECIFICATION</p>
      </div>
    </div>
  );
}

function Container20() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Serif:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#e7bdb7] text-[10px] tracking-[1px] uppercase w-full">
        <p className="leading-[15px]">V1.04-PRODUCTION</p>
      </div>
    </div>
  );
}

function Container18() {
  return (
    <div className="relative shrink-0 w-full" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[4px] items-start relative w-full">
        <Container19 />
        <Container20 />
      </div>
    </div>
  );
}

function HorizontalBorder() {
  return (
    <div className="relative shrink-0 w-full" data-name="HorizontalBorder">
      <div aria-hidden="true" className="absolute border-[#1a1a1d] border-b border-solid inset-0 pointer-events-none" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pb-[25px] pt-[24px] px-[24px] relative w-full">
        <Container18 />
      </div>
    </div>
  );
}

function Heading1() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Heading 3">
      <div className="flex flex-col font-['Liberation_Serif:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#ff3b30] text-[10px] tracking-[1px] uppercase w-full">
        <p className="leading-[15px]">Summary Configuration</p>
      </div>
    </div>
  );
}

function Container25() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#e7bdb7] text-[10px] tracking-[1px] uppercase w-[90.27px]">
        <p className="leading-[15px]">Garment Type</p>
      </div>
    </div>
  );
}

function Container26() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Inter:Semi_Bold',sans-serif] font-semibold h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-white tracking-[-0.275px] w-[42.66px]">
        <p className="leading-[16.5px]">T-SHIRT</p>
      </div>
    </div>
  );
}

function Container24() {
  return (
    <div className="relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center size-full">
        <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-between relative w-full">
          <Container25 />
          <Container26 />
        </div>
      </div>
    </div>
  );
}

function Container28() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#e7bdb7] text-[10px] tracking-[1px] uppercase w-[80.94px]">
        <p className="leading-[15px]">Selected Fit</p>
      </div>
    </div>
  );
}

function Container29() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Inter:Semi_Bold',sans-serif] font-semibold h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[#ff3b30] text-[11px] tracking-[-0.275px] w-[117.63px]">
        <p className="leading-[16.5px]">[PENDING SELECTION]</p>
      </div>
    </div>
  );
}

function Container27() {
  return (
    <div className="relative shrink-0 w-full" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-between relative w-full">
        <Container28 />
        <Container29 />
      </div>
    </div>
  );
}

function BackgroundBorder() {
  return (
    <div className="bg-[#141416] relative rounded-[4px] shrink-0 w-full" data-name="Background+Border">
      <div aria-hidden="true" className="absolute border border-[rgba(255,255,255,0.05)] border-solid inset-0 pointer-events-none rounded-[4px]" />
      <div className="content-stretch flex flex-col gap-[12px] items-start p-[17px] relative w-full">
        <Container24 />
        <Container27 />
      </div>
    </div>
  );
}

function Container23() {
  return (
    <div className="content-stretch flex flex-col gap-[16px] items-start relative shrink-0 w-full" data-name="Container">
      <Heading1 />
      <BackgroundBorder />
    </div>
  );
}

function Container31() {
  return (
    <div className="relative shrink-0 size-[13.5px]" data-name="Container">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 13.5 13.5">
        <g id="Container">
          <path d={svgPaths.p19b00c10} fill="var(--fill-0, #A1A1A6)" id="Icon" />
        </g>
      </svg>
    </div>
  );
}

function Container32() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Serif:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#a1a1a6] text-[10px] tracking-[1px] uppercase w-[60.53px]">
        <p className="leading-[15px]">Overview</p>
      </div>
    </div>
  );
}

function Container30() {
  return (
    <div className="relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex gap-[16px] items-center p-[12px] relative w-full">
          <Container31 />
          <Container32 />
        </div>
      </div>
    </div>
  );
}

function Container33() {
  return (
    <div className="h-[13.5px] relative shrink-0 w-[13.519px]" data-name="Container">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 13.5188 13.5">
        <g id="Container">
          <path d={svgPaths.p26b4a580} fill="var(--fill-0, #FF3B30)" id="Icon" />
        </g>
      </svg>
    </div>
  );
}

function Container34() {
  return (
    <div className="relative shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative">
        <div className="flex flex-col font-['Liberation_Serif:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#ff3b30] text-[10px] tracking-[1px] uppercase w-[65.13px]">
          <p className="leading-[15px]">Materials</p>
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
        <div className="content-stretch flex gap-[16px] items-center pl-[12px] pr-[14px] py-[12px] relative w-full">
          <Container33 />
          <Container34 />
        </div>
      </div>
    </div>
  );
}

function Container36() {
  return (
    <div className="h-[9px] relative shrink-0 w-[15px]" data-name="Container">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 15 9">
        <g id="Container">
          <path d={svgPaths.p2de0f300} fill="var(--fill-0, #A1A1A6)" id="Icon" />
        </g>
      </svg>
    </div>
  );
}

function Container37() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Serif:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#a1a1a6] text-[10px] tracking-[1px] uppercase w-[93.69px]">
        <p className="leading-[15px]">Measurements</p>
      </div>
    </div>
  );
}

function Container35() {
  return (
    <div className="relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex gap-[16px] items-center p-[12px] relative w-full">
          <Container36 />
          <Container37 />
        </div>
      </div>
    </div>
  );
}

function Container39() {
  return (
    <div className="h-[12px] relative shrink-0 w-[16.5px]" data-name="Container">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16.5 12">
        <g id="Container">
          <path d={svgPaths.p25ac7380} fill="var(--fill-0, #A1A1A6)" id="Icon" />
        </g>
      </svg>
    </div>
  );
}

function Container40() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Serif:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#a1a1a6] text-[10px] tracking-[1px] uppercase w-[50.34px]">
        <p className="leading-[15px]">Costing</p>
      </div>
    </div>
  );
}

function Container38() {
  return (
    <div className="relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex gap-[16px] items-center p-[12px] relative w-full">
          <Container39 />
          <Container40 />
        </div>
      </div>
    </div>
  );
}

function Container42() {
  return (
    <div className="relative shrink-0 size-[15px]" data-name="Container">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 15 15">
        <g id="Container">
          <path d={svgPaths.p803aa00} fill="var(--fill-0, #A1A1A6)" id="Icon" />
        </g>
      </svg>
    </div>
  );
}

function Container43() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Serif:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#a1a1a6] text-[10px] tracking-[1px] uppercase w-[43.8px]">
        <p className="leading-[15px]">Submit</p>
      </div>
    </div>
  );
}

function Container41() {
  return (
    <div className="relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex gap-[16px] items-center p-[12px] relative w-full">
          <Container42 />
          <Container43 />
        </div>
      </div>
    </div>
  );
}

function Nav() {
  return (
    <div className="content-stretch flex flex-col gap-[4px] items-start relative shrink-0 w-full" data-name="Nav">
      <Container30 />
      <BackgroundVerticalBorder />
      <Container35 />
      <Container38 />
      <Container41 />
    </div>
  );
}

function Container22() {
  return (
    <div className="content-stretch flex flex-col gap-[32px] items-start relative shrink-0 w-full" data-name="Container">
      <Container23 />
      <Nav />
    </div>
  );
}

function Container21() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative w-full" data-name="Container">
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start px-[24px] py-[32px] relative size-full">
          <Container22 />
        </div>
      </div>
    </div>
  );
}

function Button9() {
  return (
    <div className="bg-[#1a1a1d] content-stretch flex items-center justify-center px-px py-[17px] relative shrink-0 w-full" data-name="Button">
      <div aria-hidden="true" className="absolute border border-[rgba(255,59,48,0.2)] border-solid inset-0 pointer-events-none" />
      <div className="flex flex-col font-['Liberation_Serif:Bold',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#ff3b30] text-[10px] text-center tracking-[2px] uppercase w-[102.41px]">
        <p className="leading-[15px]">Finalize Spec</p>
      </div>
    </div>
  );
}

function Container44() {
  return (
    <div className="relative shrink-0 w-full" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start p-[24px] relative w-full">
        <Button9 />
      </div>
    </div>
  );
}

function AsideSideNavBarRightPanel() {
  return (
    <div className="absolute bg-[#0b0b0c] content-stretch flex flex-col h-[960px] items-start justify-between pl-px right-0 top-[64px] w-[320px]" data-name="Aside - SideNavBar (Right Panel)">
      <div aria-hidden="true" className="absolute border-[#1a1a1d] border-l border-solid inset-0 pointer-events-none" />
      <HorizontalBorder />
      <Container21 />
      <Container44 />
    </div>
  );
}

function Container46() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Serif:Bold',sans-serif] h-[28px] justify-center leading-[0] not-italic relative shrink-0 text-[20px] text-white tracking-[2px] w-[188.81px]">
        <p className="leading-[28px]">CERIGA STUDIO</p>
      </div>
    </div>
  );
}

function Link() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Link">
      <div className="flex flex-col font-['Liberation_Serif:Bold',sans-serif] h-[18px] justify-center leading-[0] not-italic relative shrink-0 text-[#a1a1a6] text-[12px] tracking-[-0.6px] uppercase w-[29.61px]">
        <p className="leading-[18px]">Type</p>
      </div>
    </div>
  );
}

function Link1() {
  return (
    <div className="content-stretch flex flex-col items-start pb-[6px] relative shrink-0" data-name="Link">
      <div aria-hidden="true" className="absolute border-[#ff3b30] border-b-2 border-solid inset-0 pointer-events-none" />
      <div className="flex flex-col font-['Liberation_Serif:Bold',sans-serif] h-[18px] justify-center leading-[0] not-italic relative shrink-0 text-[#ff3b30] text-[12px] tracking-[-0.6px] uppercase w-[18.22px]">
        <p className="leading-[18px]">Fit</p>
      </div>
    </div>
  );
}

function Link2() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Link">
      <div className="flex flex-col font-['Liberation_Serif:Bold',sans-serif] h-[18px] justify-center leading-[0] not-italic relative shrink-0 text-[#a1a1a6] text-[12px] tracking-[-0.6px] uppercase w-[41.52px]">
        <p className="leading-[18px]">Fabric</p>
      </div>
    </div>
  );
}

function Link3() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Link">
      <div className="flex flex-col font-['Liberation_Serif:Bold',sans-serif] h-[18px] justify-center leading-[0] not-italic relative shrink-0 text-[#a1a1a6] text-[12px] tracking-[-0.6px] uppercase w-[32.28px]">
        <p className="leading-[18px]">Neck</p>
      </div>
    </div>
  );
}

function Link4() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Link">
      <div className="flex flex-col font-['Liberation_Serif:Bold',sans-serif] h-[18px] justify-center leading-[0] not-italic relative shrink-0 text-[#a1a1a6] text-[12px] tracking-[-0.6px] uppercase w-[49.84px]">
        <p className="leading-[18px]">Sleeves</p>
      </div>
    </div>
  );
}

function Link5() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Link">
      <div className="flex flex-col font-['Liberation_Serif:Bold',sans-serif] h-[18px] justify-center leading-[0] not-italic relative shrink-0 text-[#a1a1a6] text-[12px] tracking-[-0.6px] uppercase w-[26.88px]">
        <p className="leading-[18px]">Hem</p>
      </div>
    </div>
  );
}

function Link6() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Link">
      <div className="flex flex-col font-['Liberation_Serif:Bold',sans-serif] h-[18px] justify-center leading-[0] not-italic relative shrink-0 text-[#a1a1a6] text-[12px] tracking-[-0.6px] uppercase w-[53.16px]">
        <p className="leading-[18px]">Pockets</p>
      </div>
    </div>
  );
}

function Link7() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Link">
      <div className="flex flex-col font-['Liberation_Serif:Bold',sans-serif] h-[18px] justify-center leading-[0] not-italic relative shrink-0 text-[#a1a1a6] text-[12px] tracking-[-0.6px] uppercase w-[46.42px]">
        <p className="leading-[18px]">Review</p>
      </div>
    </div>
  );
}

function Container47() {
  return (
    <div className="content-stretch flex gap-[24px] h-[24px] items-center relative shrink-0" data-name="Container">
      <Link />
      <Link1 />
      <Link2 />
      <Link3 />
      <Link4 />
      <Link5 />
      <Link6 />
      <Link7 />
    </div>
  );
}

function Container45() {
  return (
    <div className="relative shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[24px] items-center relative">
        <Container46 />
        <Container47 />
      </div>
    </div>
  );
}

function Button10() {
  return (
    <div className="h-[36px] relative shrink-0 w-[36.1px]" data-name="Button">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 36.1 36">
        <g id="Button">
          <path d={svgPaths.pa235580} fill="var(--fill-0, #E7BDB7)" id="Icon" />
        </g>
      </svg>
    </div>
  );
}

function Button11() {
  return (
    <div className="relative shrink-0 size-[36px]" data-name="Button">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 36 36">
        <g id="Button">
          <path d={svgPaths.p1988dd00} fill="var(--fill-0, #E7BDB7)" id="Icon" />
        </g>
      </svg>
    </div>
  );
}

function Button12() {
  return (
    <div className="bg-[#ff5545] content-stretch flex flex-col items-center justify-center px-[16px] py-[6px] relative rounded-[2px] shrink-0" data-name="Button">
      <div className="flex flex-col font-['Liberation_Serif:Bold',sans-serif] h-[16px] justify-center leading-[0] not-italic relative shrink-0 text-[#5c0002] text-[12px] text-center tracking-[0.6px] uppercase w-[80.8px]">
        <p className="leading-[16px]">Save Draft</p>
      </div>
    </div>
  );
}

function Container48() {
  return (
    <div className="relative shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[16px] items-center relative">
        <Button10 />
        <Button11 />
        <Button12 />
      </div>
    </div>
  );
}

function TopNavBar() {
  return (
    <div className="absolute backdrop-blur-[6px] bg-[rgba(11,11,12,0.8)] content-stretch flex h-[64px] items-center justify-between left-0 pb-px px-[32px] top-0 w-[1280px]" data-name="TopNavBar">
      <div aria-hidden="true" className="absolute border-[#1a1a1d] border-b border-solid inset-0 pointer-events-none shadow-[0px_0px_20px_0px_rgba(255,59,48,0.1)]" />
      <Container45 />
      <Container48 />
    </div>
  );
}

function Container50() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#a1a1a6] text-[10px] tracking-[1px] uppercase w-[385.61px]">
        <p className="leading-[15px]">© 2024 CERIGA FABRIC ENGINE | INDUSTRIAL GRADE PRODUCTION</p>
      </div>
    </div>
  );
}

function Container53() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal h-[14px] justify-center leading-[0] not-italic relative shrink-0 text-[#e7bdb7] text-[9px] tracking-[0.9px] uppercase w-[84.56px]">
        <p className="leading-[13.5px]">System Online</p>
      </div>
    </div>
  );
}

function Container52() {
  return (
    <div className="content-stretch flex gap-[8px] items-center relative shrink-0" data-name="Container">
      <div className="bg-[#22c55e] rounded-[9999px] shadow-[0px_0px_8px_0px_rgba(34,197,94,0.5)] shrink-0 size-[6px]" data-name="Background+Shadow" />
      <Container53 />
    </div>
  );
}

function Container54() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal h-[14px] justify-center leading-[0] not-italic relative shrink-0 text-[#e7bdb7] text-[9px] tracking-[0.9px] uppercase w-[54.34px]">
        <p className="leading-[13.5px]">Lat: 24ms</p>
      </div>
    </div>
  );
}

function Container51() {
  return (
    <div className="content-stretch flex gap-[16px] items-center relative shrink-0" data-name="Container">
      <Container52 />
      <Container54 />
    </div>
  );
}

function Container49() {
  return (
    <div className="relative shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[32px] items-center relative">
        <Container50 />
        <Container51 />
      </div>
    </div>
  );
}

function Link8() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Link">
      <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#a1a1a6] text-[10px] tracking-[1px] uppercase w-[111.13px]">
        <p className="leading-[15px]">Terms of Service</p>
      </div>
    </div>
  );
}

function Link9() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Link">
      <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#a1a1a6] text-[10px] tracking-[1px] uppercase w-[125.72px]">
        <p className="leading-[15px]">Factory Standards</p>
      </div>
    </div>
  );
}

function Link10() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Link">
      <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#a1a1a6] text-[10px] tracking-[1px] uppercase w-[54.17px]">
        <p className="leading-[15px]">Support</p>
      </div>
    </div>
  );
}

function Container55() {
  return (
    <div className="relative shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[24px] items-center relative">
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
      <Container49 />
      <Container55 />
    </div>
  );
}

export default function FitSilhouetteConfiguration() {
  return (
    <div className="bg-[#131314] relative size-full" data-name="Fit & Silhouette Configuration">
      <MainContentCanvas />
      <AsideSideNavBarRightPanel />
      <TopNavBar />
      <Footer />
    </div>
  );
}