// World data for RED FLAG: Port of Entry.
// All companies, people, ships and auditors are FICTIONAL. Real regions and regulations are used as flavour only.

// ---------------------------------------------------------------- regions
// highRisk regions are the rulebook's "listed" regions (forced_labour tell).
export const REGIONS = {
  // --- listed high-risk regions
  xuar:        { id: 'xuar', name: 'Xinjiang (XUAR)', country: 'China', lat: 43.8, lon: 87.6, highRisk: true,
                 note: 'Listed region: state labour-transfer programmes; UFLPA rebuttable presumption applies.' },
  kolwezi_asm: { id: 'kolwezi_asm', name: 'Lualaba artisanal cobalt zone', country: 'DR Congo', lat: -10.72, lon: 25.47, highRisk: true,
                 note: 'Listed region: artisanal cobalt digging with documented child and forced labour risks.' },
  kivu_asm:    { id: 'kivu_asm', name: 'South Kivu artisanal mines', country: 'DR Congo', lat: -2.5, lon: 28.86, highRisk: true,
                 note: 'Listed region: artisanal tin/tantalum sites; armed-group control and forced labour documented.' },
  // --- production regions (not listed)
  katanga_ind: { id: 'katanga_ind', name: 'Haut-Katanga industrial mine', country: 'DR Congo', lat: -11.66, lon: 27.48 },
  lubumbashi:  { id: 'lubumbashi', name: 'Lubumbashi', country: 'DR Congo', lat: -11.68, lon: 27.5 },
  wa:          { id: 'wa', name: 'Western Australia (Pilbara)', country: 'Australia', lat: -21.0, lon: 118.9 },
  porthedland: { id: 'porthedland', name: 'Port Hedland', country: 'Australia', lat: -20.31, lon: 118.58 },
  tasmania:    { id: 'tasmania', name: 'Tasmania', country: 'Australia', lat: -41.9, lon: 145.5 },
  atacama:     { id: 'atacama', name: 'Atacama (Antofagasta)', country: 'Chile', lat: -23.65, lon: -70.4 },
  jiangxi:     { id: 'jiangxi', name: 'Jiangxi (Yichun)', country: 'China', lat: 27.8, lon: 114.4 },
  jiangsu:     { id: 'jiangsu', name: 'Jiangsu (Changzhou)', country: 'China', lat: 31.8, lon: 119.97 },
  guangdong:   { id: 'guangdong', name: 'Guangdong (Shenzhen)', country: 'China', lat: 22.54, lon: 114.06 },
  zhejiang:    { id: 'zhejiang', name: 'Zhejiang (Ningbo)', country: 'China', lat: 29.87, lon: 121.54 },
  sichuan:     { id: 'sichuan', name: 'Sichuan (Leshan)', country: 'China', lat: 29.55, lon: 103.77 },
  innermongolia:{ id: 'innermongolia', name: 'Inner Mongolia (Baotou)', country: 'China', lat: 40.66, lon: 109.84 },
  shandong:    { id: 'shandong', name: 'Shandong (Qingdao)', country: 'China', lat: 36.07, lon: 120.38 },
  shanghai:    { id: 'shanghai', name: 'Shanghai', country: 'China', lat: 31.23, lon: 121.47 },
  sulawesi:    { id: 'sulawesi', name: 'Central Sulawesi (Morowali)', country: 'Indonesia', lat: -2.83, lon: 122.17 },
  jakarta:     { id: 'jakarta', name: 'Jakarta (Tanjung Priok)', country: 'Indonesia', lat: -6.1, lon: 106.88 },
  ontario:     { id: 'ontario', name: 'Ontario (Sudbury)', country: 'Canada', lat: 46.49, lon: -80.99 },
  quebec:      { id: 'quebec', name: 'Québec (Saguenay)', country: 'Canada', lat: 48.43, lon: -71.07 },
  montreal:    { id: 'montreal', name: 'Montréal', country: 'Canada', lat: 45.5, lon: -73.55 },
  norway:      { id: 'norway', name: 'Vestland (Årdal)', country: 'Norway', lat: 61.24, lon: 7.7 },
  gujarat:     { id: 'gujarat', name: 'Gujarat', country: 'India', lat: 22.3, lon: 70.8 },
  tiruppur:    { id: 'tiruppur', name: 'Tamil Nadu (Tiruppur)', country: 'India', lat: 11.1, lon: 77.34 },
  chennai:     { id: 'chennai', name: 'Tamil Nadu (Chennai)', country: 'India', lat: 13.08, lon: 80.27 },
  andhra:      { id: 'andhra', name: 'Andhra Pradesh', country: 'India', lat: 16.5, lon: 80.64 },
  texas:       { id: 'texas', name: 'Texas (Lubbock)', country: 'United States', lat: 33.58, lon: -101.85 },
  louisiana:   { id: 'louisiana', name: 'Louisiana (Lake Charles)', country: 'United States', lat: 30.23, lon: -93.22 },
  california:  { id: 'california', name: 'California (Central Valley)', country: 'United States', lat: 36.74, lon: -119.78 },
  oakland:     { id: 'oakland', name: 'California (Oakland)', country: 'United States', lat: 37.8, lon: -122.27 },
  dhaka:       { id: 'dhaka', name: 'Dhaka (Gazipur)', country: 'Bangladesh', lat: 24.0, lon: 90.42 },
  chattogram:  { id: 'chattogram', name: 'Chattogram', country: 'Bangladesh', lat: 22.33, lon: 91.83 },
  izmir:       { id: 'izmir', name: 'İzmir', country: 'Türkiye', lat: 38.42, lon: 27.14 },
  emilia:      { id: 'emilia', name: 'Emilia-Romagna (Parma)', country: 'Italy', lat: 44.8, lon: 10.33 },
  genoa:       { id: 'genoa', name: 'Liguria (Genoa)', country: 'Italy', lat: 44.4, lon: 8.93 },
  extremadura: { id: 'extremadura', name: 'Extremadura (Badajoz)', country: 'Spain', lat: 38.88, lon: -6.97 },
  valencia:    { id: 'valencia', name: 'Valencia', country: 'Spain', lat: 39.45, lon: -0.32 },
  guayas:      { id: 'guayas', name: 'Guayas (Guayaquil)', country: 'Ecuador', lat: -2.19, lon: -79.89 },
  mekong:      { id: 'mekong', name: 'Mekong Delta (Cà Mau)', country: 'Vietnam', lat: 9.18, lon: 105.15 },
  bacninh:     { id: 'bacninh', name: 'Bắc Ninh', country: 'Vietnam', lat: 21.19, lon: 106.07 },
  haiphong:    { id: 'haiphong', name: 'Hải Phòng', country: 'Vietnam', lat: 20.86, lon: 106.68 },
  chungcheong: { id: 'chungcheong', name: 'Chungcheong (Cheongju)', country: 'South Korea', lat: 36.64, lon: 127.49 },
  busan:       { id: 'busan', name: 'Busan', country: 'South Korea', lat: 35.1, lon: 129.04 },
  // --- trade hubs (used for transit warehouses — legal — and for transshipment repackaging — not)
  penang:      { id: 'penang', name: 'Penang', country: 'Malaysia', lat: 5.41, lon: 100.33 },
  portklang:   { id: 'portklang', name: 'Port Klang', country: 'Malaysia', lat: 3.0, lon: 101.39 },
  laemchabang: { id: 'laemchabang', name: 'Laem Chabang', country: 'Thailand', lat: 13.08, lon: 100.88 },
  jebelali:    { id: 'jebelali', name: 'Jebel Ali', country: 'United Arab Emirates', lat: 25.01, lon: 55.06 },
  mersin:      { id: 'mersin', name: 'Mersin', country: 'Türkiye', lat: 36.8, lon: 34.63 },
  manzanillo:  { id: 'manzanillo', name: 'Manzanillo', country: 'Mexico', lat: 19.05, lon: -104.31 },
  singapore:   { id: 'singapore', name: 'Singapore', country: 'Singapore', lat: 1.26, lon: 103.84 },
  rotterdam:   { id: 'rotterdam', name: 'Rotterdam', country: 'Netherlands', lat: 51.95, lon: 4.14 },
};

