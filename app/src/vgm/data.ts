// Reference data for the native VGM tool — ported from the classic single-file
// app (classic.html lines 348–396). These are the BIC owner-code register
// (curated subset of bic-boxtech.org), the ISO 6346 size/type codes, and a
// sample container technical-records set used by the container lookup.
//
// The algorithms themselves (ISO 6346 check digit, VGM Method 2) live in
// @boxlens/core and are imported directly by the VGM route — not duplicated here.
import type { ContainerSpec } from '@boxlens/core';

export interface OwnerRecord {
  code: string;
  name: string;
  country: string;
  city: string;
  contact: string;
}

/** Curated subset of the public BIC owner-code register (bic-boxtech.org). */
export const OWNERS: Readonly<Record<string, OwnerRecord>> = Object.freeze({
  CSQU: { code: 'CSQU', name: 'CSAV (Compañía Sud Americana de Vapores)', country: 'CL', city: 'Valparaíso', contact: 'www.csav.com' },
  MSKU: { code: 'MSKU', name: 'Mediterranean Shipping Company S.A.', country: 'CH', city: 'Geneva', contact: 'www.msc.com' },
  MSCU: { code: 'MSCU', name: 'Mediterranean Shipping Company S.A.', country: 'CH', city: 'Geneva', contact: 'www.msc.com' },
  TCNU: { code: 'TCNU', name: 'Tropical Container Leasing', country: 'US', city: 'Miami', contact: 'www.tcl.com' },
  ONEU: { code: 'ONEU', name: 'Ocean Network Express', country: 'SG', city: 'Singapore', contact: 'www.one-line.com' },
  CMAU: { code: 'CMAU', name: 'CMA CGM S.A.', country: 'FR', city: 'Marseille', contact: 'www.cma-cgm.com' },
  MAEU: { code: 'MAEU', name: 'A.P. Moller-Maersk', country: 'DK', city: 'Copenhagen', contact: 'www.maersk.com' },
  CCLU: { code: 'CCLU', name: 'China COSCO Shipping', country: 'CN', city: 'Shanghai', contact: 'www.cosco.com' },
  EMCU: { code: 'EMCU', name: 'Emirates Logistics', country: 'AE', city: 'Dubai', contact: 'www.emirates-logistics.ae' },
  HLCU: { code: 'HLCU', name: 'Hapag-Lloyd AG', country: 'DE', city: 'Hamburg', contact: 'www.hapag-lloyd.com' },
  YMLU: { code: 'YMLU', name: 'Yang Ming Marine Transport', country: 'TW', city: 'Keelung', contact: 'www.yangming.com' },
  MRKU: { code: 'MRKU', name: 'A.P. Moller-Maersk', country: 'DK', city: 'Copenhagen', contact: 'www.maersk.com' },
  CGMU: { code: 'CGMU', name: 'CMA CGM S.A.', country: 'FR', city: 'Marseille', contact: 'www.cma-cgm.com' },
  OOCU: { code: 'OOCU', name: 'Orient Overseas Container Line (OOCL)', country: 'HK', city: 'Hong Kong', contact: 'www.oocl.com' },
  COSU: { code: 'COSU', name: 'China COSCO Shipping', country: 'CN', city: 'Shanghai', contact: 'lines.coscoshipping.com' },
  EISU: { code: 'EISU', name: 'Evergreen Marine Corporation', country: 'TW', city: 'Taipei', contact: 'www.evergreen-line.com' },
  ZIMU: { code: 'ZIMU', name: 'ZIM Integrated Shipping Services', country: 'IL', city: 'Haifa', contact: 'www.zim.com' },
  ZCSU: { code: 'ZCSU', name: 'Zim Container Service (ZIM)', country: 'IL', city: 'Haifa', contact: 'www.zim.com' },
  MOLU: { code: 'MOLU', name: 'Mitsui O.S.K. Lines (MOL)', country: 'JP', city: 'Tokyo', contact: 'www.mol.co.jp' },
  NYKU: { code: 'NYKU', name: 'Nippon Yusen Kaisha (NYK Line)', country: 'JP', city: 'Tokyo', contact: 'www.nyk.com' },
  KMTU: { code: 'KMTU', name: 'Kawasaki Kisen Kaisha (K Line)', country: 'JP', city: 'Tokyo', contact: 'www.kline.co.jp' },
  PILU: { code: 'PILU', name: 'Pacific International Lines (PIL)', country: 'SG', city: 'Singapore', contact: 'www.pilship.com' },
  UACU: { code: 'UACU', name: 'UASC (now Hapag-Lloyd)', country: 'DE', city: 'Hamburg', contact: 'www.hapag-lloyd.com' },
  TEXT: { code: 'TEXT', name: 'Textainer Equipment Management (lessor)', country: 'BM', city: 'Hamilton', contact: 'www.textainer.com' },
  TCLU: { code: 'TCLU', name: 'Triton Container International (lessor)', country: 'US', city: 'San Francisco', contact: 'www.tritoncontainer.com' },
});

