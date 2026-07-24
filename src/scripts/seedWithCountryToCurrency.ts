import * as fs from 'fs';
import * as path from 'path';
// Import country-to-currency mapping package
import countryToCurrency from 'country-to-currency';

const settingsFilePath = path.join(process.cwd(), 'data', 'app_settings.json');

// Full list of global countries with standard names and 2-letter ISO codes
const ALL_COUNTRIES = [
  { code: 'IN', name: 'India' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AE', name: 'UAE (Dubai)' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'MU', name: 'Mauritius' },
  { code: 'FJ', name: 'Fiji' },
  { code: 'GY', name: 'Guyana' },
  { code: 'SR', name: 'Suriname' },
  { code: 'TT', name: 'Trinidad & Tobago' },
  { code: 'AU', name: 'Australia' },
  { code: 'CA', name: 'Canada' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'JP', name: 'Japan' },
  { code: 'SG', name: 'Singapore' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'QA', name: 'Qatar' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'OM', name: 'Oman' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'CN', name: 'China' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
];

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'AED',
  BHD: 'BD',
  MYR: 'RM',
  MUR: '₨',
  FJD: 'FJ$',
  GYD: 'G$',
  SRD: 'Sr$',
  TTD: 'TT$',
  AUD: 'A$',
  CAD: 'CA$',
  JPY: '¥',
  SGD: 'S$',
  SAR: 'SR',
  QAR: 'QR',
  KWD: 'KD',
  OMR: 'OR',
  ZAR: 'R',
  NZD: 'NZ$',
  CHF: 'CHF',
  CNY: '¥',
  BRL: 'R$',
  MXN: 'Mex$',
};

const DEFAULT_EXCHANGE_RATES: Record<string, number> = {
  INR: 1.0,
  USD: 0.012,
  EUR: 0.011,
  GBP: 0.0095,
  AED: 0.044,
  BHD: 0.0045,
  MYR: 0.057,
  MUR: 0.54,
  FJD: 0.027,
  GYD: 2.51,
  SRD: 0.39,
  TTD: 0.081,
  AUD: 0.018,
  CAD: 0.016,
  JPY: 1.86,
  SGD: 0.016,
  SAR: 0.045,
  QAR: 0.044,
  KWD: 0.0037,
  OMR: 0.0046,
  ZAR: 0.22,
  NZD: 0.02,
  CHF: 0.011,
  CNY: 0.087,
  BRL: 0.068,
  MXN: 0.24,
};

async function seedCountryAndCurrencyData() {
  console.log('📦 Generating seed data using country-to-currency package...');

  const currencyMap = (countryToCurrency as any) || {};

  const seededCountries: Array<{ code: string; name: string; currencyCode: string }> = [];
  const currencySet = new Map<string, { id: string; code: string; symbol: string; name: string; exchangeRate: number; isDefault: boolean; isEnabled: boolean }>();

  // Default primary currency: INR
  currencySet.set('INR', {
    id: '1',
    code: 'INR',
    symbol: '₹',
    name: 'Indian Rupee',
    exchangeRate: 1.0,
    isDefault: true,
    isEnabled: true,
  });

  let currencyIdCounter = 2;

  for (const c of ALL_COUNTRIES) {
    const code = c.code.toUpperCase();
    const mappedCurrency = currencyMap[code] || (code === 'IN' ? 'INR' : 'USD');

    seededCountries.push({
      code: c.code,
      name: c.name,
      currencyCode: mappedCurrency,
    });

    if (!currencySet.has(mappedCurrency)) {
      const symbol = CURRENCY_SYMBOLS[mappedCurrency] || mappedCurrency;
      const rate = DEFAULT_EXCHANGE_RATES[mappedCurrency] || 1.0;

      currencySet.set(mappedCurrency, {
        id: String(currencyIdCounter++),
        code: mappedCurrency,
        symbol: symbol,
        name: `${mappedCurrency} Currency`,
        exchangeRate: rate,
        isDefault: false,
        isEnabled: true,
      });
    }
  }

  const currenciesList = Array.from(currencySet.values());

  let settingsData: any = { languages: [], currencies: [], countries: [] };

  if (fs.existsSync(settingsFilePath)) {
    try {
      const raw = fs.readFileSync(settingsFilePath, 'utf-8');
      settingsData = JSON.parse(raw);
    } catch (_) {}
  } else {
    const dir = path.dirname(settingsFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  settingsData.countries = seededCountries;
  settingsData.currencies = currenciesList;

  fs.writeFileSync(settingsFilePath, JSON.stringify(settingsData, null, 2), 'utf-8');

  console.log(`✅ Successfully mapped ${seededCountries.length} countries to currencies via country-to-currency!`);
  console.log(`✅ Generated ${currenciesList.length} unique currency records in app_settings.json.`);
}

seedCountryAndCurrencyData()
  .then(() => {
    console.log('🎉 Country-to-currency seed script completed successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error executing seed script:', err);
    process.exit(1);
  });
