import { format, parseISO, differenceInDays, isAfter, isBefore } from 'date-fns';
import { Asset, DepreciationRecord } from '../types';

export function formatDate(dateStr: string): string {
  if (!dateStr) return 'N/A';
  try {
    return format(parseISO(dateStr), 'MMM dd, yyyy');
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string): string {
  if (!dateStr) return 'N/A';
  try {
    return format(parseISO(dateStr), 'MMM dd, yyyy HH:mm');
  } catch {
    return dateStr;
  }
}

export const SUPPORTED_CURRENCIES = [
  { code: 'AED', label: 'AED - UAE Dirham (د.إ)' },
  { code: 'AFN', label: 'AFN - Afghan Afghani (؋)' },
  { code: 'ALL', label: 'ALL - Albanian Lek (L)' },
  { code: 'AMD', label: 'AMD - Armenian Dram (֏)' },
  { code: 'AOA', label: 'AOA - Angolan Kwanza (Kz)' },
  { code: 'ARS', label: 'ARS - Argentine Peso ($)' },
  { code: 'AUD', label: 'AUD - Australian Dollar (A$)' },
  { code: 'AZN', label: 'AZN - Azerbaijani Manat (₼)' },
  { code: 'BAM', label: 'BAM - Bosnian Mark (KM)' },
  { code: 'BBD', label: 'BBD - Barbadian Dollar (Bds$)' },
  { code: 'BDT', label: 'BDT - Bangladeshi Taka (৳)' },
  { code: 'BGN', label: 'BGN - Bulgarian Lev (лв)' },
  { code: 'BHD', label: 'BHD - Bahraini Dinar (.د.ب)' },
  { code: 'BIF', label: 'BIF - Burundian Franc (Fr)' },
  { code: 'BND', label: 'BND - Brunei Dollar (B$)' },
  { code: 'BOB', label: 'BOB - Bolivian Boliviano (Bs.)' },
  { code: 'BRL', label: 'BRL - Brazilian Real (R$)' },
  { code: 'BSD', label: 'BSD - Bahamian Dollar (B$)' },
  { code: 'BTN', label: 'BTN - Bhutanese Ngultrum (Nu)' },
  { code: 'BWP', label: 'BWP - Botswana Pula (P)' },
  { code: 'BYN', label: 'BYN - Belarusian Ruble (Br)' },
  { code: 'BZD', label: 'BZD - Belize Dollar (BZ$)' },
  { code: 'CAD', label: 'CAD - Canadian Dollar (C$)' },
  { code: 'CDF', label: 'CDF - Congolese Franc (Fr)' },
  { code: 'CHF', label: 'CHF - Swiss Franc (Fr)' },
  { code: 'CLP', label: 'CLP - Chilean Peso ($)' },
  { code: 'CNY', label: 'CNY - Chinese Yuan (¥)' },
  { code: 'COP', label: 'COP - Colombian Peso ($)' },
  { code: 'CRC', label: 'CRC - Costa Rican Colón (₡)' },
  { code: 'CUP', label: 'CUP - Cuban Peso ($)' },
  { code: 'CVE', label: 'CVE - Cape Verdean Escudo ($)' },
  { code: 'CZK', label: 'CZK - Czech Koruna (Kč)' },
  { code: 'DJF', label: 'DJF - Djiboutian Franc (Fr)' },
  { code: 'DKK', label: 'DKK - Danish Krone (kr)' },
  { code: 'DOP', label: 'DOP - Dominican Peso (RD$)' },
  { code: 'DZD', label: 'DZD - Algerian Dinar (دج)' },
  { code: 'EGP', label: 'EGP - Egyptian Pound (£)' },
  { code: 'ERN', label: 'ERN - Eritrean Nakfa (Nfk)' },
  { code: 'ETB', label: 'ETB - Ethiopian Birr (Br)' },
  { code: 'EUR', label: 'EUR - Euro (€)' },
  { code: 'FJD', label: 'FJD - Fijian Dollar (FJ$)' },
  { code: 'GBP', label: 'GBP - British Pound (£)' },
  { code: 'GEL', label: 'GEL - Georgian Lari (₾)' },
  { code: 'GHS', label: 'GHS - Ghanaian Cedi (₵)' },
  { code: 'GMD', label: 'GMD - Gambian Dalasi (D)' },
  { code: 'GNF', label: 'GNF - Guinean Franc (Fr)' },
  { code: 'GTQ', label: 'GTQ - Guatemalan Quetzal (Q)' },
  { code: 'GYD', label: 'GYD - Guyanese Dollar (G$)' },
  { code: 'HNL', label: 'HNL - Honduran Lempira (L)' },
  { code: 'HTG', label: 'HTG - Haitian Gourde (G)' },
  { code: 'HUF', label: 'HUF - Hungarian Forint (Ft)' },
  { code: 'IDR', label: 'IDR - Indonesian Rupiah (Rp)' },
  { code: 'ILS', label: 'ILS - Israeli Shekel (₪)' },
  { code: 'INR', label: 'INR - Indian Rupee (₹)' },
  { code: 'IQD', label: 'IQD - Iraqi Dinar (ع.د)' },
  { code: 'IRR', label: 'IRR - Iranian Rial (﷼)' },
  { code: 'ISK', label: 'ISK - Icelandic Króna (kr)' },
  { code: 'JMD', label: 'JMD - Jamaican Dollar (J$)' },
  { code: 'JOD', label: 'JOD - Jordanian Dinar (JD)' },
  { code: 'JPY', label: 'JPY - Japanese Yen (¥)' },
  { code: 'KES', label: 'KES - Kenyan Shilling (KSh)' },
  { code: 'KGS', label: 'KGS - Kyrgyzstani Som (с)' },
  { code: 'KHR', label: 'KHR - Cambodian Riel (៛)' },
  { code: 'KMF', label: 'KMF - Comorian Franc (Fr)' },
  { code: 'KPW', label: 'KPW - North Korean Won (₩)' },
  { code: 'KRW', label: 'KRW - South Korean Won (₩)' },
  { code: 'KWD', label: 'KWD - Kuwaiti Dinar (د.ك)' },
  { code: 'KZT', label: 'KZT - Kazakhstani Tenge (₸)' },
  { code: 'LAK', label: 'LAK - Lao Kip (₭)' },
  { code: 'LBP', label: 'LBP - Lebanese Pound (ل.ل)' },
  { code: 'LKR', label: 'LKR - Sri Lankan Rupee (Rs)' },
  { code: 'LRD', label: 'LRD - Liberian Dollar (L$)' },
  { code: 'LSL', label: 'LSL - Lesotho Loti (L)' },
  { code: 'LYD', label: 'LYD - Libyan Dinar (ل.د)' },
  { code: 'MAD', label: 'MAD - Moroccan Dirham (MAD)' },
  { code: 'MDL', label: 'MDL - Moldovan Leu (L)' },
  { code: 'MGA', label: 'MGA - Malagasy Ariary (Ar)' },
  { code: 'MKD', label: 'MKD - Macedonian Denar (ден)' },
  { code: 'MMK', label: 'MMK - Myanmar Kyat (K)' },
  { code: 'MNT', label: 'MNT - Mongolian Tögrög (₮)' },
  { code: 'MRU', label: 'MRU - Mauritanian Ouguiya (UM)' },
  { code: 'MUR', label: 'MUR - Mauritian Rupee (Rs)' },
  { code: 'MVR', label: 'MVR - Maldivian Rufiyaa (Rf)' },
  { code: 'MWK', label: 'MWK - Malawian Kwacha (MK)' },
  { code: 'MXN', label: 'MXN - Mexican Peso ($)' },
  { code: 'MYR', label: 'MYR - Malaysian Ringgit (RM)' },
  { code: 'MZN', label: 'MZN - Mozambican Metical (MT)' },
  { code: 'NAD', label: 'NAD - Namibian Dollar (N$)' },
  { code: 'NGN', label: 'NGN - Nigerian Naira (₦)' },
  { code: 'NIO', label: 'NIO - Nicaraguan Córdoba (C$)' },
  { code: 'NOK', label: 'NOK - Norwegian Krone (kr)' },
  { code: 'NPR', label: 'NPR - Nepalese Rupee (Rs)' },
  { code: 'NZD', label: 'NZD - New Zealand Dollar (NZ$)' },
  { code: 'OMR', label: 'OMR - Omani Rial (ر.ع.)' },
  { code: 'PAB', label: 'PAB - Panamanian Balboa (B/.)' },
  { code: 'PEN', label: 'PEN - Peruvian Sol (S/)' },
  { code: 'PGK', label: 'PGK - Papua New Guinean Kina (K)' },
  { code: 'PHP', label: 'PHP - Philippine Peso (₱)' },
  { code: 'PKR', label: 'PKR - Pakistani Rupee (Rs)' },
  { code: 'PLN', label: 'PLN - Polish Złoty (zł)' },
  { code: 'PYG', label: 'PYG - Paraguayan Guaraní (₲)' },
  { code: 'QAR', label: 'QAR - Qatari Riyal (ر.ق)' },
  { code: 'RON', label: 'RON - Romanian Leu (lei)' },
  { code: 'RSD', label: 'RSD - Serbian Dinar (din)' },
  { code: 'RUB', label: 'RUB - Russian Ruble (₽)' },
  { code: 'RWF', label: 'RWF - Rwandan Franc (Fr)' },
  { code: 'SAR', label: 'SAR - Saudi Riyal (﷼)' },
  { code: 'SBD', label: 'SBD - Solomon Islands Dollar (SI$)' },
  { code: 'SCR', label: 'SCR - Seychellois Rupee (Rs)' },
  { code: 'SDG', label: 'SDG - Sudanese Pound (£)' },
  { code: 'SEK', label: 'SEK - Swedish Krona (kr)' },
  { code: 'SGD', label: 'SGD - Singapore Dollar (S$)' },
  { code: 'SLE', label: 'SLE - Sierra Leonean Leone (Le)' },
  { code: 'SOS', label: 'SOS - Somali Shilling (Sh)' },
  { code: 'SRD', label: 'SRD - Surinamese Dollar (Sr$)' },
  { code: 'SSP', label: 'SSP - South Sudanese Pound (£)' },
  { code: 'STN', label: 'STN - São Tomé Dobra (Db)' },
  { code: 'SYP', label: 'SYP - Syrian Pound (£)' },
  { code: 'SZL', label: 'SZL - Swazi Lilangeni (L)' },
  { code: 'THB', label: 'THB - Thai Baht (฿)' },
  { code: 'TJS', label: 'TJS - Tajikistani Somoni (SM)' },
  { code: 'TMT', label: 'TMT - Turkmenistani Manat (T)' },
  { code: 'TND', label: 'TND - Tunisian Dinar (DT)' },
  { code: 'TOP', label: 'TOP - Tongan Paʻanga (T$)' },
  { code: 'TRY', label: 'TRY - Turkish Lira (₺)' },
  { code: 'TTD', label: 'TTD - Trinidad Dollar (TT$)' },
  { code: 'TWD', label: 'TWD - New Taiwan Dollar (NT$)' },
  { code: 'TZS', label: 'TZS - Tanzanian Shilling (TSh)' },
  { code: 'UAH', label: 'UAH - Ukrainian Hryvnia (₴)' },
  { code: 'UGX', label: 'UGX - Ugandan Shilling (USh)' },
  { code: 'USD', label: 'USD - US Dollar ($)' },
  { code: 'UYU', label: 'UYU - Uruguayan Peso ($U)' },
  { code: 'UZS', label: 'UZS - Uzbekistani Som (UZS)' },
  { code: 'VES', label: 'VES - Venezuelan Bolívar (Bs.S)' },
  { code: 'VND', label: 'VND - Vietnamese Dong (₫)' },
  { code: 'VUV', label: 'VUV - Vanuatu Vatu (VT)' },
  { code: 'WST', label: 'WST - Samoan Tālā (WS$)' },
  { code: 'XAF', label: 'XAF - Central African CFA (FCFA)' },
  { code: 'XCD', label: 'XCD - East Caribbean Dollar (EC$)' },
  { code: 'XOF', label: 'XOF - West African CFA (CFA)' },
  { code: 'YER', label: 'YER - Yemeni Rial (﷼)' },
  { code: 'ZAR', label: 'ZAR - South African Rand (R)' },
  { code: 'ZMW', label: 'ZMW - Zambian Kwacha (ZK)' },
  { code: 'ZWL', label: 'ZWL - Zimbabwean Dollar (Z$)' },
] as const;

export const SUPPORTED_COUNTRIES = [
  { code: 'AF', name: 'Afghanistan', flag: '\u{1F1E6}\u{1F1EB}', currency: 'AFN', dialCode: '+93' },
  { code: 'AL', name: 'Albania', flag: '\u{1F1E6}\u{1F1F1}', currency: 'ALL', dialCode: '+355' },
  { code: 'DZ', name: 'Algeria', flag: '\u{1F1E9}\u{1F1FF}', currency: 'DZD', dialCode: '+213' },
  { code: 'AD', name: 'Andorra', flag: '\u{1F1E6}\u{1F1E9}', currency: 'EUR', dialCode: '+376' },
  { code: 'AO', name: 'Angola', flag: '\u{1F1E6}\u{1F1F4}', currency: 'AOA', dialCode: '+244' },
  { code: 'AG', name: 'Antigua and Barbuda', flag: '\u{1F1E6}\u{1F1EC}', currency: 'XCD', dialCode: '+1-268' },
  { code: 'AR', name: 'Argentina', flag: '\u{1F1E6}\u{1F1F7}', currency: 'ARS', dialCode: '+54' },
  { code: 'AM', name: 'Armenia', flag: '\u{1F1E6}\u{1F1F2}', currency: 'AMD', dialCode: '+374' },
  { code: 'AU', name: 'Australia', flag: '\u{1F1E6}\u{1F1FA}', currency: 'AUD', dialCode: '+61' },
  { code: 'AT', name: 'Austria', flag: '\u{1F1E6}\u{1F1F9}', currency: 'EUR', dialCode: '+43' },
  { code: 'AZ', name: 'Azerbaijan', flag: '\u{1F1E6}\u{1F1FF}', currency: 'AZN', dialCode: '+994' },
  { code: 'BS', name: 'Bahamas', flag: '\u{1F1E7}\u{1F1F8}', currency: 'BSD', dialCode: '+1-242' },
  { code: 'BH', name: 'Bahrain', flag: '\u{1F1E7}\u{1F1ED}', currency: 'BHD', dialCode: '+973' },
  { code: 'BD', name: 'Bangladesh', flag: '\u{1F1E7}\u{1F1E9}', currency: 'BDT', dialCode: '+880' },
  { code: 'BB', name: 'Barbados', flag: '\u{1F1E7}\u{1F1E7}', currency: 'BBD', dialCode: '+1-246' },
  { code: 'BY', name: 'Belarus', flag: '\u{1F1E7}\u{1F1FE}', currency: 'BYN', dialCode: '+375' },
  { code: 'BE', name: 'Belgium', flag: '\u{1F1E7}\u{1F1EA}', currency: 'EUR', dialCode: '+32' },
  { code: 'BZ', name: 'Belize', flag: '\u{1F1E7}\u{1F1FF}', currency: 'BZD', dialCode: '+501' },
  { code: 'BJ', name: 'Benin', flag: '\u{1F1E7}\u{1F1EF}', currency: 'XOF', dialCode: '+229' },
  { code: 'BT', name: 'Bhutan', flag: '\u{1F1E7}\u{1F1F9}', currency: 'BTN', dialCode: '+975' },
  { code: 'BO', name: 'Bolivia', flag: '\u{1F1E7}\u{1F1F4}', currency: 'BOB', dialCode: '+591' },
  { code: 'BA', name: 'Bosnia and Herzegovina', flag: '\u{1F1E7}\u{1F1E6}', currency: 'BAM', dialCode: '+387' },
  { code: 'BW', name: 'Botswana', flag: '\u{1F1E7}\u{1F1FC}', currency: 'BWP', dialCode: '+267' },
  { code: 'BR', name: 'Brazil', flag: '\u{1F1E7}\u{1F1F7}', currency: 'BRL', dialCode: '+55' },
  { code: 'BN', name: 'Brunei', flag: '\u{1F1E7}\u{1F1F3}', currency: 'BND', dialCode: '+673' },
  { code: 'BG', name: 'Bulgaria', flag: '\u{1F1E7}\u{1F1EC}', currency: 'BGN', dialCode: '+359' },
  { code: 'BF', name: 'Burkina Faso', flag: '\u{1F1E7}\u{1F1EB}', currency: 'XOF', dialCode: '+226' },
  { code: 'BI', name: 'Burundi', flag: '\u{1F1E7}\u{1F1EE}', currency: 'BIF', dialCode: '+257' },
  { code: 'CV', name: 'Cabo Verde', flag: '\u{1F1E8}\u{1F1FB}', currency: 'CVE', dialCode: '+238' },
  { code: 'KH', name: 'Cambodia', flag: '\u{1F1F0}\u{1F1ED}', currency: 'KHR', dialCode: '+855' },
  { code: 'CM', name: 'Cameroon', flag: '\u{1F1E8}\u{1F1F2}', currency: 'XAF', dialCode: '+237' },
  { code: 'CA', name: 'Canada', flag: '\u{1F1E8}\u{1F1E6}', currency: 'CAD', dialCode: '+1' },
  { code: 'CF', name: 'Central African Republic', flag: '\u{1F1E8}\u{1F1EB}', currency: 'XAF', dialCode: '+236' },
  { code: 'TD', name: 'Chad', flag: '\u{1F1F9}\u{1F1E9}', currency: 'XAF', dialCode: '+235' },
  { code: 'CL', name: 'Chile', flag: '\u{1F1E8}\u{1F1F1}', currency: 'CLP', dialCode: '+56' },
  { code: 'CN', name: 'China', flag: '\u{1F1E8}\u{1F1F3}', currency: 'CNY', dialCode: '+86' },
  { code: 'CO', name: 'Colombia', flag: '\u{1F1E8}\u{1F1F4}', currency: 'COP', dialCode: '+57' },
  { code: 'KM', name: 'Comoros', flag: '\u{1F1F0}\u{1F1F2}', currency: 'KMF', dialCode: '+269' },
  { code: 'CG', name: 'Congo', flag: '\u{1F1E8}\u{1F1EC}', currency: 'XAF', dialCode: '+242' },
  { code: 'CR', name: 'Costa Rica', flag: '\u{1F1E8}\u{1F1F7}', currency: 'CRC', dialCode: '+506' },
  { code: 'HR', name: 'Croatia', flag: '\u{1F1ED}\u{1F1F7}', currency: 'EUR', dialCode: '+385' },
  { code: 'CU', name: 'Cuba', flag: '\u{1F1E8}\u{1F1FA}', currency: 'CUP', dialCode: '+53' },
  { code: 'CY', name: 'Cyprus', flag: '\u{1F1E8}\u{1F1FE}', currency: 'EUR', dialCode: '+357' },
  { code: 'CZ', name: 'Czech Republic', flag: '\u{1F1E8}\u{1F1FF}', currency: 'CZK', dialCode: '+420' },
  { code: 'CD', name: 'DR Congo', flag: '\u{1F1E8}\u{1F1E9}', currency: 'CDF', dialCode: '+243' },
  { code: 'DK', name: 'Denmark', flag: '\u{1F1E9}\u{1F1F0}', currency: 'DKK', dialCode: '+45' },
  { code: 'DJ', name: 'Djibouti', flag: '\u{1F1E9}\u{1F1EF}', currency: 'DJF', dialCode: '+253' },
  { code: 'DM', name: 'Dominica', flag: '\u{1F1E9}\u{1F1F2}', currency: 'XCD', dialCode: '+1-767' },
  { code: 'DO', name: 'Dominican Republic', flag: '\u{1F1E9}\u{1F1F4}', currency: 'DOP', dialCode: '+1-809' },
  { code: 'EC', name: 'Ecuador', flag: '\u{1F1EA}\u{1F1E8}', currency: 'USD', dialCode: '+593' },
  { code: 'EG', name: 'Egypt', flag: '\u{1F1EA}\u{1F1EC}', currency: 'EGP', dialCode: '+20' },
  { code: 'SV', name: 'El Salvador', flag: '\u{1F1F8}\u{1F1FB}', currency: 'USD', dialCode: '+503' },
  { code: 'GQ', name: 'Equatorial Guinea', flag: '\u{1F1EC}\u{1F1F6}', currency: 'XAF', dialCode: '+240' },
  { code: 'ER', name: 'Eritrea', flag: '\u{1F1EA}\u{1F1F7}', currency: 'ERN', dialCode: '+291' },
  { code: 'EE', name: 'Estonia', flag: '\u{1F1EA}\u{1F1EA}', currency: 'EUR', dialCode: '+372' },
  { code: 'SZ', name: 'Eswatini', flag: '\u{1F1F8}\u{1F1FF}', currency: 'SZL', dialCode: '+268' },
  { code: 'ET', name: 'Ethiopia', flag: '\u{1F1EA}\u{1F1F9}', currency: 'ETB', dialCode: '+251' },
  { code: 'FJ', name: 'Fiji', flag: '\u{1F1EB}\u{1F1EF}', currency: 'FJD', dialCode: '+679' },
  { code: 'FI', name: 'Finland', flag: '\u{1F1EB}\u{1F1EE}', currency: 'EUR', dialCode: '+358' },
  { code: 'FR', name: 'France', flag: '\u{1F1EB}\u{1F1F7}', currency: 'EUR', dialCode: '+33' },
  { code: 'GA', name: 'Gabon', flag: '\u{1F1EC}\u{1F1E6}', currency: 'XAF', dialCode: '+241' },
  { code: 'GM', name: 'Gambia', flag: '\u{1F1EC}\u{1F1F2}', currency: 'GMD', dialCode: '+220' },
  { code: 'GE', name: 'Georgia', flag: '\u{1F1EC}\u{1F1EA}', currency: 'GEL', dialCode: '+995' },
  { code: 'DE', name: 'Germany', flag: '\u{1F1E9}\u{1F1EA}', currency: 'EUR', dialCode: '+49' },
  { code: 'GH', name: 'Ghana', flag: '\u{1F1EC}\u{1F1ED}', currency: 'GHS', dialCode: '+233' },
  { code: 'GR', name: 'Greece', flag: '\u{1F1EC}\u{1F1F7}', currency: 'EUR', dialCode: '+30' },
  { code: 'GD', name: 'Grenada', flag: '\u{1F1EC}\u{1F1E9}', currency: 'XCD', dialCode: '+1-473' },
  { code: 'GT', name: 'Guatemala', flag: '\u{1F1EC}\u{1F1F9}', currency: 'GTQ', dialCode: '+502' },
  { code: 'GN', name: 'Guinea', flag: '\u{1F1EC}\u{1F1F3}', currency: 'GNF', dialCode: '+224' },
  { code: 'GW', name: 'Guinea-Bissau', flag: '\u{1F1EC}\u{1F1FC}', currency: 'XOF', dialCode: '+245' },
  { code: 'GY', name: 'Guyana', flag: '\u{1F1EC}\u{1F1FE}', currency: 'GYD', dialCode: '+592' },
  { code: 'HT', name: 'Haiti', flag: '\u{1F1ED}\u{1F1F9}', currency: 'HTG', dialCode: '+509' },
  { code: 'HN', name: 'Honduras', flag: '\u{1F1ED}\u{1F1F3}', currency: 'HNL', dialCode: '+504' },
  { code: 'HU', name: 'Hungary', flag: '\u{1F1ED}\u{1F1FA}', currency: 'HUF', dialCode: '+36' },
  { code: 'IS', name: 'Iceland', flag: '\u{1F1EE}\u{1F1F8}', currency: 'ISK', dialCode: '+354' },
  { code: 'IN', name: 'India', flag: '\u{1F1EE}\u{1F1F3}', currency: 'INR', dialCode: '+91' },
  { code: 'ID', name: 'Indonesia', flag: '\u{1F1EE}\u{1F1E9}', currency: 'IDR', dialCode: '+62' },
  { code: 'IR', name: 'Iran', flag: '\u{1F1EE}\u{1F1F7}', currency: 'IRR', dialCode: '+98' },
  { code: 'IQ', name: 'Iraq', flag: '\u{1F1EE}\u{1F1F6}', currency: 'IQD', dialCode: '+964' },
  { code: 'IE', name: 'Ireland', flag: '\u{1F1EE}\u{1F1EA}', currency: 'EUR', dialCode: '+353' },
  { code: 'IL', name: 'Israel', flag: '\u{1F1EE}\u{1F1F1}', currency: 'ILS', dialCode: '+972' },
  { code: 'IT', name: 'Italy', flag: '\u{1F1EE}\u{1F1F9}', currency: 'EUR', dialCode: '+39' },
  { code: 'CI', name: 'Ivory Coast', flag: '\u{1F1E8}\u{1F1EE}', currency: 'XOF', dialCode: '+225' },
  { code: 'JM', name: 'Jamaica', flag: '\u{1F1EF}\u{1F1F2}', currency: 'JMD', dialCode: '+1-876' },
  { code: 'JP', name: 'Japan', flag: '\u{1F1EF}\u{1F1F5}', currency: 'JPY', dialCode: '+81' },
  { code: 'JO', name: 'Jordan', flag: '\u{1F1EF}\u{1F1F4}', currency: 'JOD', dialCode: '+962' },
  { code: 'KZ', name: 'Kazakhstan', flag: '\u{1F1F0}\u{1F1FF}', currency: 'KZT', dialCode: '+7' },
  { code: 'KE', name: 'Kenya', flag: '\u{1F1F0}\u{1F1EA}', currency: 'KES', dialCode: '+254' },
  { code: 'KI', name: 'Kiribati', flag: '\u{1F1F0}\u{1F1EE}', currency: 'AUD', dialCode: '+686' },
  { code: 'XK', name: 'Kosovo', flag: '\u{1F1FD}\u{1F1F0}', currency: 'EUR', dialCode: '+383' },
  { code: 'KW', name: 'Kuwait', flag: '\u{1F1F0}\u{1F1FC}', currency: 'KWD', dialCode: '+965' },
  { code: 'KG', name: 'Kyrgyzstan', flag: '\u{1F1F0}\u{1F1EC}', currency: 'KGS', dialCode: '+996' },
  { code: 'LA', name: 'Laos', flag: '\u{1F1F1}\u{1F1E6}', currency: 'LAK', dialCode: '+856' },
  { code: 'LV', name: 'Latvia', flag: '\u{1F1F1}\u{1F1FB}', currency: 'EUR', dialCode: '+371' },
  { code: 'LB', name: 'Lebanon', flag: '\u{1F1F1}\u{1F1E7}', currency: 'LBP', dialCode: '+961' },
  { code: 'LS', name: 'Lesotho', flag: '\u{1F1F1}\u{1F1F8}', currency: 'LSL', dialCode: '+266' },
  { code: 'LR', name: 'Liberia', flag: '\u{1F1F1}\u{1F1F7}', currency: 'LRD', dialCode: '+231' },
  { code: 'LY', name: 'Libya', flag: '\u{1F1F1}\u{1F1FE}', currency: 'LYD', dialCode: '+218' },
  { code: 'LI', name: 'Liechtenstein', flag: '\u{1F1F1}\u{1F1EE}', currency: 'CHF', dialCode: '+423' },
  { code: 'LT', name: 'Lithuania', flag: '\u{1F1F1}\u{1F1F9}', currency: 'EUR', dialCode: '+370' },
  { code: 'LU', name: 'Luxembourg', flag: '\u{1F1F1}\u{1F1FA}', currency: 'EUR', dialCode: '+352' },
  { code: 'MG', name: 'Madagascar', flag: '\u{1F1F2}\u{1F1EC}', currency: 'MGA', dialCode: '+261' },
  { code: 'MW', name: 'Malawi', flag: '\u{1F1F2}\u{1F1FC}', currency: 'MWK', dialCode: '+265' },
  { code: 'MY', name: 'Malaysia', flag: '\u{1F1F2}\u{1F1FE}', currency: 'MYR', dialCode: '+60' },
  { code: 'MV', name: 'Maldives', flag: '\u{1F1F2}\u{1F1FB}', currency: 'MVR', dialCode: '+960' },
  { code: 'ML', name: 'Mali', flag: '\u{1F1F2}\u{1F1F1}', currency: 'XOF', dialCode: '+223' },
  { code: 'MT', name: 'Malta', flag: '\u{1F1F2}\u{1F1F9}', currency: 'EUR', dialCode: '+356' },
  { code: 'MH', name: 'Marshall Islands', flag: '\u{1F1F2}\u{1F1ED}', currency: 'USD', dialCode: '+692' },
  { code: 'MR', name: 'Mauritania', flag: '\u{1F1F2}\u{1F1F7}', currency: 'MRU', dialCode: '+222' },
  { code: 'MU', name: 'Mauritius', flag: '\u{1F1F2}\u{1F1FA}', currency: 'MUR', dialCode: '+230' },
  { code: 'MX', name: 'Mexico', flag: '\u{1F1F2}\u{1F1FD}', currency: 'MXN', dialCode: '+52' },
  { code: 'FM', name: 'Micronesia', flag: '\u{1F1EB}\u{1F1F2}', currency: 'USD', dialCode: '+691' },
  { code: 'MD', name: 'Moldova', flag: '\u{1F1F2}\u{1F1E9}', currency: 'MDL', dialCode: '+373' },
  { code: 'MC', name: 'Monaco', flag: '\u{1F1F2}\u{1F1E8}', currency: 'EUR', dialCode: '+377' },
  { code: 'MN', name: 'Mongolia', flag: '\u{1F1F2}\u{1F1F3}', currency: 'MNT', dialCode: '+976' },
  { code: 'ME', name: 'Montenegro', flag: '\u{1F1F2}\u{1F1EA}', currency: 'EUR', dialCode: '+382' },
  { code: 'MA', name: 'Morocco', flag: '\u{1F1F2}\u{1F1E6}', currency: 'MAD', dialCode: '+212' },
  { code: 'MZ', name: 'Mozambique', flag: '\u{1F1F2}\u{1F1FF}', currency: 'MZN', dialCode: '+258' },
  { code: 'MM', name: 'Myanmar', flag: '\u{1F1F2}\u{1F1F2}', currency: 'MMK', dialCode: '+95' },
  { code: 'NA', name: 'Namibia', flag: '\u{1F1F3}\u{1F1E6}', currency: 'NAD', dialCode: '+264' },
  { code: 'NR', name: 'Nauru', flag: '\u{1F1F3}\u{1F1F7}', currency: 'AUD', dialCode: '+674' },
  { code: 'NP', name: 'Nepal', flag: '\u{1F1F3}\u{1F1F5}', currency: 'NPR', dialCode: '+977' },
  { code: 'NL', name: 'Netherlands', flag: '\u{1F1F3}\u{1F1F1}', currency: 'EUR', dialCode: '+31' },
  { code: 'NZ', name: 'New Zealand', flag: '\u{1F1F3}\u{1F1FF}', currency: 'NZD', dialCode: '+64' },
  { code: 'NI', name: 'Nicaragua', flag: '\u{1F1F3}\u{1F1EE}', currency: 'NIO', dialCode: '+505' },
  { code: 'NE', name: 'Niger', flag: '\u{1F1F3}\u{1F1EA}', currency: 'XOF', dialCode: '+227' },
  { code: 'NG', name: 'Nigeria', flag: '\u{1F1F3}\u{1F1EC}', currency: 'NGN', dialCode: '+234' },
  { code: 'KP', name: 'North Korea', flag: '\u{1F1F0}\u{1F1F5}', currency: 'KPW', dialCode: '+850' },
  { code: 'MK', name: 'North Macedonia', flag: '\u{1F1F2}\u{1F1F0}', currency: 'MKD', dialCode: '+389' },
  { code: 'NO', name: 'Norway', flag: '\u{1F1F3}\u{1F1F4}', currency: 'NOK', dialCode: '+47' },
  { code: 'OM', name: 'Oman', flag: '\u{1F1F4}\u{1F1F2}', currency: 'OMR', dialCode: '+968' },
  { code: 'PK', name: 'Pakistan', flag: '\u{1F1F5}\u{1F1F0}', currency: 'PKR', dialCode: '+92' },
  { code: 'PW', name: 'Palau', flag: '\u{1F1F5}\u{1F1FC}', currency: 'USD', dialCode: '+680' },
  { code: 'PS', name: 'Palestine', flag: '\u{1F1F5}\u{1F1F8}', currency: 'ILS', dialCode: '+970' },
  { code: 'PA', name: 'Panama', flag: '\u{1F1F5}\u{1F1E6}', currency: 'PAB', dialCode: '+507' },
  { code: 'PG', name: 'Papua New Guinea', flag: '\u{1F1F5}\u{1F1EC}', currency: 'PGK', dialCode: '+675' },
  { code: 'PY', name: 'Paraguay', flag: '\u{1F1F5}\u{1F1FE}', currency: 'PYG', dialCode: '+595' },
  { code: 'PE', name: 'Peru', flag: '\u{1F1F5}\u{1F1EA}', currency: 'PEN', dialCode: '+51' },
  { code: 'PH', name: 'Philippines', flag: '\u{1F1F5}\u{1F1ED}', currency: 'PHP', dialCode: '+63' },
  { code: 'PL', name: 'Poland', flag: '\u{1F1F5}\u{1F1F1}', currency: 'PLN', dialCode: '+48' },
  { code: 'PT', name: 'Portugal', flag: '\u{1F1F5}\u{1F1F9}', currency: 'EUR', dialCode: '+351' },
  { code: 'QA', name: 'Qatar', flag: '\u{1F1F6}\u{1F1E6}', currency: 'QAR', dialCode: '+974' },
  { code: 'RO', name: 'Romania', flag: '\u{1F1F7}\u{1F1F4}', currency: 'RON', dialCode: '+40' },
  { code: 'RU', name: 'Russia', flag: '\u{1F1F7}\u{1F1FA}', currency: 'RUB', dialCode: '+7' },
  { code: 'RW', name: 'Rwanda', flag: '\u{1F1F7}\u{1F1FC}', currency: 'RWF', dialCode: '+250' },
  { code: 'KN', name: 'Saint Kitts and Nevis', flag: '\u{1F1F0}\u{1F1F3}', currency: 'XCD', dialCode: '+1-869' },
  { code: 'LC', name: 'Saint Lucia', flag: '\u{1F1F1}\u{1F1E8}', currency: 'XCD', dialCode: '+1-758' },
  { code: 'VC', name: 'Saint Vincent and the Grenadines', flag: '\u{1F1FB}\u{1F1E8}', currency: 'XCD', dialCode: '+1-784' },
  { code: 'WS', name: 'Samoa', flag: '\u{1F1FC}\u{1F1F8}', currency: 'WST', dialCode: '+685' },
  { code: 'SM', name: 'San Marino', flag: '\u{1F1F8}\u{1F1F2}', currency: 'EUR', dialCode: '+378' },
  { code: 'ST', name: 'São Tomé and Príncipe', flag: '\u{1F1F8}\u{1F1F9}', currency: 'STN', dialCode: '+239' },
  { code: 'SA', name: 'Saudi Arabia', flag: '\u{1F1F8}\u{1F1E6}', currency: 'SAR', dialCode: '+966' },
  { code: 'SN', name: 'Senegal', flag: '\u{1F1F8}\u{1F1F3}', currency: 'XOF', dialCode: '+221' },
  { code: 'RS', name: 'Serbia', flag: '\u{1F1F7}\u{1F1F8}', currency: 'RSD', dialCode: '+381' },
  { code: 'SC', name: 'Seychelles', flag: '\u{1F1F8}\u{1F1E8}', currency: 'SCR', dialCode: '+248' },
  { code: 'SL', name: 'Sierra Leone', flag: '\u{1F1F8}\u{1F1F1}', currency: 'SLE', dialCode: '+232' },
  { code: 'SG', name: 'Singapore', flag: '\u{1F1F8}\u{1F1EC}', currency: 'SGD', dialCode: '+65' },
  { code: 'SK', name: 'Slovakia', flag: '\u{1F1F8}\u{1F1F0}', currency: 'EUR', dialCode: '+421' },
  { code: 'SI', name: 'Slovenia', flag: '\u{1F1F8}\u{1F1EE}', currency: 'EUR', dialCode: '+386' },
  { code: 'SB', name: 'Solomon Islands', flag: '\u{1F1F8}\u{1F1E7}', currency: 'SBD', dialCode: '+677' },
  { code: 'SO', name: 'Somalia', flag: '\u{1F1F8}\u{1F1F4}', currency: 'SOS', dialCode: '+252' },
  { code: 'ZA', name: 'South Africa', flag: '\u{1F1FF}\u{1F1E6}', currency: 'ZAR', dialCode: '+27' },
  { code: 'KR', name: 'South Korea', flag: '\u{1F1F0}\u{1F1F7}', currency: 'KRW', dialCode: '+82' },
  { code: 'SS', name: 'South Sudan', flag: '\u{1F1F8}\u{1F1F8}', currency: 'SSP', dialCode: '+211' },
  { code: 'ES', name: 'Spain', flag: '\u{1F1EA}\u{1F1F8}', currency: 'EUR', dialCode: '+34' },
  { code: 'LK', name: 'Sri Lanka', flag: '\u{1F1F1}\u{1F1F0}', currency: 'LKR', dialCode: '+94' },
  { code: 'SD', name: 'Sudan', flag: '\u{1F1F8}\u{1F1E9}', currency: 'SDG', dialCode: '+249' },
  { code: 'SR', name: 'Suriname', flag: '\u{1F1F8}\u{1F1F7}', currency: 'SRD', dialCode: '+597' },
  { code: 'SE', name: 'Sweden', flag: '\u{1F1F8}\u{1F1EA}', currency: 'SEK', dialCode: '+46' },
  { code: 'CH', name: 'Switzerland', flag: '\u{1F1E8}\u{1F1ED}', currency: 'CHF', dialCode: '+41' },
  { code: 'SY', name: 'Syria', flag: '\u{1F1F8}\u{1F1FE}', currency: 'SYP', dialCode: '+963' },
  { code: 'TW', name: 'Taiwan', flag: '\u{1F1F9}\u{1F1FC}', currency: 'TWD', dialCode: '+886' },
  { code: 'TJ', name: 'Tajikistan', flag: '\u{1F1F9}\u{1F1EF}', currency: 'TJS', dialCode: '+992' },
  { code: 'TZ', name: 'Tanzania', flag: '\u{1F1F9}\u{1F1FF}', currency: 'TZS', dialCode: '+255' },
  { code: 'TH', name: 'Thailand', flag: '\u{1F1F9}\u{1F1ED}', currency: 'THB', dialCode: '+66' },
  { code: 'TL', name: 'Timor-Leste', flag: '\u{1F1F9}\u{1F1F1}', currency: 'USD', dialCode: '+670' },
  { code: 'TG', name: 'Togo', flag: '\u{1F1F9}\u{1F1EC}', currency: 'XOF', dialCode: '+228' },
  { code: 'TO', name: 'Tonga', flag: '\u{1F1F9}\u{1F1F4}', currency: 'TOP', dialCode: '+676' },
  { code: 'TT', name: 'Trinidad and Tobago', flag: '\u{1F1F9}\u{1F1F9}', currency: 'TTD', dialCode: '+1-868' },
  { code: 'TN', name: 'Tunisia', flag: '\u{1F1F9}\u{1F1F3}', currency: 'TND', dialCode: '+216' },
  { code: 'TR', name: 'Turkey', flag: '\u{1F1F9}\u{1F1F7}', currency: 'TRY', dialCode: '+90' },
  { code: 'TM', name: 'Turkmenistan', flag: '\u{1F1F9}\u{1F1F2}', currency: 'TMT', dialCode: '+993' },
  { code: 'TV', name: 'Tuvalu', flag: '\u{1F1F9}\u{1F1FB}', currency: 'AUD', dialCode: '+688' },
  { code: 'UG', name: 'Uganda', flag: '\u{1F1FA}\u{1F1EC}', currency: 'UGX', dialCode: '+256' },
  { code: 'UA', name: 'Ukraine', flag: '\u{1F1FA}\u{1F1E6}', currency: 'UAH', dialCode: '+380' },
  { code: 'AE', name: 'United Arab Emirates', flag: '\u{1F1E6}\u{1F1EA}', currency: 'AED', dialCode: '+971' },
  { code: 'GB', name: 'United Kingdom', flag: '\u{1F1EC}\u{1F1E7}', currency: 'GBP', dialCode: '+44' },
  { code: 'US', name: 'United States', flag: '\u{1F1FA}\u{1F1F8}', currency: 'USD', dialCode: '+1' },
  { code: 'UY', name: 'Uruguay', flag: '\u{1F1FA}\u{1F1FE}', currency: 'UYU', dialCode: '+598' },
  { code: 'UZ', name: 'Uzbekistan', flag: '\u{1F1FA}\u{1F1FF}', currency: 'UZS', dialCode: '+998' },
  { code: 'VU', name: 'Vanuatu', flag: '\u{1F1FB}\u{1F1FA}', currency: 'VUV', dialCode: '+678' },
  { code: 'VA', name: 'Vatican City', flag: '\u{1F1FB}\u{1F1E6}', currency: 'EUR', dialCode: '+379' },
  { code: 'VE', name: 'Venezuela', flag: '\u{1F1FB}\u{1F1EA}', currency: 'VES', dialCode: '+58' },
  { code: 'VN', name: 'Vietnam', flag: '\u{1F1FB}\u{1F1F3}', currency: 'VND', dialCode: '+84' },
  { code: 'YE', name: 'Yemen', flag: '\u{1F1FE}\u{1F1EA}', currency: 'YER', dialCode: '+967' },
  { code: 'ZM', name: 'Zambia', flag: '\u{1F1FF}\u{1F1F2}', currency: 'ZMW', dialCode: '+260' },
  { code: 'ZW', name: 'Zimbabwe', flag: '\u{1F1FF}\u{1F1FC}', currency: 'ZWL', dialCode: '+263' },
] as const;

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }
}

