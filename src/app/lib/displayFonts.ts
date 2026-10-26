import interSource from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url';
import montserratSource from '@fontsource-variable/montserrat/files/montserrat-latin-wght-normal.woff2?url';
import poppinsSource from '@fontsource/poppins/files/poppins-latin-400-normal.woff?url';
import font0 from '@fontsource/graduate/files/graduate-latin-400-normal.woff?url';
import font1 from '@fontsource/jersey-10/files/jersey-10-latin-400-normal.woff?url';
import font2 from '@fontsource/bungee/files/bungee-latin-400-normal.woff?url';
import font3 from '@fontsource/alfa-slab-one/files/alfa-slab-one-latin-400-normal.woff?url';
import font4 from '@fontsource/anton/files/anton-latin-400-normal.woff?url';
import font5 from '@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff?url';
import font6 from '@fontsource/oswald/files/oswald-latin-600-normal.woff?url';
import font7 from '@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff?url';
import font8 from '@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff?url';
import font9 from '@fontsource/black-ops-one/files/black-ops-one-latin-400-normal.woff?url';
import font10 from '@fontsource/stardos-stencil/files/stardos-stencil-latin-700-normal.woff?url';
import font11 from '@fontsource/unifrakturcook/files/unifrakturcook-latin-700-normal.woff?url';
import font12 from '@fontsource/pirata-one/files/pirata-one-latin-400-normal.woff?url';
import font13 from '@fontsource/pinyon-script/files/pinyon-script-latin-400-normal.woff?url';
import font14 from '@fontsource/yellowtail/files/yellowtail-latin-400-normal.woff?url';
import font15 from '@fontsource/lobster/files/lobster-latin-400-normal.woff?url';
import font16 from '@fontsource/permanent-marker/files/permanent-marker-latin-400-normal.woff?url';
import font17 from '@fontsource/rye/files/rye-latin-400-normal.woff?url';
import font18 from '@fontsource/abril-fatface/files/abril-fatface-latin-400-normal.woff?url';
export const CLOTHING_FONTS=[
 {family:"Graduate",category:"Varsity & sport",weight:400,source:font0,license:"OFL-1.1",licenseUrl:'/font-licenses/graduate.txt'},
 {family:"Jersey 10",category:"Varsity & sport",weight:400,source:font1,license:"OFL-1.1",licenseUrl:'/font-licenses/jersey-10.txt'},
 {family:"Bungee",category:"Varsity & sport",weight:400,source:font2,license:"OFL-1.1",licenseUrl:'/font-licenses/bungee.txt'},
 {family:"Alfa Slab One",category:"Varsity & sport",weight:400,source:font3,license:"OFL-1.1",licenseUrl:'/font-licenses/alfa-slab-one.txt'},
 {family:"Anton",category:"Bold & condensed",weight:400,source:font4,license:"OFL-1.1",licenseUrl:'/font-licenses/anton.txt'},
 {family:"Bebas Neue",category:"Bold & condensed",weight:400,source:font5,license:"OFL-1.1",licenseUrl:'/font-licenses/bebas-neue.txt'},
 {family:"Oswald",category:"Bold & condensed",weight:600,source:font6,license:"OFL-1.1",licenseUrl:'/font-licenses/oswald.txt'},
 {family:"Barlow Condensed",category:"Bold & condensed",weight:700,source:font7,license:"OFL-1.1",licenseUrl:'/font-licenses/barlow-condensed.txt'},
 {family:"Archivo Black",category:"Bold & condensed",weight:400,source:font8,license:"OFL-1.1",licenseUrl:'/font-licenses/archivo-black.txt'},
 {family:"Black Ops One",category:"Stencil",weight:400,source:font9,license:"OFL-1.1",licenseUrl:'/font-licenses/black-ops-one.txt'},
 {family:"Stardos Stencil",category:"Stencil",weight:700,source:font10,license:"OFL-1.1",licenseUrl:'/font-licenses/stardos-stencil.txt'},
 {family:"UnifrakturCook",category:"Blackletter",weight:700,source:font11,license:"OFL-1.1",licenseUrl:'/font-licenses/unifrakturcook.txt'},
 {family:"Pirata One",category:"Blackletter",weight:400,source:font12,license:"OFL-1.1",licenseUrl:'/font-licenses/pirata-one.txt'},
 {family:"Pinyon Script",category:"Script",weight:400,source:font13,license:"OFL-1.1",licenseUrl:'/font-licenses/pinyon-script.txt'},
 {family:"Yellowtail",category:"Script",weight:400,source:font14,license:"Apache-2.0",licenseUrl:'/font-licenses/yellowtail.txt'},
 {family:"Lobster",category:"Script",weight:400,source:font15,license:"OFL-1.1",licenseUrl:'/font-licenses/lobster.txt'},
 {family:"Permanent Marker",category:"Hand drawn",weight:400,source:font16,license:"Apache-2.0",licenseUrl:'/font-licenses/permanent-marker.txt'},
 {family:"Rye",category:"Western",weight:400,source:font17,license:"OFL-1.1",licenseUrl:'/font-licenses/rye.txt'},
 {family:"Abril Fatface",category:"Editorial",weight:400,source:font18,license:"OFL-1.1",licenseUrl:'/font-licenses/abril-fatface.txt'},
] as const;
export const CLOTHING_FONT_NAMES=CLOTHING_FONTS.map(font=>font.family);
export const DISPLAY_FONT_SOURCES:Record<string,string>={...Object.fromEntries(CLOTHING_FONTS.map(font=>[font.family,font.source])),Poppins:poppinsSource};
export const SVG_FONT_SOURCES:Record<string,string>={...DISPLAY_FONT_SOURCES,Inter:interSource,Montserrat:montserratSource};
