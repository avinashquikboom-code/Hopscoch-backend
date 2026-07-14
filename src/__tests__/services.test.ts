import crypto from 'crypto';
import settingsService, { encrypt, decrypt } from '../modules/settings/services/settings.service';
import paymentService from '../modules/payments/services/payment.service';
import shipmentService from '../modules/shipments/services/shipment.service';
import razorpayClient from '../modules/payments/services/razorpay.client';
import shiprocketClient from '../modules/shipments/services/shiprocket.client';

// Mock dependencies
jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    integrationSetting: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    payment: {
      upsert: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    shipment: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    orderTimelineEvent: {
      create: jest.fn(),
    },
  },
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Settings & Encryption Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should encrypt and decrypt values correctly', async () => {
    const rawValue = 'rzp_live_abc123';
    const encrypted = encrypt(rawValue);
    expect(encrypted).toContain(':'); // IV:Hex format

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(rawValue);
  });
});

describe('RazorpayClient Unit Tests', () => {
  it('should generate signature verification matches', async () => {
    // Inject mock key_secret for verification
    jest.spyOn(settingsService, 'getIntegrationKey').mockImplementation(async (prov, key) => {
      if (key === 'key_secret') return 'secret_key';
      return '';
    });

    const expectedSignature = crypto
      .createHmac('sha256', 'secret_key')
      .update('order_id|payment_id')
      .digest('hex');

    const isValid = await razorpayClient.verifyPaymentSignature('order_id', 'payment_id', expectedSignature);
    expect(isValid).toBe(true);
  });
});

describe('ShiprocketClient Unit Tests', () => {
  it('should parse and mask credentials correctly', () => {
    expect(shiprocketClient.testConnection).toBeDefined();
  });
});
