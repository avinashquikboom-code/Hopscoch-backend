import * as fs from 'fs';
import * as path from 'path';

const settingsFilePath = path.join(process.cwd(), 'data', 'app_settings.json');

const countriesData = [
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

const currenciesData = [
  { id: '1', code: 'INR', symbol: '₹', name: 'Indian Rupee', exchangeRate: 1.0, isDefault: true, isEnabled: true },
  { id: '2', code: 'USD', symbol: '$', name: 'US Dollar', exchangeRate: 0.012, isDefault: false, isEnabled: true },
  { id: '3', code: 'EUR', symbol: '€', name: 'Euro', exchangeRate: 0.011, isDefault: false, isEnabled: true },
  { id: '4', code: 'GBP', symbol: '£', name: 'British Pound', exchangeRate: 0.0095, isDefault: false, isEnabled: true },
  { id: '5', code: 'AED', symbol: 'AED', name: 'UAE Dirham', exchangeRate: 0.044, isDefault: false, isEnabled: true },
  { id: '6', code: 'BHD', symbol: 'BD', name: 'Bahraini Dinar', exchangeRate: 0.0045, isDefault: false, isEnabled: true },
  { id: '7', code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', exchangeRate: 0.057, isDefault: false, isEnabled: true },
  { id: '8', code: 'MUR', symbol: '₨', name: 'Mauritian Rupee', exchangeRate: 0.54, isDefault: false, isEnabled: true },
  { id: '9', code: 'FJD', symbol: 'FJ$', name: 'Fijian Dollar', exchangeRate: 0.027, isDefault: false, isEnabled: true },
  { id: '10', code: 'GYD', symbol: 'G$', name: 'Guyanese Dollar', exchangeRate: 2.51, isDefault: false, isEnabled: true },
  { id: '11', code: 'SRD', symbol: 'Sr$', name: 'Surinamese Dollar', exchangeRate: 0.39, isDefault: false, isEnabled: true },
  { id: '12', code: 'TTD', symbol: 'TT$', name: 'Trinidad & Tobago Dollar', exchangeRate: 0.081, isDefault: false, isEnabled: true },
  { id: '13', code: 'AUD', symbol: 'A$', name: 'Australian Dollar', exchangeRate: 0.018, isDefault: false, isEnabled: true },
  { id: '14', code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', exchangeRate: 0.016, isDefault: false, isEnabled: true },
  { id: '15', code: 'JPY', symbol: '¥', name: 'Japanese Yen', exchangeRate: 1.86, isDefault: false, isEnabled: true },
  { id: '16', code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', exchangeRate: 0.016, isDefault: false, isEnabled: true },
  { id: '17', code: 'SAR', symbol: 'SR', name: 'Saudi Riyal', exchangeRate: 0.045, isDefault: false, isEnabled: true },
  { id: '18', code: 'QAR', symbol: 'QR', name: 'Qatari Riyal', exchangeRate: 0.044, isDefault: false, isEnabled: true },
  { id: '19', code: 'KWD', symbol: 'KD', name: 'Kuwaiti Dinar', exchangeRate: 0.0037, isDefault: false, isEnabled: true },
  { id: '20', code: 'OMR', symbol: 'OR', name: 'Omani Rial', exchangeRate: 0.0046, isDefault: false, isEnabled: true },
  { id: '21', code: 'ZAR', symbol: 'R', name: 'South African Rand', exchangeRate: 0.22, isDefault: false, isEnabled: true },
  { id: '22', code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', exchangeRate: 0.02, isDefault: false, isEnabled: true },
];

async function seedCountriesAndCurrencies() {
  console.log('🌍 Seeding countries and currencies data...');

  let currentSettings: any = { languages: [], currencies: [], countries: [] };

  if (fs.existsSync(settingsFilePath)) {
    try {
      const raw = fs.readFileSync(settingsFilePath, 'utf-8');
      currentSettings = JSON.parse(raw);
    } catch (e) {
      console.warn('⚠️ Could not parse existing app_settings.json, starting fresh.');
    }
  } else {
    const dir = path.dirname(settingsFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  currentSettings.countries = countriesData;
  currentSettings.currencies = currenciesData;

  fs.writeFileSync(settingsFilePath, JSON.stringify(currentSettings, null, 2), 'utf-8');

  console.log(`✅ Successfully seeded ${countriesData.length} countries and ${currenciesData.length} currencies into app_settings.json!`);
}

seedCountriesAndCurrencies()
  .then(() => {
    console.log('🎉 Seed script executed successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error seeding countries and currencies:', err);
    process.exit(1);
  });
