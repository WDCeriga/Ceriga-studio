const normalise=(v:string)=>v.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g,'');
const countries:Record<string,string>={morocco:'MA',tunisia:'TN',egypt:'EG',brazil:'BR',uk:'GB',gb:'GB',unitedkingdom:'GB',us:'US',usa:'US',unitedstates:'US',canada:'CA',australia:'AU',newzealand:'NZ',germany:'DE',france:'FR',portugal:'PT',italy:'IT',spain:'ES',netherlands:'NL',ireland:'IE',belgium:'BE',austria:'AT',denmark:'DK',finland:'FI',sweden:'SE',poland:'PL',czechia:'CZ',czechrepublic:'CZ',luxembourg:'LU',greece:'GR',romania:'RO',bulgaria:'BG',croatia:'HR',hungary:'HU',slovenia:'SI',slovakia:'SK',estonia:'EE',latvia:'LV',lithuania:'LT',cyprus:'CY',malta:'MT',turkey:'TR',india:'IN',china:'CN',vietnam:'VN',pakistan:'PK',bangladesh:'BD',japan:'JP',southkorea:'KR',unitedarabemirates:'AE',saudiarabia:'SA',qatar:'QA',oman:'OM',bahrain:'BH',kuwait:'KW',israel:'IL',jordan:'JO',lebanon:'LB',mexico:'MX'};
const regions:Record<string,string[]>={
 eu:['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'],
 northamerica:['US','CA','MX'],oceania:['AU','NZ'],middleeast:['AE','SA','QA','OM','BH','KW','IL','JO','LB'],asia:['IN','CN','VN','PK','BD','JP','KR','SG','MY','TH','ID','PH','TW'],
};
export function canonicalCountry(value:string):string{const token=normalise(value);return countries[token]||(token.length===2?token.toUpperCase():token);}
export function servesDestination(destinations:string[],country:string):boolean{
 const target=canonicalCountry(country);
 return destinations.some(destination=>{const value=normalise(destination);if(value==='worldwide')return true;const region=value==='europeanunioneu'||value==='eu'?'eu':value==='northamericausandcanada'||value==='northamericauscanada'||value==='northamerica'?'northamerica':value==='australiaandoceania'||value==='australiaoceania'?'oceania':value==='middleeast'?'middleeast':value==='asiaandfareast'||value==='asiafareast'?'asia':null;return canonicalCountry(destination)===target||!!region&&(region==='northamerica'&&value!=='northamerica'?['US','CA']:regions[region]).includes(target);});
}
