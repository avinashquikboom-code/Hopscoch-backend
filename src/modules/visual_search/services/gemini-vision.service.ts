import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../../../utils/logger';
import settingsService from '../../settings/services/settings.service';

export interface ExtractedProductAttributes {
  category: string;
  productType: string;
  color: string;
  pattern: string;
  material: string;
  style: string;
  confidence: number;
}

export class GeminiVisionService {
  private genAI?: GoogleGenerativeAI;
  private model: any;

  private async getApiKey(): Promise<string | null> {
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your-gemini-api-key') {
      return process.env.GEMINI_API_KEY;
    }
    try {
      const dbKey = await settingsService.getIntegrationKey('google', 'gemini_api_key');
      if (dbKey) return dbKey;
    } catch (err) {
      logger.warn('[GEMINI_VISION] Could not read Gemini key from settingsService');
    }
    return null;
  }

  private async initGenAI(): Promise<boolean> {
    try {
      const apiKey = await this.getApiKey();
      if (!apiKey) {
        logger.warn('[GEMINI_VISION] No valid Gemini API key found. API calls will fail gracefully.');
        return false;
      }
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: {
          responseMimeType: 'application/json',
        },
      });
      return true;
    } catch (err) {
      logger.error('[GEMINI_VISION] Failed to initialize Gemini model: ' + err);
      return false;
    }
  }

  /**
   * Analyze image buffer using Gemini Vision and return structured fashion attributes
   */
  async extractFashionAttributes(
    imageBuffer: Buffer,
    mimeType: string = 'image/jpeg'
  ): Promise<ExtractedProductAttributes> {
    const initialized = await this.initGenAI();

    if (!initialized || !this.model) {
      logger.warn('[GEMINI_VISION] Gemini model unavailable, returning fallback attributes');
      return {
        category: 'Apparel',
        productType: 'Clothing',
        color: 'Multicolor',
        pattern: 'Solid',
        material: 'Cotton',
        style: 'Casual',
        confidence: 0.5,
      };
    }

    try {
      const prompt = `You are a professional luxury fashion & apparel computer vision model.
Analyze this fashion product image carefully and extract all observable attributes.

Return ONLY a JSON object with the following keys:
- "category": Main item category (e.g. Kurta, Dress, Top, T-Shirt, Shirt, Saree, Lehenga, Suit, Jeans, Trousers, Shorts, Skirt, Jacket, Blazer, Shoes, Sneakers, Sandals, Heels, Handbag, Accessories). If not a fashion item, return "Unknown".
- "productType": Specific apparel sub-type (e.g., Anarkali Kurta, A-Line Dress, Polo T-Shirt, Denim Jacket, Slim Fit Jeans, Running Shoes, Tote Bag).
- "color": Primary color family (e.g., Navy Blue, Black, White, Red, Burgundy, Emerald Green, Olive, Beige, Cream, Brown, Pink, Yellow, Grey, Gold, Silver).
- "pattern": Surface pattern (e.g., Solid, Striped, Checkered, Floral, Paisley, Geometric, Polka Dot, Embroidered, Printed).
- "material": Primary fabric/material (e.g., Cotton, Silk, Denim, Linen, Leather, Velvet, Chiffon, Satin, Wool, Polyester, Canvas).
- "style": Aesthetic style (e.g., Ethnic, Traditional, Casual, Formal, Partywear, Streetwear, Western, Indo-Western, Sporty).
- "confidence": Extraction confidence float score between 0.0 and 1.0.

Return valid JSON with exact string fields.`;

      const imagePart = {
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType: mimeType || 'image/jpeg',
        },
      };

      const result = await this.model.generateContent([prompt, imagePart]);
      const responseText = result.response.text();

      // Clean up markdown fences if present
      const cleaned = responseText.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      return {
        category: String(parsed.category || 'Apparel').trim(),
        productType: String(parsed.productType || 'Clothing').trim(),
        color: String(parsed.color || 'Multicolor').trim(),
        pattern: String(parsed.pattern || 'Solid').trim(),
        material: String(parsed.material || 'Cotton').trim(),
        style: String(parsed.style || 'Casual').trim(),
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
      };
    } catch (error: any) {
      logger.error('[GEMINI_VISION] Attribute extraction failed:', error?.message || error);
      // Return safe fallback instead of throwing 500 crash
      return {
        category: 'Apparel',
        productType: 'Clothing',
        color: 'Multicolor',
        pattern: 'Solid',
        material: 'Cotton',
        style: 'Casual',
        confidence: 0.3,
      };
    }
  }
}

export default new GeminiVisionService();