export const HIGH_RISK_REGIONS = Object.values(REGIONS).filter(r => r.highRisk).map(r => r.name);

// Export port per country (the "Exporter" hop).
export const EXPORT_PORTS = {
  'China': ['shanghai', 'zhejiang', 'guangdong'], 'DR Congo': ['lubumbashi'], 'Australia': ['porthedland'],
  'Chile': ['atacama'], 'Indonesia': ['jakarta'], 'Canada': ['montreal'], 'Norway': ['norway'], 'India': ['chennai'],
  'United States': ['oakland'], 'Bangladesh': ['chattogram'], 'Türkiye': ['izmir', 'mersin'], 'Italy': ['genoa'],
  'Spain': ['valencia'], 'Ecuador': ['guayas'], 'Vietnam': ['haiphong'], 'South Korea': ['busan'],
  'Malaysia': ['portklang'], 'Thailand': ['laemchabang'], 'United Arab Emirates': ['jebelali'], 'Mexico': ['manzanillo'],
};
// Third-country hubs used for transshipment (Repackaging hop) and legal transit (Warehouse hop).
export const TRANSSHIP_HUBS = ['portklang', 'penang', 'haiphong', 'laemchabang', 'jebelali', 'mersin', 'manzanillo'];
export const TRANSIT_HUBS = ['singapore', 'rotterdam', 'jebelali', 'portklang'];