/** ISO 6346 size/type codes (curated). */
export const SIZE_TYPES: Readonly<Record<string, string>> = Object.freeze({
  '22G1': '20ft General Purpose (8\'6")', '22G0': '20ft General Purpose (8\'6")', '25G1': '20ft General Purpose (9\'6")',
  '42G1': '40ft General Purpose (8\'6")', '45G1': '40ft General Purpose (9\'6") High Cube', '44G1': '40ft General Purpose (9\'6") High Cube',
  '22T1': '20ft Tank', '27T1': '20ft Tank', '25T1': '20ft Tank',
  '22R1': '20ft Reefer', '45R1': '40ft Reefer High Cube', '42R1': '40ft Reefer',
  '22P1': '20ft Flatrack', '42P1': '40ft Flatrack', '22V1': '20ft Ventilated', '42V1': '40ft Ventilated',
  'L5G1': '45ft General Purpose High Cube', '45G0': '40ft High Cube',
});

/** Sample container technical records (BIC BoxTech fixtures). */
export const CONTAINERS: Readonly<Record<string, ContainerSpec>> = Object.freeze({
  CSQU3054383: { sizeType: '42G1', tare: 3700, maxGross: 30480, maxPayload: 26780, maxStacking: 192000, manufacturer: 'CIMC', csc: { plate: 'CSC-ACE-U', nextInspection: '2027-04', approved: true }, special: null, source: 'BIC BoxTech', fetchedAt: '2026-11-22', quality: 'ok' },
  MSCU6639870: { sizeType: '42G1', tare: 3700, maxGross: 30480, maxPayload: 26780, maxStacking: 192000, manufacturer: 'CIMC', csc: { plate: 'CSC-ACE-U', nextInspection: '2027-04', approved: true }, special: null, source: 'BIC BoxTech', fetchedAt: '2026-11-20', quality: 'ok' },
  MSKU1234565: { sizeType: '22G1', tare: 2200, maxGross: 30480, maxPayload: 28280, maxStacking: 192000, manufacturer: 'DongFang', csc: { plate: 'CSC-ACE-U', nextInspection: '2026-09', approved: true }, special: null, source: 'BIC BoxTech', fetchedAt: '2026-11-18', quality: 'ok' },
  TCNU4852000: { sizeType: '45R1', tare: 4130, maxGross: 34000, maxPayload: 29870, maxStacking: 192000, manufacturer: 'Mitsubishi', csc: { plate: 'CSC-ACE-U', nextInspection: '2028-01', approved: true }, special: { type: 'reefer', setpointTemp: '-18°C', humidity: '65%' }, source: 'BIC BoxTech', fetchedAt: '2026-11-22', quality: 'ok' },
  ONEU5678907: { sizeType: '22T1', tare: 3650, maxGross: 30480, maxPayload: 26830, maxStacking: 150000, manufacturer: 'Welfit Odegaard', csc: { plate: 'CSC-ACE-U', nextInspection: '2027-11', approved: true }, special: { type: 'tank', testPressure: '4.5 bar', lastTest: '2025-03' }, source: 'BIC BoxTech', fetchedAt: '2026-11-21', quality: 'ok' },
  CMAU3456787: { sizeType: '42G1', tare: 3850, maxGross: 34800, maxPayload: 30950, maxStacking: 192000, manufacturer: 'CIMC', csc: { plate: 'CSC-ACE-U', nextInspection: '2026-02', approved: false }, special: null, source: 'BIC BoxTech', fetchedAt: '2026-10-15', quality: 'stale' },
  MAEU1234567: { sizeType: '45G1', tare: 3970, maxGross: 34800, maxPayload: 30830, maxStacking: 192000, manufacturer: 'Singamas', csc: { plate: 'CSC-ACE-U', nextInspection: '2029-06', approved: true }, special: { type: 'highcube' }, source: 'BIC BoxTech', fetchedAt: '2026-11-22', quality: 'ok' },
  CCLU9876547: { sizeType: '22G1', tare: 2300, maxGross: 30480, maxPayload: 28180, maxStacking: 192000, manufacturer: 'CIMC', csc: { plate: 'CSC-ACE-U', nextInspection: '2027-08', approved: true }, special: null, source: 'BIC BoxTech', fetchedAt: '2026-11-19', quality: 'ok' },
  EMCU1112229: { sizeType: '42P1', tare: 5200, maxGross: 45000, maxPayload: 39800, maxStacking: 150000, manufacturer: 'Mitsubishi', csc: { plate: 'CSC-ACE-U', nextInspection: '2027-12', approved: true }, special: { type: 'flatrack', collapsible: true }, source: 'BIC BoxTech', fetchedAt: '2026-11-23', quality: 'ok' },
  HLCU7654320: { sizeType: '42G1', tare: 3880, maxGross: 34800, maxPayload: 30920, maxStacking: 192000, manufacturer: 'CIMC', csc: { plate: 'CSC-ACE-U', nextInspection: '2026-05', approved: false }, special: null, source: 'BIC BoxTech', fetchedAt: '2026-09-01', quality: 'stale' },
  YMLU3344554: { sizeType: '42R1', tare: 4250, maxGross: 34000, maxPayload: 29750, maxStacking: 192000, manufacturer: 'Mitsubishi', csc: { plate: 'CSC-ACE-U', nextInspection: '2028-07', approved: true }, special: { type: 'reefer', setpointTemp: '2°C' }, source: 'BIC BoxTech', fetchedAt: '2026-11-22', quality: 'ok' },
});

export const SAMPLE_CONTAINERS: readonly string[] = Object.freeze([
  'CSQU3054383', 'TCNU4852000', 'ONEU5678907', 'CMAU3456787 (stale)', 'MSCU6639871 (invalid)',
]);
