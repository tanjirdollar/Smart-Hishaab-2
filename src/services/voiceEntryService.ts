import {
  GARMENT_CATEGORY_OPTIONS,
  GARMENT_SIZE_OPTIONS,
} from '../config/navigation';
import {
  calculateDozensFromPieces,
  calculateEarnedWageFromPiecesAndRate,
  getTodayDDMMYYYY,
  toAsciiDigits,
  toBengaliDigits,
} from '../utils/formatters';

export interface ExtractedVoiceProductionData {
  transcript: string;
  itemName: string;
  category: string;
  sizes: string[];
  color: string;
  pieces: number | null;
  dozens: number | null;
  ratePerDozen: number | null;
  totalWage: number | null;
  date: string;
  notes: string;
  missingFieldsBn: string[];
  usedAiServer: boolean;
}

const BENGALI_WORD_NUMBERS: Record<string, number> = {
  এক: 1,
  দুই: 2,
  তিন: 3,
  চার: 4,
  পাঁচ: 5,
  ছয়: 6,
  ছয়: 6,
  সাত: 7,
  আট: 8,
  নয়: 9,
  নয়: 9,
  দশ: 10,
  এগারো: 11,
  বারো: 12,
  তেরো: 13,
  চৌদ্দ: 14,
  পনেরো: 15,
  ষোল: 16,
  ষোলো: 16,
  সতেরো: 17,
  আঠারো: 18,
  উনিশ: 19,
  বিশ: 20,
  একুশ: 21,
  বাইশ: 22,
  তেইশ: 23,
  চব্বিশ: 24,
  পঁচিশ: 25,
  ছাব্বিশ: 26,
  সাতাশ: 27,
  আটাশ: 28,
  ঊনত্রিশ: 29,
  ত্রিশ: 30,
  একত্রিশ: 31,
  বত্রিশ: 32,
  পঁয়ত্রিশ: 35,
  পঁয়ত্রিশ: 35,
  চল্লিশ: 40,
  পঁয়তাল্লিশ: 45,
  পঞ্চাশ: 50,
  ষাট: 60,
  সত্তর: 70,
  আশি: 80,
  নব্বই: 90,
  একশ: 100,
  একশো: 100,
  দেড়: 1.5,
  আড়াই: 2.5,
  সাড়ে: 0.5,
};

function normalizeSpokenNumbersToDigits(text: string): string {
  let out = toAsciiDigits(text);
  for (const [word, val] of Object.entries(BENGALI_WORD_NUMBERS)) {
    const regex = new RegExp(`(^|\\s|[,।])${word}(?=\\s|[,।]|$)`, 'g');
    out = out.replace(regex, `$1${val}`);
  }
  return out;
}

/**
 * Deterministic Bengali + English NLP extractor fallback so voice entry works
 * reliably both with the server-side Gemini API and on static deployments.
 */
