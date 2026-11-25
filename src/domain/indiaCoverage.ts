import { MAHARERA_PORTAL } from './buyerEvidence';
import { puneSources } from './puneBuyerPilot';

export const statesAndTerritories = [
  ['andaman-nicobar', 'Andaman and Nicobar Islands'], ['andhra-pradesh', 'Andhra Pradesh'],
  ['arunachal-pradesh', 'Arunachal Pradesh'], ['assam', 'Assam'], ['bihar', 'Bihar'],
  ['chandigarh', 'Chandigarh'], ['chhattisgarh', 'Chhattisgarh'],
  ['dadra-nagar-haveli-daman-diu', 'Dadra and Nagar Haveli and Daman and Diu'],
  ['delhi', 'Delhi (NCT)'], ['goa', 'Goa'], ['gujarat', 'Gujarat'], ['haryana', 'Haryana'],
  ['himachal-pradesh', 'Himachal Pradesh'], ['jammu-kashmir', 'Jammu and Kashmir'],
  ['jharkhand', 'Jharkhand'], ['karnataka', 'Karnataka'], ['kerala', 'Kerala'],
  ['ladakh', 'Ladakh'], ['lakshadweep', 'Lakshadweep'], ['madhya-pradesh', 'Madhya Pradesh'],
  ['maharashtra', 'Maharashtra'], ['manipur', 'Manipur'], ['meghalaya', 'Meghalaya'],
  ['mizoram', 'Mizoram'], ['nagaland', 'Nagaland'], ['odisha', 'Odisha'], ['puducherry', 'Puducherry'],
  ['punjab', 'Punjab'], ['rajasthan', 'Rajasthan'], ['sikkim', 'Sikkim'], ['tamil-nadu', 'Tamil Nadu'],
  ['telangana', 'Telangana'], ['tripura', 'Tripura'], ['uttar-pradesh', 'Uttar Pradesh'],
  ['uttarakhand', 'Uttarakhand'], ['west-bengal', 'West Bengal'],
] as const;

export type Jurisdiction = typeof statesAndTerritories[number][0];
export type OfficialSource = { name: string; issuer: string; href: string };
type CitySource = OfficialSource & { city: string; coverage: 'plan-source' | 'authority-directory' };
type Coverage = { planning?: CitySource; rera?: OfficialSource; land?: OfficialSource; cadastral?: OfficialSource };

export const nationalRera = {
  name: 'National RERA authority directory', issuer: 'Ministry of Housing and Urban Affairs',
  href: 'https://www.mohua.gov.in/documents/acts-and-policies/rera-YDM4EzMtQWa',
};
export const nationalLand = {
  name: 'Digital India Land Records Modernization Programme', issuer: 'Department of Land Resources',
  href: 'https://dolr.gov.in/en/document-category/program-dilrmp/',
};

const coverage: Partial<Record<Jurisdiction, Coverage>> = {
  maharashtra: {
    planning: { ...puneSources.planning, city: 'Pune metropolitan region (PMRDA)', coverage: 'plan-source' },
    rera: { name: 'Official MahaRERA portal', issuer: 'Maharashtra Real Estate Regulatory Authority', href: MAHARERA_PORTAL },
    land: puneSources.land, cadastral: puneSources.cadastral,
  },
  karnataka: {
    planning: { city: 'Bengaluru', coverage: 'authority-directory', name: 'Bangalore Development Authority government directory entry', issuer: 'Bengaluru Urban District', href: 'https://bengaluruurban.nic.in/en/department/bangalore-development-authority/' },
    land: { name: 'Karnataka land records starting point', issuer: 'Bengaluru Urban District', href: 'https://bengaluruurban.nic.in/en/service/land-records/' },
  },
  telangana: {
    planning: { city: 'Hyderabad metropolitan region (HMDA)', coverage: 'plan-source', name: 'HMDA Master Planning 2031', issuer: 'Hyderabad Metropolitan Development Authority', href: 'https://www.hmda.gov.in/master-planning-2031/' },
    rera: { name: 'Telangana RERA project search', issuer: 'Telangana Real Estate Regulatory Authority', href: 'https://rerait.telangana.gov.in/SearchList/Search' },
    land: { name: 'Bhu Bharati', issuer: 'Government of Telangana', href: 'https://bhubharati.telangana.gov.in/' },
  },
  delhi: {
    planning: { city: 'Delhi (NCT)', coverage: 'plan-source', name: 'Delhi Master Plan index', issuer: 'Delhi Development Authority', href: 'https://dda.gov.in/master-plan' },
    land: { name: 'Delhi land records starting point', issuer: 'New Delhi District, Government of NCT of Delhi', href: 'https://dmnewdelhi.delhi.gov.in/service/land-records/' },
  },
  'tamil-nadu': {
    planning: { city: 'Chennai metropolitan area (CMDA)', coverage: 'plan-source', name: 'Second Master Plan variations', issuer: 'Chennai Metropolitan Development Authority', href: 'https://cmdachennai.gov.in/pdfs/VariationApprovedSMP.pdf' },
    land: { name: 'Tamil Nadu land services starting point', issuer: 'Chennai District', href: 'https://chennai.nic.in/service/eservices-anytime-anywhere-land/' },
  },
};

export function resolveJurisdiction(value: unknown) {
  const selected = statesAndTerritories.find(([key]) => key === value);
  if (!selected) return null;
  return { key: selected[0], name: selected[1], ...coverage[selected[0]] };
}

export function buyerPath(kind: 'flat' | 'plot', jurisdiction: Jurisdiction | undefined) {
  return `/buyer-check${kind === 'plot' ? '/plot' : ''}${jurisdiction ? `?jurisdiction=${jurisdiction}` : ''}`;
}
