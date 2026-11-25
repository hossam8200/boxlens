// Port + country reference data for the dashboard filter autocomplete.
// Ports are a curated UN/LOCODE directory (ported from the classic app's
// FACILITIES list); countries are ISO 3166-1 alpha-2 → name for the major
// trading nations the platform covers. Both feed the searchable autocomplete
// on the dashboards filter bar — selecting one drives the widget fetch.

export interface PortEntry {
  /** UN/LOCODE (also the filter `port` value), e.g. "DEHAM". */
  code: string;
  name: string;
  country: string;
}

export const PORTS: readonly PortEntry[] = Object.freeze([
  { code: 'DEHAM', name: 'Hamburg', country: 'DE' },
  { code: 'DEBRV', name: 'Bremerhaven', country: 'DE' },
  { code: 'DEDUS', name: 'Hamburg Depot', country: 'DE' },
  { code: 'NLRTM', name: 'Rotterdam', country: 'NL' },
  { code: 'BEANR', name: 'Antwerp-Bruges', country: 'BE' },
  { code: 'GBFXT', name: 'Felixstowe', country: 'GB' },
  { code: 'FRMRS', name: 'Marseille (Fos)', country: 'FR' },
  { code: 'ESBCN', name: 'Barcelona', country: 'ES' },
  { code: 'AEJEA', name: 'Jebel Ali', country: 'AE' },
  { code: 'AEDXB', name: 'Jebel Ali Depot', country: 'AE' },
  { code: 'SGSIN', name: 'Singapore (PSA)', country: 'SG' },
  { code: 'SGTPW', name: 'Tuas Depot', country: 'SG' },
  { code: 'CNSHA', name: 'Shanghai Yangshan', country: 'CN' },
  { code: 'CNYTN', name: 'Yantian (Shenzhen)', country: 'CN' },
  { code: 'CNNGB', name: 'Ningbo-Zhoushan', country: 'CN' },
  { code: 'CNXMN', name: 'Xiamen', country: 'CN' },
  { code: 'CNTXG', name: 'Tianjin Xingang', country: 'CN' },
  { code: 'HKHKG', name: 'Hong Kong', country: 'HK' },
  { code: 'KRPUS', name: 'Busan New Port', country: 'KR' },
  { code: 'JPYOK', name: 'Yokohama', country: 'JP' },
  { code: 'JPKOB', name: 'Kobe', country: 'JP' },
  { code: 'JPTYO', name: 'Tokyo', country: 'JP' },
  { code: 'USLAX', name: 'Los Angeles', country: 'US' },
  { code: 'USLGB', name: 'Long Beach', country: 'US' },
  { code: 'USNYC', name: 'New York & New Jersey', country: 'US' },
  { code: 'USOAK', name: 'Oakland', country: 'US' },
  { code: 'USSEA', name: 'Seattle', country: 'US' },
  { code: 'USMIA', name: 'Miami', country: 'US' },
  { code: 'CAVAN', name: 'Vancouver', country: 'CA' },
  { code: 'PABLB', name: 'Balboa (Panama)', country: 'PA' },
  { code: 'BRSSZ', name: 'Santos', country: 'BR' },
  { code: 'ARBUE', name: 'Buenos Aires', country: 'AR' },
  { code: 'INMUN', name: 'JNPT (Nhava Sheva)', country: 'IN' },
  { code: 'INMAA', name: 'Chennai (Madras)', country: 'IN' },
  { code: 'LKCMB', name: 'Colombo', country: 'LK' },
  { code: 'MYPKG', name: 'Port Klang', country: 'MY' },
  { code: 'THBKK', name: 'Bangkok (Klong Toey)', country: 'TH' },
  { code: 'VNSGN', name: 'Ho Chi Minh City (Cat Lai)', country: 'VN' },
  { code: 'PHMNL', name: 'Manila (MICP)', country: 'PH' },
  { code: 'IDJKT', name: 'Tanjung Priok (Jakarta)', country: 'ID' },
  { code: 'AUMEL', name: 'Melbourne', country: 'AU' },
  { code: 'AUSYD', name: 'Sydney', country: 'AU' },
  { code: 'NZAKL', name: 'Auckland', country: 'NZ' },
  { code: 'EGPSD', name: 'Port Said', country: 'EG' },
  { code: 'RUVLK', name: 'Vladivostok', country: 'RU' },
  { code: 'ILHFA', name: 'Haifa', country: 'IL' },
]);

/** ISO 3166-1 alpha-2 → country name (major trading nations covered by the platform). */
export const COUNTRIES: Readonly<Record<string, string>> = Object.freeze({
  AE: 'United Arab Emirates', AR: 'Argentina', AU: 'Australia', BE: 'Belgium',
  BR: 'Brazil', CA: 'Canada', CH: 'Switzerland', CL: 'Chile', CN: 'China',
  DE: 'Germany', DK: 'Denmark', EG: 'Egypt', ES: 'Spain', FR: 'France',
  GB: 'United Kingdom', HK: 'Hong Kong SAR', ID: 'Indonesia', IL: 'Israel',
  IN: 'India', JP: 'Japan', KR: 'South Korea', LK: 'Sri Lanka', MY: 'Malaysia',
  NL: 'Netherlands', NZ: 'New Zealand', PA: 'Panama', PH: 'Philippines',
  RU: 'Russia', SG: 'Singapore', TH: 'Thailand', TW: 'Taiwan', US: 'United States',
  VN: 'Vietnam', BM: 'Bermuda',
});

/** Autocomplete items for the port field: label = "Port (CODE)". */
export const PORT_ITEMS: readonly { value: string; label: string }[] = Object.freeze(
  PORTS.map((p) => ({ value: p.code, label: `${p.name} (${p.code})` })),
);

/** Autocomplete items for the country field: label = "Country (ISO2)". */
export const COUNTRY_ITEMS: readonly { value: string; label: string }[] = Object.freeze(
  Object.entries(COUNTRIES)
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([code, name]) => ({ value: code, label: `${name} (${code})` })),
);
