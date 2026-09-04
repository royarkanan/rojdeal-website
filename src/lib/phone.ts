import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
export { getCountries, getCountryCallingCode, type CountryCode };
const latinDigits = (value: string) =>
  value.replace(/[٠-٩۰-۹]/g,c=>String(c.charCodeAt(0)-(c>='۰'?1776:1632)));
export function phoneInput(value: string) {
  return latinDigits(value).replace(/[^0-9+()\s.-]/g, '');
}
export function phoneText(value: string) {
  return latinDigits(value).trim().replace(/^00/,'+');
}
export function parsedPhone(value: string, country: CountryCode) {
  return parsePhoneNumberFromString(phoneText(value),{defaultCountry:country,extract:false});
}
export function normalizedPhone(value: string, country: CountryCode): string | null {
  if(!value.trim())return '';
  const parsed=parsedPhone(value,country);
  // Length checks avoid rejecting newly assigned valid number ranges. This is not ownership verification.
  return parsed?.isPossible() && !parsed.ext ? parsed.number : null;
}
export function changePhoneCountry(value: string, previous: CountryCode, next: CountryCode) {
  if(!value.trim())return '';
  const parsed=parsedPhone(value,previous);
  return parsed ? `+${getCountryCallingCode(next)}${parsed.nationalNumber}` : value;
}