export function parseVoiceTranscriptLocally(
  rawTranscript: string,
  todayDateDDMMYYYY = getTodayDDMMYYYY(false)
): ExtractedVoiceProductionData {
  const transcript = rawTranscript.trim();
  const normalized = normalizeSpokenNumbersToDigits(transcript);

  // 1. Extract Category (কটি, গোলগোলা, শার্ট, প্যান্ট)
  let category = '';
  if (/কটি/i.test(transcript)) {
    category = 'কটি';
  } else if (/গোলগোলা|গোলগলা|গোল গলা/i.test(transcript)) {
    category = 'গোলগোলা';
  } else if (/প্যান্ট|pant/i.test(transcript)) {
    category = 'প্যান্ট';
  } else if (/শার্ট|shirt/i.test(transcript)) {
    category = 'শার্ট';
  }

  // 2. Extract Item Name
  let itemName = '';
  const itemExplicitMatch = transcript.match(
    /(?:আইটেম|আইটেমের নাম|পোশাক)\s*[:=-]?\s*([^,।]+)/i
  );
  if (itemExplicitMatch && itemExplicitMatch[1]) {
    itemName = itemExplicitMatch[1].trim();
  } else if (category) {
    // Check if there is a modifier before the category word (e.g., "বাচ্চাদের গোলগোলা", "ফুল হাতা শার্ট")
    const phraseMatch = transcript.match(
      /((?:বাচ্চাদের|লেডিস|বয়েজ|মেনস|হাফ হাতা|ফুল হাতা|স্লিভলেস)\s*(?:কটি|গোলগোলা|গোলগলা|শার্ট|প্যান্ট|টি-শার্ট|টিশার্ট))/i
    );
    itemName = phraseMatch ? phraseMatch[1].trim() : category;
  }

  // 3. Extract Sizes from the 11 preset sizes (১৪, ১৬, ১৮, ২০, ২২, ২৪, ২৬, ২৮, ৩০, ৩১, ৩২)
  const sizes: string[] = [];
  const sizeSectionMatch = normalized.match(
    /(?:সাইজ|size)\s*[:=-]?\s*([0-9,\sএবংও-]+)/i
  );
  if (sizeSectionMatch && sizeSectionMatch[1]) {
    const nums = sizeSectionMatch[1].match(/\d+/g) || [];
    nums.forEach((n) => {
      const bnSize = toBengaliDigits(n);
      if (GARMENT_SIZE_OPTIONS.includes(bnSize) && !sizes.includes(bnSize)) {
        sizes.push(bnSize);
      }
    });
  }
  if (sizes.length === 0) {
    // Look for "সাইজ X" or "X সাইজ"
    const directSizeMatches = normalized.matchAll(
      /(?:সাইজ\s*(\d{2})|(\d{2})\s*সাইজ)/gi
    );
    for (const m of directSizeMatches) {
      const numStr = m[1] || m[2];
      if (numStr) {
        const bnSize = toBengaliDigits(numStr);
        if (GARMENT_SIZE_OPTIONS.includes(bnSize) && !sizes.includes(bnSize)) {
          sizes.push(bnSize);
        }
      }
    }
  }

  // 4. Extract Color if mentioned
  let color = '';
  const colorList = [
    { pattern: /সাদা|white/i, label: 'সাদা (White)' },
    { pattern: /কালো|black/i, label: 'কালো (Black)' },
    { pattern: /নেভি|নীল|blue/i, label: 'নেভি ব্লু (Navy Blue)' },
    { pattern: /সবুজ|অলিভ|green/i, label: 'অলিভ গ্রিন (Olive Green)' },
    { pattern: /মেরুন|maroon/i, label: 'মেরুন (Maroon)' },
    { pattern: /অ্যাশ|গ্রে|grey|gray/i, label: 'অ্যাশ / গ্রে (Heather Grey)' },
    { pattern: /লাল|red/i, label: 'লাল (Red)' },
    { pattern: /হলুদ|মাস্টার্ড|yellow/i, label: 'হলুদ / মাস্টার্ড (Mustard)' },
  ];
  for (const c of colorList) {
    if (c.pattern.test(transcript)) {
      color = c.label;
      break;
    }
  }

  // 5. Extract Rate per Dozen (প্রতি ডজন ৩৫ টাকা রেট / ৩৫ টাকা ডজন / রেট ৪০ টাকা)
  let ratePerDozen: number | null = null;
  const ratePatterns = [
    /প্রতি\s*ডজন(?:ের)?\s*(?:দর|রেট)?\s*(\d+(?:\.\d+)?)\s*(?:টাকা|রেট|দর)?/i,
    /(\d+(?:\.\d+)?)\s*টাকা\s*(?:প্রতি\s*ডজন|ডজন|রেট|দর)/i,
    /(?:রেট|দর)\s*(?:প্রতি\s*ডজন)?\s*(\d+(?:\.\d+)?)\s*(?:টাকা)?/i,
    /(\d+(?:\.\d+)?)\s*(?:টাকা)?\s*(?:রেট|দর)/i,
  ];
  for (const rp of ratePatterns) {
    const m = normalized.match(rp);
    if (m && m[1]) {
      const val = Number(m[1]);
      if (Number.isFinite(val) && val > 0) {
        ratePerDozen = val;
        break;
      }
    }
  }

  // 6. Extract Quantity in Dozens or Pieces
  // Strip out "প্রতি ডজন X" before matching dozens quantity so "প্রতি ডজন ৩৫ টাকা" isn't confused with quantity
  const textWithoutRatePhrase = normalized
    .replace(/প্রতি\s*ডজন(?:ের)?\s*(?:দর|রেট)?\s*\d+(?:\.\d+)?/gi, '')
    .replace(/\d+(?:\.\d+)?\s*টাকা\s*ডজন/gi, '');

  let dozens: number | null = null;
  let pieces: number | null = null;

  const dozensMatch = textWithoutRatePhrase.match(
    /(\d+(?:\.\d+)?)\s*(?:ডজন|dozen|dzn)/i
  );
  const piecesMatch = textWithoutRatePhrase.match(
    /(\d+)\s*(?:পিস|টি\s*পিস|pcs|piece|pieces)/i
  );

  if (dozensMatch && dozensMatch[1]) {
    const dVal = Number(dozensMatch[1]);
    if (Number.isFinite(dVal) && dVal > 0) {
      dozens = Number(dVal.toFixed(4));
      pieces = Math.round(dVal * 12);
    }
  }

  if (piecesMatch && piecesMatch[1]) {
    const pVal = Number(piecesMatch[1]);
    if (Number.isFinite(pVal) && pVal > 0) {
      pieces = Math.round(pVal);
      if (dozens === null) {
        dozens = calculateDozensFromPieces(pieces);
      }
    }
  }

  const totalWage =
    pieces !== null && ratePerDozen !== null
      ? calculateEarnedWageFromPiecesAndRate(pieces, ratePerDozen)
      : dozens !== null && ratePerDozen !== null
      ? Number((dozens * ratePerDozen).toFixed(2))
      : null;

  // 7. Identify missing fields
  const missingFieldsBn: string[] = [];
  if (!itemName) missingFieldsBn.push('আইটেমের নাম');
  if (!category) missingFieldsBn.push('ক্যাটাগরি (কটি / গোলগোলা / শার্ট / প্যান্ট)');
  if (sizes.length === 0) missingFieldsBn.push('সাইজ');
  if (pieces === null && dozens === null) missingFieldsBn.push('পরিমাণ (পিস বা ডজন)');
  if (ratePerDozen === null) missingFieldsBn.push('প্রতি ডজনের রেট (দর)');

  return {
    transcript,
    itemName,
    category,
    sizes,
    color,
    pieces,
    dozens,
    ratePerDozen,
    totalWage,
    date: todayDateDDMMYYYY,
    notes: '',
    missingFieldsBn,
    usedAiServer: false,
  };
}