// ---------------------------------------------------------------- HS table
// HS chapter (first 2 digits) → product family. The rulebook shows this table.
export const HS_TABLE = {
  '03': 'Fish & crustaceans',
  '16': 'Prepared meat & fish',
  '20': 'Prepared vegetables & fruit',
  '21': 'Sauces & misc. food preparations',
  '25': 'Salt, stone & mineral substances',
  '26': 'Ores, slag & ash',
  '28': 'Inorganic chemicals',
  '38': 'Misc. chemical products',
  '39': 'Plastics',
  '44': 'Wood',
  '52': 'Cotton (fibre, yarn, fabric)',
  '61': 'Apparel, knitted',
  '62': 'Apparel, woven',
  '63': 'Other made-up textiles',
  '73': 'Iron & steel articles',
  '75': 'Nickel',
  '76': 'Aluminium',
  '83': 'Misc. base-metal articles',
  '84': 'Machinery & computers',
  '85': 'Electrical machinery & electronics',
};
export const hsChapter = (code) => String(code || '').replace(/\D/g, '').slice(0, 2).padStart(2, '0');
export const hsFamily = (code) => HS_TABLE[hsChapter(code)] || 'Unknown chapter';

// ---------------------------------------------------------------- products
// paths: honest production paths (region ids per step). riskPaths: same steps but through a listed region.
// mislabelAs: plausible wrong HS codes from a DIFFERENT chapter (hs_mislabel tactic).
export const PRODUCTS = [
  { id: 'li_cells', name: 'Lithium-ion battery cells', hs: '8507.60', unitLabel: 'pallets', unitWeightKg: 450, marketPrice: 9800,
    batteryMineral: 'lithium', units: [30, 160], steps: ['Mine', 'Refinery', 'Factory'],
    paths: [['wa', 'jiangxi', 'jiangsu'], ['atacama', 'chungcheong', 'chungcheong'], ['wa', 'sichuan', 'guangdong']],
    riskPaths: [['kolwezi_asm', 'jiangxi', 'jiangsu'], ['wa', 'xuar', 'jiangsu']],
    mislabelAs: ['3824.99', '8473.30'] },
  { id: 'li_carbonate', name: 'Lithium carbonate', hs: '2836.91', unitLabel: 'bulk bags', unitWeightKg: 500, marketPrice: 5600,
    batteryMineral: 'lithium', units: [40, 240], steps: ['Mine', 'Refinery'],
    paths: [['atacama', 'atacama'], ['wa', 'jiangxi'], ['wa', 'sichuan']],
    riskPaths: [['wa', 'xuar']],
    mislabelAs: ['2530.90', '3824.99'] },
  { id: 'co_hydroxide', name: 'Cobalt hydroxide', hs: '2822.00', unitLabel: 'bulk bags', unitWeightKg: 1000, marketPrice: 9400,
    batteryMineral: 'cobalt', units: [30, 180], steps: ['Mine', 'Refinery'],
    paths: [['katanga_ind', 'katanga_ind']],
    riskPaths: [['kolwezi_asm', 'katanga_ind']],
    mislabelAs: ['2620.99', '2605.00'] },
  { id: 'ni_matte', name: 'Nickel matte', hs: '7501.10', unitLabel: 'bulk bags', unitWeightKg: 1000, marketPrice: 14200,
    batteryMineral: 'nickel', units: [30, 160], steps: ['Mine', 'Smelter'],
    paths: [['sulawesi', 'sulawesi'], ['ontario', 'ontario'], ['wa', 'wa']],
    riskPaths: [['sulawesi', 'xuar']],
    mislabelAs: ['2604.00', '2620.99'] },
  { id: 'polysilicon', name: 'Polysilicon', hs: '2804.61', unitLabel: 'drums', unitWeightKg: 120, marketPrice: 780,
    batteryMineral: null, units: [120, 700], steps: ['Mine', 'Refinery'],
    paths: [['innermongolia', 'innermongolia'], ['sichuan', 'sichuan'], ['norway', 'norway']],
    riskPaths: [['xuar', 'xuar'], ['innermongolia', 'xuar']],
    mislabelAs: ['3818.00', '2530.90'] },
  { id: 'solar', name: 'Solar PV modules', hs: '8541.43', unitLabel: 'pallets', unitWeightKg: 650, marketPrice: 3400,
    batteryMineral: null, units: [40, 260], steps: ['Refinery', 'Factory', 'Assembly'],
    paths: [['sichuan', 'jiangsu', 'bacninh'], ['innermongolia', 'zhejiang', 'zhejiang'], ['norway', 'chungcheong', 'chungcheong'], ['sichuan', 'jiangsu', 'laemchabang']],
    riskPaths: [['xuar', 'jiangsu', 'bacninh'], ['xuar', 'zhejiang', 'zhejiang']],
    mislabelAs: ['8473.30', '7616.99'] },
  { id: 'tshirts', name: 'Cotton T-shirts', hs: '6109.10', unitLabel: 'cartons', unitWeightKg: 12, marketPrice: 240,
    batteryMineral: null, units: [300, 2400], steps: ['Farm', 'Factory', 'Assembly'],
    paths: [['gujarat', 'tiruppur', 'tiruppur'], ['texas', 'dhaka', 'dhaka'], ['izmir', 'izmir', 'izmir'], ['gujarat', 'dhaka', 'dhaka']],
    riskPaths: [['xuar', 'jiangsu', 'jiangsu'], ['xuar', 'zhejiang', 'dhaka']],
    mislabelAs: ['6307.90', '3926.20'] },
  { id: 'jeans', name: 'Cotton denim jeans', hs: '6203.42', unitLabel: 'cartons', unitWeightKg: 16, marketPrice: 420,
    batteryMineral: null, units: [200, 1800], steps: ['Farm', 'Factory', 'Assembly'],
    paths: [['texas', 'izmir', 'izmir'], ['gujarat', 'gujarat', 'dhaka'], ['texas', 'tiruppur', 'tiruppur']],
    riskPaths: [['xuar', 'guangdong', 'guangdong'], ['xuar', 'shandong', 'dhaka']],
    mislabelAs: ['6307.90', '5209.42'] },
  { id: 'tomato', name: 'Tomato paste', hs: '2002.90', unitLabel: 'drums', unitWeightKg: 235, marketPrice: 290,
    batteryMineral: null, units: [80, 600], steps: ['Farm', 'Factory'],
    paths: [['emilia', 'emilia'], ['extremadura', 'extremadura'], ['california', 'california']],
    riskPaths: [['xuar', 'xuar']],
    mislabelAs: ['2103.20', '2106.90'] },
  { id: 'aluminium', name: 'Aluminium extrusions', hs: '7604.29', unitLabel: 'bundles', unitWeightKg: 500, marketPrice: 1900,
    batteryMineral: null, units: [60, 400], steps: ['Smelter', 'Factory'],
    paths: [['quebec', 'quebec'], ['norway', 'norway'], ['jebelali', 'jebelali'], ['innermongolia', 'shandong']],
    riskPaths: [['xuar', 'shandong'], ['xuar', 'zhejiang']],
    mislabelAs: ['7308.90', '8302.41'] },
  { id: 'shrimp', name: 'Frozen shrimp', hs: '0306.17', unitLabel: 'cartons', unitWeightKg: 20, marketPrice: 175,
    batteryMineral: null, units: [400, 2400], steps: ['Farm', 'Factory'],
    paths: [['guayas', 'guayas'], ['andhra', 'andhra'], ['mekong', 'mekong']],
    riskPaths: [],
    mislabelAs: ['1605.21', '1604.20'] },
  { id: 'phones', name: 'Smartphones', hs: '8517.13', unitLabel: 'cartons', unitWeightKg: 9, marketPrice: 5200,
    batteryMineral: null, units: [100, 900], steps: ['Mine', 'Factory', 'Assembly'],
    paths: [['tasmania', 'guangdong', 'bacninh'], ['tasmania', 'chungcheong', 'chennai'], ['tasmania', 'guangdong', 'guangdong']],
    riskPaths: [['kivu_asm', 'guangdong', 'bacninh'], ['kivu_asm', 'guangdong', 'guangdong']],
    mislabelAs: ['8471.30', '3926.90'] },
  { id: 'pvc_floor', name: 'PVC vinyl flooring', hs: '3918.10', unitLabel: 'pallets', unitWeightKg: 1000, marketPrice: 1250,
    batteryMineral: null, units: [40, 260], steps: ['Refinery', 'Factory'],
    paths: [['louisiana', 'jiangsu'], ['shandong', 'jiangsu'], ['shandong', 'haiphong']],
    riskPaths: [['xuar', 'jiangsu'], ['xuar', 'zhejiang']],
    mislabelAs: ['4418.79', '6807.90'] },
];
for (const p of PRODUCTS) p.family = hsFamily(p.hs);
// add any chapters used by mislabels to the table so the rulebook can resolve them
Object.assign(HS_TABLE, { '68': 'Stone, plaster & asphalt articles', '79': 'Zinc' });
export const PRODUCT_BY_ID = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));
export const PRODUCT_BY_NAME = Object.fromEntries(PRODUCTS.map(p => [p.name, p]));
export const BATTERY_MINERAL_PRODUCTS = PRODUCTS.filter(p => p.batteryMineral).map(p => p.name);

