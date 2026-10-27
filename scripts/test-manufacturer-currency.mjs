import assert from 'node:assert/strict';import{createServer}from'vite';
const define=Object.fromEntries(['VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'].map(k=>['import.meta.env.'+k,'""']));
const server=await createServer({define,server:{middlewareMode:true}});try{
  const model = await server.ssrLoadModule('/src/app/data/manufacturerPricingModel.ts');
  const money = await server.ssrLoadModule('/src/app/lib/currency.ts');
  const store = await server.ssrLoadModule('/src/app/data/manufacturerOnboardingStore.ts');
  const account = await server.ssrLoadModule('/src/app/data/manufacturerPricing.ts');
  const quotes = await server.ssrLoadModule('/src/app/pages/manufacturer/ManufacturerOrderDetail.tsx');
  const financials = await server.ssrLoadModule('/src/app/data/manufacturerFinancials.ts');
  const defaults = await server.ssrLoadModule('/src/app/data/manufacturerGarmentDefaults.ts');
  assert.equal(money.currencySymbol('GBP'),'£'); assert.equal(money.currencySymbol('USD'),'$'); assert.equal(money.currencySymbol('EUR'),'€');
  const legacy = { preferredCurrency:'EUR', samplePricingApproach:'multiplier_2x', quantityTierDiscount:true, requiresCustomQuotation:true, indicativePriceRanges:{hoodie:'£20 - £26',tshirt:'USD 7 - USD 12',jogger:'Contact for price'} };
  const migrated = model.normalizePricing(legacy);
  assert.equal(migrated.priceBooks.GBP.hoodie.minCents,2000); assert.equal(migrated.priceBooks.USD.tshirt.minCents,700); assert.equal(migrated.priceBooks.EUR,undefined);
  assert.equal(migrated.indicativePriceRanges.jogger,'Contact for price'); assert.equal(model.parseLegacyPriceRange('£20 - €26','GBP'),undefined);
  const priced = { ...migrated, priceBooks:{...migrated.priceBooks,EUR:{hoodie:{currency:'EUR',minCents:2200,maxCents:3000}}} };
  assert.deepEqual(model.samplePriceRange(priced,'hoodie'),{currency:'EUR',minCents:4400,maxCents:6000});
  assert.equal(model.samplePriceRange({...priced,samplePricingApproach:'multiplier_3x'},'hoodie').minCents,6600);
  assert.equal(model.samplePriceRange({...priced,samplePricingApproach:'flat_fee',flatSampleFeeByCurrency:{EUR:4500}},'hoodie').minCents,4500);
  assert.equal(model.samplePriceRange({...priced,samplePricingApproach:'custom_quote'},'hoodie'),undefined);
  assert.match(model.pricingValidationError({...priced,priceBooks:{EUR:{hoodie:{currency:'EUR',minCents:3100,maxCents:3000}}}}),/Minimum/);
  assert.equal(model.pricingValidationError({...priced,priceBooks:{EUR:{hoodie:{currency:'EUR'}}}}),undefined);
  const quoteBase={id:'test-order',orderQuantities:{sample:{bySize:{M:1}},bulkRuns:[]},quotedAt:new Date().toISOString(),quoteTiers:[{id:'s',kind:'sample',factoryCostCents:2000,totalUnits:1}]};
  const original=JSON.stringify(quoteBase);
  assert.equal(quotes.draftTiersFromOrder(quoteBase,'EUR')[0].currency,undefined);
  assert.equal(quotes.draftTiersFromOrder({...quoteBase,quoteTiers:[{...quoteBase.quoteTiers[0],currency:'USD'}]},'EUR')[0].currency,'USD');
  assert.equal(quotes.draftTiersFromOrder({...quoteBase,quotedAt:undefined,quoteTiers:undefined},'EUR')[0].currency,'EUR');
  assert.equal(JSON.stringify(quoteBase),original);
  const summary=financials.factoryQuoteFinancials([quoteBase,{...quoteBase,id:'eur',quoteTiers:[{...quoteBase.quoteTiers[0],currency:'EUR',factoryCostCents:3000}]}],'EUR',90);
  assert.deepEqual(summary.byCurrency,{EUR:3000}); assert.equal(summary.totalCents,undefined);assert.equal(summary.currencyIncomplete,true);
  let record;
  const client={rpc:async(name,args)=>{if(name==='save_factory_pricing'){record={user_id:'currency-tests',pricing:structuredClone(args.p_pricing)};return{data:'currency-tests',error:null};}assert.equal(name,'factory_workspace_profile');return{data:record,error:null};},auth:{getUser:async()=>({data:{user:{id:'currency-tests'}},error:null})},from(table){assert.equal(table,'manufacturer_profiles');return {
    async upsert(row){assert.deepEqual(Object.keys(row).sort(),['pricing','user_id']);record=structuredClone(row);return{error:null};},
    select:()=>({eq:(field,id)=>{assert.equal(field,'user_id');assert.equal(id,'currency-tests');return{maybeSingle:async()=>({data:record,error:null})};}}),
  };}};
  await account.saveManufacturerPricingToDb(priced,client); const restored=await account.loadManufacturerPricingFromDb(client);
  assert.deepEqual(restored.priceBooks,priced.priceBooks); assert.equal(restored.preferredCurrency,'EUR');
  const broken={...client,rpc:async()=>({data:null,error:{message:'Offline'}})};
  await assert.rejects(account.saveManufacturerPricingToDb(priced,broken),/sync failed/);
  await account.saveManufacturerPricingToDb(priced,client);
  console.log('PASS: legacy currency migration, price books, optional/invalid ranges, sample fees/multipliers, original quote currencies, separate-currency totals, and mocked profile database round trips.');


assert.equal(model.parseLegacyPriceRange('$10 - $20','USD'),undefined);assert.equal(model.parseLegacyPriceRange('10 - 20','GBP'),undefined);
}finally{await server.close();}
