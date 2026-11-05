import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_CATEGORIES = ['কটি', 'গোলগোলা', 'শার্ট', 'প্যান্ট'];
const ALLOWED_SIZES = ['১৪', '১৬', '১৮', '২০', '২২', '২৪', '২৬', '২৮', '৩০', '৩১', '৩২'];

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb' }));

  // Secure Server-Side AI Voice Production Entry Parser
  app.post('/api/ai/voice-production-parse', async (req, res) => {
    try {
      const {
        transcript: rawTranscript,
        audioBase64,
        mimeType,
        todayDateDDMMYYYY,
      } = req.body || {};

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        res.status(503).json({
          ok: false,
          useLocalFallback: true,
          errorBn: 'সার্ভারে GEMINI_API_KEY কনফিগার করা নেই; লোকাল বাংলা ভয়েস বিশ্লেষক ব্যবহৃত হচ্ছে।',
        });
        return;
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      let finalTranscript = typeof rawTranscript === 'string' ? rawTranscript.trim() : '';

      // Step 1: If audioBase64 is provided without transcript, transcribe speech first
      if (!finalTranscript && audioBase64) {
        const transcribeResponse = await ai.models.generateContent({
          model: 'gemini-3.5-transcribe',
          contents: [
            {
              inlineData: {
                mimeType: mimeType || 'audio/webm',
                data: audioBase64,
              },
            },
            {
              text: 'এই অডিওতে বলা বাংলা ও ইংরেজি কথাগুলো হুবহু বাংলায় ট্রান্সক্রাইব (লিপিবদ্ধ) করুন। শুধুমাত্র উচ্চারিত বাক্যটি লিখুন।',
            },
          ],
        });
        finalTranscript = (transcribeResponse.text || '').trim();
      }

      if (!finalTranscript) {
        res.status(400).json({
          ok: false,
          errorBn: 'কোনো ভয়েস টেক্সট বা অডিও পাওয়া যায়নি। অনুগ্রহ করে আবার বলুন।',
        });
        return;
      }

      // Step 2: Extract structured garment production fields using gemini-3.8-flash
      const systemPrompt = `You are a garment production data extraction assistant for a sewing machine operator in Bangladesh ("Smart Hisab").
Extract structured production fields from the user's spoken Bengali/Bangla-English text.

STRICT RULES:
1. Do NOT invent or fabricate any missing data. Only extract what is explicitly stated.
2. Category ("category"): MUST be one of these exact 4 strings if mentioned: "কটি", "গোলগোলা", "শার্ট", "প্যান্ট". (Note: if the user says "গোলগলা", map it to "গোলগোলা"). If none of these 4 is mentioned, return "".
3. Item Name ("itemName"): Extract the specific garment/item name mentioned by the user (e.g., "হাফ হাতা টি-শার্ট", "বাচ্চাদের গোলগোলা", "কটি", "গোলগোলা", "ফুল হাতা শার্ট"). Do NOT invent a name if nothing was mentioned.
4. Sizes ("sizes"): Must ONLY use Bengali numerals from this preset list if mentioned: ${ALLOWED_SIZES.join(', ')}. Convert ASCII size numbers (like "24" or "26") to Bengali numerals ("২৪", "২৬").
5. Quantities:
   - If the user mentions dozens (ডজন), set "dozens" to that numeric value and calculate "pieces" = Math.round(dozens * 12).
   - If the user mentions pieces (পিস), set "pieces" to that numeric value and calculate "dozens" = Number((pieces / 12).toFixed(4)).
   - If neither is mentioned, set both to null.
6. Rate ("ratePerDozen"): Extract the rate per dozen in Taka (প্রতি ডজনের দর / রেট). If not mentioned, set to null.
7. Date ("date"): If the user says "আজ" or "আজকে", use "${todayDateDDMMYYYY || ''}". If a specific date is mentioned, format as DD-MM-YYYY. Otherwise return "${todayDateDDMMYYYY || ''}".
8. "missingFieldsBn": List in Bengali any critical fields that were NOT mentioned in the voice command (for example: "আইটেম/ক্যাটাগরি", "সাইজ", "পিস বা ডজন সংখ্যা", "প্রতি ডজনের রেট").`;

      const parseResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `ভয়েস ইনপুট টেক্সট: "${finalTranscript}"`,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              itemName: {
                type: Type.STRING,
                description: 'Extracted item name in Bengali or English, or empty string if not mentioned.',
              },
              category: {
                type: Type.STRING,
                description: 'Must be one of: কটি, গোলগোলা, শার্ট, প্যান্ট, or empty string.',
              },
              sizes: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Array of matched preset sizes in Bengali digits (১৪, ১৬, ১৮, ২০, ২২, ২৪, ২৬, ২৮, ৩০, ৩১, ৩২).',
              },
              color: {
                type: Type.STRING,
                description: 'Extracted color name if mentioned, otherwise empty string.',
              },
              pieces: {
                type: Type.NUMBER,
                nullable: true,
                description: 'Quantity in pieces (calculated as dozens * 12 if dozens spoken). Null if not mentioned.',
              },
              dozens: {
                type: Type.NUMBER,
                nullable: true,
                description: 'Quantity in dozens (calculated as pieces / 12 if pieces spoken). Null if not mentioned.',
              },
              ratePerDozen: {
                type: Type.NUMBER,
                nullable: true,
                description: 'Rate per dozen in BDT Taka. Null if not mentioned.',
              },
              date: {
                type: Type.STRING,
                description: 'Production date in DD-MM-YYYY format.',
              },
              notes: {
                type: Type.STRING,
                description: 'Any additional notes or remarks mentioned.',
              },
              missingFieldsBn: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'List of missing or ambiguous fields in Bengali.',
              },
            },
            required: [
              'itemName',
              'category',
              'sizes',
              'color',
              'date',
              'notes',
              'missingFieldsBn',
            ],
          },
        },
      });

      const parsedJson = JSON.parse(parseResponse.text || '{}');
      const normalizedCat = ALLOWED_CATEGORIES.includes(parsedJson.category)
        ? parsedJson.category
        : parsedJson.category === 'গোলগলা'
        ? 'গোলগোলা'
        : '';

      res.json({
        ok: true,
        transcript: finalTranscript,
        extracted: {
          ...parsedJson,
          category: normalizedCat,
        },
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        useLocalFallback: true,
        errorBn:
          error instanceof Error
            ? `এআই ভয়েস প্রসেসিং ত্রুটি: ${error.message}`
            : 'এআই ভয়েস প্রসেসিংয়ে সাময়িক সমস্যা হয়েছে।',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Smart Hisab server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