// ---------------------------------------------------------------- auditors
export const ACCREDITED_AUDITORS = [
  'Veritrace Audit GmbH',
  'Nordlys Assurance AS',
  'Meridian Social Compliance Ltd',
  'Halvorsen & Quay Certification',
  'Kestrel Ethical Trade Audits',
  'Sabine Okoro Verification SARL',
];
// Lookalikes / fakes — NOT accredited. Early shifts use the obvious ones, later shifts the subtle ones.
export const FAKE_AUDITORS = {
  obvious: ['Global Ethics Certify Co.', 'TrustStamp Compliance Hub', 'Best Clean Audit Services', 'WorldOK Certification Ltd'],
  subtle: ['Veritrace Audits GmbH', 'Nordlys Assurance Group', 'Meridian Social Compliance LLC', 'Kestrel Ethical Trade Audit', 'Halvorsen & Quay Certifications'],
};
export const CERT_PREFIX = {
  'Veritrace Audit GmbH': 'VT', 'Nordlys Assurance AS': 'NA', 'Meridian Social Compliance Ltd': 'MSC',
  'Halvorsen & Quay Certification': 'HQ', 'Kestrel Ethical Trade Audits': 'KET', 'Sabine Okoro Verification SARL': 'SOV',
};

// ---------------------------------------------------------------- honest trader firms
export const FIRMS = [
  { id: 'vandermeer', name: 'Vandermeer & Daughters Electronics', country: 'Netherlands', honest: true,
    personality: 'Fussy three-generation family importer. Knows every inspector by name; writes long, wounded, very polite complaints.',
    patience: 0.45, clout: 0.3, style: 'complain', products: ['phones', 'li_cells'],
    voice: {
      arrive: ['Morning, inspector! Same as always — paperwork triple-checked by Oma.', 'Our little shipment again. Every receipt is stapled, I promise.'],
      thanks: ['Clean and quick — Oma says you are a credit to the service.', 'Cleared! The shop opens on time. Thank you, truly.'],
      complaint: ['Detained? We have filed with this port for 41 years. Our solicitor is drafting.', 'Our papers were spotless. This is a disgrace to a family business.', 'Three generations, never a flag. Expect a formal letter. A long one.'],
      lobby: ['I have written to the Director personally. In fountain pen.'],
      reroute: ['Fine. Our next containers go to Port Calder. It breaks Papa’s heart.'],
      impatient: ['Our refrigerated cargo is warming, inspector…'],
    } },
  { id: 'orbisant', name: 'Orbisant Global Logistics', country: 'Singapore', honest: true,
    personality: 'Impatient mega-forwarder. Counts demurrage by the minute and moves volume the moment it is annoyed.',
    patience: 0.15, clout: 0.85, style: 'reroute', products: ['aluminium', 'pvc_floor', 'tomato', 'shrimp', 'ni_matte'],
    voice: {
      arrive: ['Orbisant vessel inbound. Clear it. Time is money.', 'Another Orbisant box. Our schedule assumes 90-second clearance.'],
      thanks: ['Acceptable throughput. Keep it up.', 'Cleared on schedule. Noted in our port scorecard.'],
      complaint: ['Unjustified hold on a clean box. Demurrage invoice incoming.', 'Our compliance file is audited quarterly. Release it.'],
      lobby: ['Our VP has the Director on speed-dial. Expect a call.', 'Orbisant board raising your “inspection culture” with the port authority.'],
      reroute: ['Diverting the next {n} vessels to Port Calder. Effective now.', 'Port Calder clears in half the time. Rerouting {n} ships.'],
      impatient: ['Three Orbisant hulls idling. That is $40k an hour.', 'Queue is unacceptable. Our schedule is slipping.'],
    } },
  { id: 'loomwell', name: 'Loomwell Apparel Co-op', country: 'Portugal', honest: true,
    personality: 'Eco-conscious worker-owned apparel co-op. Cheers strict checks, but loud and organised when wrongly held.',
    patience: 0.8, clout: 0.45, style: 'lobby', products: ['tshirts', 'jeans'],
    voice: {
      arrive: ['Organic cotton, traceable to the farm. Check away — we love it.', 'Loomwell co-op cargo. Full chain on file, happy to show you.'],
      thanks: ['Thanks for checking properly — that is what keeps sweatshops out.', 'Cleared! Our members send their solidarity.'],
      complaint: ['We publish our whole chain online — why the hold?', 'Detaining an audited co-op lets the real cheats look busy.'],
      lobby: ['Our members are writing to the Director. All 600 of them.', 'Petition to the port authority now has 12,000 signatures.'],
      reroute: ['Reluctantly sending {n} shipments to Port Calder this week.'],
      impatient: ['No rush — but our dye-free batch has a launch date.'],
    } },
  { id: 'brightfold', name: 'Brightfold Solar Distribution', country: 'Germany', honest: true,
    personality: 'Solar and battery-materials distributor squeezed by installer deadlines; nervous about forced-labour detentions.',
    patience: 0.5, clout: 0.55, style: 'mixed', products: ['solar', 'polysilicon', 'li_carbonate', 'co_hydroxide'],
    voice: {
      arrive: ['Brightfold modules — polysilicon traced, smelters listed.', 'Installers waiting on this one. Full traceability pack attached.'],
      thanks: ['Cleared — 40 rooftops go live this week. Thank you.', 'Fast and fair. That is how ethical solar scales.'],
      complaint: ['We paid for isotope testing on that polysilicon. Release it.', 'Holding clean solar helps nobody. We traced every wafer.'],
      lobby: ['Our trade association has flagged this hold to the Director.'],
      reroute: ['Installers cannot wait. Routing {n} containers via Port Calder.'],
      impatient: ['Install crews are standing on roofs waiting, inspector.'],
    } },
];
export const FIRM_BY_ID = Object.fromEntries(FIRMS.map(f => [f.id, f]));

