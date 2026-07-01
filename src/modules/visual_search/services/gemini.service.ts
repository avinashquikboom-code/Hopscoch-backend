import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../../../utils/logger';
import { AppError } from '../../../middleware/errorHandler';

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new AppError('Gemini API key not configured', 500);
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-pro-vision',
    });
  }

  async analyzeImage(imageUrl: string): Promise<{
    extractedCategory?: string;
    extractedColor?: string;
    extractedMaterial?: string;
    extractedPattern?: string;
    extractedBrand?: string;
    extractedStyle?: string;
    extractedGender?: string;
    extractedAgeGroup?: string;
    isBarcode?: boolean;
    barcodeData?: string;
  }> {
    try {
      const prompt = `
        Analyze this image carefully. First determine if it contains a barcode/QR code.
        
        If it's a barcode/QR code, extract in JSON format:
        - isBarcode: true
        - barcodeData: the decoded text from the barcode
        
        If it's a fashion product image, extract in JSON format:
        - category: (specific apparel type: tshirt, shirt, dress, kurta, saree, lehenga, salwar, jeans, trousers, shorts, skirt, blouse, jacket, hoodie, sweatshirt, cardigan, sweater, coat, blazer, shoes, sneakers, sandals, heels, boots, handbag, clutch, backpack, wallet, belt, scarf, sunglasses, watch, jewelry, accessory)
        - color: (primary color with shade variations: navy blue, royal blue, black, white, red, burgundy, emerald green, olive, beige, cream, brown, tan, grey, silver, gold, pink, peach, lavender)
        - material: (fabric composition: cotton, silk, satin, chiffon, georgette, crepe, linen, denim, leather, faux leather, velvet, wool, cashmere, polyester, rayon, viscose, spandex, elastane, nylon)
        - pattern: (design pattern: solid, striped, checkered, plaid, floral, paisley, geometric, polka dot, animal print, tie-dye, ombre, embroidered, printed, plain)
        - brand: (brand name if clearly visible on logo/tag)
        - style: (fashion style: casual, formal, semi-formal, ethnic/traditional, indo-western, bohemian, minimalist, streetwear, sporty, party/wedding, office/corporate, beach/resort)
        - gender: (male, female, unisex)
        - ageGroup: (adult, teen, kid)
        - isBarcode: false
        
        Return only valid JSON with these exact keys. Focus on fashion-specific details like fit type, neck style, sleeve length, hemline, and occasion if visible.
      `;

      const imagePart = {
        inlineData: {
          data: await this.getImageBase64(imageUrl),
          mimeType: 'image/jpeg',
        },
      };

      const result = await this.model.generateContent([prompt, imagePart]);
      const response = result.response.text();

      // Parse the JSON response
      const cleanedResponse = response.replace(/```json\n?|\n?```/g, '').trim();
      const extractedData = JSON.parse(cleanedResponse);

      logger.info(`Gemini analysis completed for image: ${imageUrl}`);
      return extractedData;
    } catch (error) {
      logger.error('Gemini analysis failed:', error);
      throw new AppError('Failed to analyze image with Gemini', 500);
    }
  }

  async searchProducts(extractedData: {
    extractedCategory?: string;
    extractedColor?: string;
    extractedMaterial?: string;
    extractedGender?: string;
    extractedBrand?: string;
    extractedStyle?: string;
    extractedPattern?: string;
  }): Promise<{
    matchedProductIds: string[];
    confidence: number;
    matchScores: Array<{
      productId: string;
      categoryMatch: number;
      colorMatch: number;
      materialMatch: number;
      brandMatch: number;
      styleMatch: number;
      overallScore: number;
    }>;
  }> {
    try {
      const prompt = `
        Based on the following extracted attributes from a fashion image:
        ${JSON.stringify(extractedData)}

        Calculate similarity scores for matching products using multi-factor scoring:
        - Category match: 40% weight (exact match = 1.0, partial match = 0.6, no match = 0)
        - Color match: 25% weight (exact shade = 1.0, similar color family = 0.7, no match = 0)
        - Material match: 15% weight (exact = 1.0, similar fabric type = 0.6, no match = 0)
        - Brand match: 10% weight (exact brand = 1.0, no match = 0)
        - Style match: 10% weight (exact style = 1.0, complementary style = 0.5, no match = 0)

        Return a JSON response with:
        - matchedProductIds: array of product IDs that match (up to 10, sorted by overallScore descending)
        - confidence: overall match confidence score (0.0 to 1.0) based on best match
        - matchScores: array of objects with productId, categoryMatch, colorMatch, materialMatch, brandMatch, styleMatch, overallScore

        Consider all attributes for comprehensive matching. Return only valid JSON.
      `;

      const result = await this.model.generateContent(prompt);
      const response = result.response.text();

      const cleanedResponse = response.replace(/```json\n?|\n?```/g, '').trim();
      const searchResult = JSON.parse(cleanedResponse);

      logger.info('Gemini product search completed');
      return searchResult;
    } catch (error) {
      logger.error('Gemini product search failed:', error);
      throw new AppError('Failed to search products with Gemini', 500);
    }
  }

  private async getImageBase64(imageUrl: string): Promise<string> {
    // In production, you would download the image from the URL
    // For now, we'll assume the imageUrl is already a base64 string or accessible
    // This is a simplified implementation
    if (imageUrl.startsWith('data:')) {
      return imageUrl.split(',')[1];
    }

    // For URLs, you would use fetch or axios to download the image
    // For now, return a placeholder or handle appropriately
    throw new AppError('Image URL processing not implemented for external URLs', 500);
  }

  async scanBarcode(imageUrl: string): Promise<{
    isBarcode: boolean;
    barcodeData?: string;
    barcodeType?: string;
    confidence: number;
  }> {
    try {
      const prompt = `
        Analyze this image to detect and decode any barcodes or QR codes.
        
        Return in JSON format:
        - isBarcode: true if barcode/QR code is detected, false otherwise
        - barcodeData: the decoded text/content from the barcode
        - barcodeType: (UPC, EAN, QR Code, Code 128, Code 39, Data Matrix, PDF417, or unknown)
        - confidence: detection confidence score (0.0 to 1.0)
        
        If no barcode is found, return isBarcode: false and omit other fields.
        Return only valid JSON.
      `;

      const imagePart = {
        inlineData: {
          data: await this.getImageBase64(imageUrl),
          mimeType: 'image/jpeg',
        },
      };

      const result = await this.model.generateContent([prompt, imagePart]);
      const response = result.response.text();

      const cleanedResponse = response.replace(/```json\n?|\n?```/g, '').trim();
      const barcodeResult = JSON.parse(cleanedResponse);

      logger.info(`Barcode scan completed: ${barcodeResult.isBarcode ? 'Barcode found' : 'No barcode'}`);
      return barcodeResult;
    } catch (error) {
      logger.error('Barcode scan failed:', error);
      throw new AppError('Failed to scan barcode with Gemini', 500);
    }
  }
}

export default new GeminiService();