/**
 * Calls the server-side Gemini endpoint `/api/ai/voice-production-parse`
 * and seamlessly falls back to local NLP parsing if offline or on a static host.
 */
export async function analyzeVoiceProductionInput(params: {
  transcript?: string;
  audioBase64?: string;
  mimeType?: string;
  todayDateDDMMYYYY?: string;
}): Promise<{
  data: ExtractedVoiceProductionData | null;
  errorBn: string | null;
}> {
  const todayStr = params.todayDateDDMMYYYY || getTodayDDMMYYYY(false);

  try {
    const response = await fetch('/api/ai/voice-production-parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: params.transcript,
        audioBase64: params.audioBase64,
        mimeType: params.mimeType,
        todayDateDDMMYYYY: todayStr,
      }),
    });

    if (response.ok) {
      const json = await response.json();
      if (json.ok && json.extracted) {
        const ext = json.extracted;
        const localFallback = parseVoiceTranscriptLocally(
          json.transcript || params.transcript || '',
          todayStr
        );

        const rawCategory = String(ext.category || '').trim();
        const category = GARMENT_CATEGORY_OPTIONS.includes(rawCategory)
          ? rawCategory
          : localFallback.category;

        const itemName =
          String(ext.itemName || '').trim() || localFallback.itemName || category;

        const validSizes = Array.isArray(ext.sizes)
          ? ext.sizes
              .map((s: unknown) => toBengaliDigits(String(s).trim()))
              .filter((s: string) => GARMENT_SIZE_OPTIONS.includes(s))
          : [];
        const sizes = validSizes.length > 0 ? validSizes : localFallback.sizes;

        let pieces: number | null =
          typeof ext.pieces === 'number' && Number.isFinite(ext.pieces) && ext.pieces > 0
            ? Math.round(ext.pieces)
            : null;
        let dozens: number | null =
          typeof ext.dozens === 'number' && Number.isFinite(ext.dozens) && ext.dozens > 0
            ? Number(ext.dozens.toFixed(4))
            : null;

        if (dozens !== null && pieces === null) {
          pieces = Math.round(dozens * 12);
        } else if (pieces !== null && dozens === null) {
          dozens = calculateDozensFromPieces(pieces);
        } else if (pieces === null && dozens === null) {
          pieces = localFallback.pieces;
          dozens = localFallback.dozens;
        }

        const ratePerDozen =
          typeof ext.ratePerDozen === 'number' &&
          Number.isFinite(ext.ratePerDozen) &&
          ext.ratePerDozen > 0
            ? ext.ratePerDozen
            : localFallback.ratePerDozen;

        const totalWage =
          pieces !== null && ratePerDozen !== null
            ? calculateEarnedWageFromPiecesAndRate(pieces, ratePerDozen)
            : null;

        const missingFieldsBn: string[] = [];
        if (!itemName) missingFieldsBn.push('আইটেমের নাম');
        if (!category) missingFieldsBn.push('ক্যাটাগরি');
        if (sizes.length === 0) missingFieldsBn.push('সাইজ');
        if (pieces === null && dozens === null) missingFieldsBn.push('পরিমাণ (পিস/ডজন)');
        if (ratePerDozen === null) missingFieldsBn.push('প্রতি ডজনের রেট');

        return {
          data: {
            transcript: json.transcript || params.transcript || '',
            itemName,
            category,
            sizes,
            color: String(ext.color || localFallback.color || '').trim(),
            pieces,
            dozens,
            ratePerDozen,
            totalWage,
            date: String(ext.date || todayStr).trim(),
            notes: String(ext.notes || '').trim(),
            missingFieldsBn,
            usedAiServer: true,
          },
          errorBn: null,
        };
      }
    }
  } catch {
    // Fallback to deterministic local parser below
  }

  if (params.transcript && params.transcript.trim()) {
    return {
      data: parseVoiceTranscriptLocally(params.transcript, todayStr),
      errorBn: null,
    };
  }

  return {
    data: null,
    errorBn:
      'ভয়েস কথা স্পষ্টভাবে বোঝা যায়নি। অনুগ্রহ করে আবার মাইক্রোফোনে বলুন অথবা নিচের বক্সে লিখুন।',
  };
}