// ---------------------------------------------------------------- other fictional actors
export const ACTORS = {
  syndicate: { name: 'The Gilt Current', blurb: 'A smuggling syndicate laundering forced-labour and sanctioned goods through front companies.' },
  ngo: { name: 'Tidewater Watch', blurb: 'An investigative NGO tracking forced labour in shipping supply chains.' },
  director: { name: 'Director Hollis Vane', blurb: 'Your boss. Measures the port in containers per hour.' },
  rival: { name: 'Port Calder', blurb: 'The rival port down the coast. Fast, cheap, and not too curious.' },
};

// ---------------------------------------------------------------- rules (rulebook)
export const RULES = [
  { id: 'uflpa', shift: 1, title: 'Listed regions — rebuttable presumption',
    text: `Any supply-chain hop in a listed high-risk region (${HIGH_RISK_REGIONS.join('; ')}) means the goods are presumed made with forced labour (UFLPA-style). DETAIN unless an audit clears it.`,
    checks: ['forced_labour'] },
  { id: 'origin', shift: 1, title: 'True country of origin',
    text: 'Declared origin must be the country where the goods were last substantially made (last Mine/Farm/Refinery/Smelter/Factory/Assembly hop). A Repackaging hop in a third country does not confer origin. Transit warehouses are fine.',
    checks: ['transshipment'] },
  { id: 'hs', shift: 1, title: 'HS classification',
    text: 'The declared HS code’s chapter (first two digits) must match the product family in the HS table.',
    checks: ['hs_mislabel'] },
  { id: 'shell', shift: 1, title: 'Shell companies & sanctions screening',
    text: 'A chain firm less than 12 months old AND with fewer than 5 employees is a suspected shell/front for sanctioned parties. Young-but-staffed or old-but-small firms are fine.',
    checks: ['shell_company'] },
  { id: 'cert', shift: 1, title: 'Social-audit certificate',
    text: 'Certificate issuer must be on the accredited auditor list (exact name) and the certificate must not be expired as of today.',
    checks: ['forged_cert'] },
  { id: 'price', shift: 1, title: 'Valuation',
    text: 'Unit price below 60% of the reference market price signals undervaluation or a forced-labour input. Discounts down to 60% are normal trade.',
    checks: ['underpriced'] },
  { id: 'weight', shift: 1, title: 'Weight reconciliation',
    text: 'Declared gross weight must be within 15% of units × reference unit weight.',
    checks: ['weight_mismatch'] },
  { id: 'eu_battery', shift: 2, title: 'EU Battery Regulation — smelter of origin',
    text: 'Lithium, cobalt and nickel products (cells, lithium carbonate, cobalt hydroxide, nickel matte) must declare the smelter/refiner of origin. Missing smelter → DETAIN.',
    checks: ['missing_smelter'] },
  { id: 'csddd', shift: 3, title: 'CSDDD — due-diligence statement',
    text: 'Every importer must file a supply-chain due-diligence statement. No statement → DETAIN.',
    checks: ['no_due_diligence'] },
  { id: 'eu_flr', shift: 3, title: 'EU Forced Labour Regulation — market ban',
    text: 'Products made with forced labour are banned from the market whatever their route. Listed-region hops remain an automatic DETAIN, even when hidden behind transshipment.',
    checks: ['forced_labour', 'transshipment'] },
];
export function getActiveRules(shift) { return RULES.filter(r => r.shift <= (shift || 1)); }
// Violations that can occur in a given shift (1..3)
export function activeViolations(shift) {
  return [...new Set(getActiveRules(shift).flatMap(r => r.checks))];
}