export function daysUntil(dateStr: string): number {
  if (!dateStr) return Infinity;
  return differenceInDays(parseISO(dateStr), new Date());
}

export function isExpired(dateStr: string): boolean {
  if (!dateStr) return false;
  return isBefore(parseISO(dateStr), new Date());
}

export function isExpiringSoon(dateStr: string, days: number = 30): boolean {
  if (!dateStr) return false;
  const d = daysUntil(dateStr);
  return d >= 0 && d <= days;
}

export function calculateStraightLineDepreciation(asset: Asset): DepreciationRecord[] {
  const records: DepreciationRecord[] = [];
  const annualDepreciation = (asset.purchaseCost - asset.salvageValue) / asset.usefulLifeYears;
  let accumulated = 0;

  for (let year = 0; year < asset.usefulLifeYears; year++) {
    accumulated += annualDepreciation;
    const purchaseYear = new Date(asset.purchaseDate).getFullYear();
    records.push({
      id: `dep-calc-${asset.id}-${year}`,
      assetId: asset.id,
      year: purchaseYear + year,
      depreciationAmount: Math.round(annualDepreciation * 100) / 100,
      accumulatedDepreciation: Math.round(accumulated * 100) / 100,
      bookValue: Math.round((asset.purchaseCost - accumulated) * 100) / 100,
      method: 'straight_line',
      date: `${purchaseYear + year}-12-31`,
      organizationId: asset.organizationId,
    });
  }
  return records;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    available: 'bg-green-100 text-green-800',
    allocated: 'bg-blue-100 text-blue-800',
    under_maintenance: 'bg-yellow-100 text-yellow-800',
    retired: 'bg-gray-100 text-gray-600',
    disposed: 'bg-red-100 text-red-800',
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    active: 'bg-blue-100 text-blue-800',
    returned: 'bg-gray-100 text-gray-600',
    scheduled: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    overdue: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-600',
    assigned: 'bg-purple-100 text-purple-800',
    requested: 'bg-yellow-100 text-yellow-800',
    ordered: 'bg-blue-100 text-blue-800',
    received: 'bg-green-100 text-green-800',
    low: 'bg-blue-100 text-blue-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    low: 'bg-blue-100 text-blue-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800',
  };
  return colors[priority] || 'bg-gray-100 text-gray-800';
}

export function exportToCSV(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(h => {
      const val = row[h];
      const str = val === null || val === undefined ? '' : String(val);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function classNames(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
