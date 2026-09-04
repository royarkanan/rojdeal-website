export function cleanSearchParams(raw: Record<string, unknown>): Record<string, string> {
  const result: Record<string,string>={};
  for(const key of ['q','category','purpose','transactionType','governorate','city','locationIds','minPrice','maxPrice','sortBy','page']){
    if(typeof raw[key]==='string')result[key]=raw[key].trim().slice(0,key==='locationIds'?8000:200);
  }
  const allowed: Record<string,string[]>={
    category:['real_estate','vehicles','miscellaneous'],purpose:['sell','rent','wanted'],
    transactionType:['sale','rent','lease','exchange','installment','donation','partnership','assignment','other'],
    sortBy:['newest','price_asc','price_desc'],
  };
  for(const [key,values] of Object.entries(allowed))if(!values.includes(result[key]))delete result[key];
  for(const key of ['minPrice','maxPrice'])if(!result[key] || !Number.isFinite(Number(result[key])) || Number(result[key])<0)delete result[key];
  if(result.minPrice && result.maxPrice && Number(result.minPrice)>Number(result.maxPrice)) [result.minPrice,result.maxPrice]=[result.maxPrice,result.minPrice];
  if(result.locationIds)result.locationIds=[...new Set(result.locationIds.split(',').map(Number).filter(n=>Number.isSafeInteger(n)&&n>0))].join(',');
  if(result.page && (!/^\d+$/.test(result.page) || Number(result.page)<1 || Number(result.page)>100000))delete result.page;
  return result;
}