// ---------------------------------------------------------------- violation info (rulebook + debrief)
export const VIOLATION_INFO = {
  forced_labour: { label: 'Forced labour (listed region)',
    tell: 'A chain hop sits in a listed high-risk region, e.g. Xinjiang (XUAR) or artisanal DRC mining zones.',
    explain: 'The US UFLPA (2022) presumes goods made wholly or partly in Xinjiang are made with forced labour and bars them unless the importer proves otherwise with clear and convincing evidence.' },
  transshipment: { label: 'Transshipment / false origin',
    tell: 'Declared origin differs from where the goods were made; a Repackaging hop appears in a third country.',
    explain: 'Relabelling or repackaging goods in a third country does not change their origin — it is used to dodge forced-labour bans, sanctions and anti-dumping duties.' },
  hs_mislabel: { label: 'HS misclassification',
    tell: 'The HS code chapter does not match the product family in the HS table.',
    explain: 'HS codes decide duties, quotas and which controls apply; declaring goods under the wrong chapter can evade tariffs, forced-labour targeting and export controls.' },
  shell_company: { label: 'Shell company / sanctions front',
    tell: 'A chain firm under 12 months old with fewer than 5 employees.',
    explain: 'Freshly registered firms with no staff often front for sanctioned or banned suppliers, hiding the real beneficial owner behind a registered-agent address.' },
  forged_cert: { label: 'Forged / invalid certificate',
    tell: 'Issuer not on the accredited list (watch lookalike names) or the certificate has expired.',
    explain: 'A social-audit certificate only means something if an accredited body issued it and it is in date; lookalike auditors and stale certificates are a cheap way to fake compliance.' },
  underpriced: { label: 'Undervaluation',
    tell: 'Unit price below 60% of the reference market price.',
    explain: 'Prices far below market can mean customs undervaluation to cut duties, or inputs made artificially cheap by forced labour.' },
  weight_mismatch: { label: 'Weight mismatch',
    tell: 'Declared weight is more than 15% off units × reference unit weight.',
    explain: 'When weight and declared quantity disagree, the container may hold undeclared goods — or the quantity on the invoice is false.' },
  missing_smelter: { label: 'No smelter of origin (EU Battery Reg.)',
    tell: 'A lithium, cobalt or nickel product with no smelter/refiner declared.',
    explain: 'The EU Battery Regulation (2023/1542) requires due diligence on cobalt, lithium, nickel and natural graphite supply chains — including knowing which smelters and refiners are in them.' },
  no_due_diligence: { label: 'No due-diligence statement (CSDDD)',
    tell: 'Due-diligence statement field reads NO.',
    explain: 'The EU Corporate Sustainability Due Diligence Directive obliges large companies to identify, prevent and remedy human-rights and environmental harms in their supply chains.' },
};
export const VIOLATION_IDS = Object.keys(VIOLATION_INFO);
