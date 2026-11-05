import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Mic,
  MicOff,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import {
  analyzeVoiceProductionInput,
  ExtractedVoiceProductionData,
} from '../../services/voiceEntryService';
import {
  formatDozensBn,
  formatTaka,
  getTodayDDMMYYYY,
  toBengaliDigits,
} from '../../utils/formatters';

export interface AiVoiceEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDateDDMMYYYY?: string;
  onApplyToForm: (extracted: ExtractedVoiceProductionData) => void;
}

interface BrowserSpeechRecognitionEvent {
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

export const AiVoiceEntryModal: React.FC<AiVoiceEntryModalProps> = ({
  isOpen,
  onClose,
  defaultDateDDMMYYYY,
  onApplyToForm,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorBn, setErrorBn] = useState<string | null>(null);
  const [extractedData, setExtractedData] =
    useState<ExtractedVoiceProductionData | null>(null);

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!isOpen) {
      stopListeningSafely();
    } else {
      setErrorBn(null);
    }
    return () => {
      stopListeningSafely();
    };
  }, [isOpen]);

  const stopListeningSafely = () => {
    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    } catch {
      // ignore
    }
    try {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== 'inactive'
      ) {
        mediaRecorderRef.current.stop();
      }
    } catch {
      // ignore
    }
    setIsListening(false);
  };

  const handleToggleListening = async () => {
    if (isListening) {
      stopListeningSafely();
      return;
    }

    setErrorBn(null);
    setExtractedData(null);

    const win = window as unknown as {
      SpeechRecognition?: new () => BrowserSpeechRecognition;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    };

    const SpeechRecognitionCtor =
      win.SpeechRecognition || win.webkitSpeechRecognition;

    if (SpeechRecognitionCtor) {
      try {
        const recognition = new SpeechRecognitionCtor();
        recognition.lang = 'bn-BD';
        recognition.continuous = false;
        recognition.interimResults = true;

        recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
          let combined = '';
          for (let i = 0; i < event.results.length; i++) {
            combined += event.results[i][0].transcript;
          }
          setTranscript(combined.trim());
        };

        recognition.onerror = (event) => {
          setIsListening(false);
          if (event.error === 'not-allowed') {
            setErrorBn(
              'মাইক্রোফোন ব্যবহারের অনুমতি পাওয়া যায়নি। ব্রাউজারে মাইক্রোফোন পারমিশন (Allow) দিন।'
            );
          } else {
            setErrorBn(
              'ভয়েস শুনতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন অথবা নিচের বক্সে লিখুন।'
            );
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
        setIsListening(true);
        recognition.start();
        return;
      } catch {
        // Fallback to MediaRecorder below
      }
    }

    // Fallback: Record audio via MediaRecorder and send to server-side Gemini transcription
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        audioChunksRef.current = [];

        recorder.ondataavailable = (ev) => {
          if (ev.data.size > 0) {
            audioChunksRef.current.push(ev.data);
          }
        };

        recorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          const audioBlob = new Blob(audioChunksRef.current, {
            type: recorder.mimeType || 'audio/webm',
          });
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64Url = String(reader.result || '');
            const base64Data = base64Url.includes(',')
              ? base64Url.split(',')[1]
              : base64Url;
            if (base64Data) {
              await handleRunAiAnalysis(transcript, base64Data, audioBlob.type);
            }
          };
          reader.readAsDataURL(audioBlob);
        };

        mediaRecorderRef.current = recorder;
        setIsListening(true);
        recorder.start();
      } catch {
        setErrorBn(
          'মাইক্রোফোন চালু করা যায়নি। অনুগ্রহ করে ব্রাউজারের মাইক্রোফোন অনুমতি যাচাই করুন।'
        );
      }
    } else {
      setErrorBn(
        'আপনার ব্রাউজারে সরাসরি স্পিচ রিকগনিশন সমর্থিত নয়। নিচের টেক্সট বক্সে ভয়েস কিবোর্ড দিয়ে লিখুন।'
      );
    }
  };

  const handleRunAiAnalysis = async (
    textToAnalyze = transcript,
    audioBase64?: string,
    mimeType?: string
  ) => {
    stopListeningSafely();
    if (!textToAnalyze.trim() && !audioBase64) {
      setErrorBn(
        'অনুগ্রহ করে প্রথমে মাইক্রোফোনে কথা বলুন অথবা নিচের বক্সে প্রোডাকশন তথ্য লিখুন।'
      );
      return;
    }

    setIsAnalyzing(true);
    setErrorBn(null);
    try {
      const res = await analyzeVoiceProductionInput({
        transcript: textToAnalyze,
        audioBase64,
        mimeType,
        todayDateDDMMYYYY: defaultDateDDMMYYYY || getTodayDDMMYYYY(false),
      });

      if (res.errorBn || !res.data) {
        setErrorBn(
          res.errorBn || 'ভয়েস টেক্সট বিশ্লেষণ করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।'
        );
      } else {
        if (res.data.transcript) {
          setTranscript(res.data.transcript);
        }
        setExtractedData(res.data);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-voice-modal-title"
    >
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="px-4 sm:px-5 py-4 bg-teal-700 dark:bg-teal-800 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="ai-voice-modal-title"
                className="text-base font-bold truncate"
              >
                এআই ভয়েস প্রোডাকশন এন্ট্রি (AI Voice Entry)
              </h2>
              <p className="text-xs text-teal-100 truncate">
                বাংলায় কথা বলুন — এআই স্বয়ংক্রিয়ভাবে ফর্মের ঘরগুলো পূরণ করে দেবে
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-teal-600/60 text-white cursor-pointer shrink-0"
            aria-label="বন্ধ করুন"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Example Voice Prompt Box */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 text-xs space-y-1">
            <p className="font-bold text-slate-800 dark:text-slate-200">
              যেভাবে কথা বলবেন (উদাহরণ):
            </p>
            <p className="text-slate-600 dark:text-slate-400">
              • &ldquo;আজকে কটি, সাইজ ২৪, ২৫ ডজন কাজ করেছি, প্রতি ডজন ৩৫ টাকা রেট।&rdquo;
            </p>
            <p className="text-slate-600 dark:text-slate-400">
              • &ldquo;আজকে গোলগোলা, সাইজ ২৬, ১০০ পিস কাজ করেছি, প্রতি ডজন ৪০ টাকা।&rdquo;
            </p>
          </div>

          {/* Step 1: Microphone Recording Button */}
          <div className="flex flex-col items-center justify-center py-2 space-y-2.5">
            <button
              type="button"
              onClick={handleToggleListening}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg cursor-pointer ${
                isListening
                  ? 'bg-rose-600 hover:bg-rose-700 text-white ring-8 ring-rose-500/25 animate-pulse'
                  : 'bg-teal-700 hover:bg-teal-800 text-white ring-4 ring-teal-500/20'
              }`}
              aria-label={isListening ? 'ভয়েস থামান' : 'ভয়েস শুরু করুন'}
            >
              {isListening ? (
                <MicOff className="w-8 h-8" />
              ) : (
                <Mic className="w-8 h-8" />
              )}
            </button>
            <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 text-center">
              {isListening
                ? 'শুনছি... কথা বলা শেষ হলে মাইক্রোফোনে ট্যাপ করুন'
                : 'কথা বলতে মাইক্রোফোন বাটনে ট্যাপ করুন'}
            </p>
          </div>

          {/* Step 2: Transcribed Bengali Text (Editable) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="voice-transcript-box"
                className="text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                কথোপকথনের বাংলা টেক্সট (প্রয়োজনে সম্পাদনা করতে পারেন):
              </label>
              {transcript && (
                <button
                  type="button"
                  onClick={() => {
                    setTranscript('');
                    setExtractedData(null);
                    setErrorBn(null);
                  }}
                  className="text-xs text-slate-500 hover:text-rose-600 inline-flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>মুছুন</span>
                </button>
              )}
            </div>
            <textarea
              id="voice-transcript-box"
              rows={2}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="মাইক্রোফোনে বললে এখানে বাংলা লেখা উঠবে (অথবা সরাসরি এখানে লিখুন)..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs sm:text-sm text-slate-900 dark:text-slate-100"
            />
            <div className="flex justify-end">
              <button
                type="button"
                disabled={isAnalyzing || !transcript.trim()}
                onClick={() => handleRunAiAnalysis(transcript)}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 disabled:opacity-50 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {isAnalyzing
                    ? 'এআই বিশ্লেষণ করছে...'
                    : 'এআই দিয়ে তথ্য বিশ্লেষণ করুন'}
                </span>
              </button>
            </div>
          </div>

          {errorBn && (
            <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/50 p-3 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorBn}</span>
            </div>
          )}

          {/* Step 3 & 4: Extracted Data Preview & Missing Fields Warning */}
          {extractedData && (
            <div className="rounded-2xl border border-teal-200 dark:border-teal-800 bg-teal-50/40 dark:bg-teal-950/30 p-3.5 sm:p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-teal-200/70 dark:border-teal-800/70 pb-2">
                <span className="text-xs font-bold text-teal-900 dark:text-teal-200 inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-600" />
                  <span>এআই কর্তৃক সনাক্তকৃত প্রোডাকশন তথ্য:</span>
                </span>
                <span className="text-[11px] text-teal-700 dark:text-teal-400">
                  তারিখ: {toBengaliDigits(extractedData.date)}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-500 block">আইটেমের নাম:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {extractedData.itemName || 'উল্লেখ নেই'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-500 block">ক্যাটাগরি:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {extractedData.category || 'উল্লেখ নেই'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-500 block">সাইজ:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {extractedData.sizes.length > 0
                      ? extractedData.sizes.join(', ')
                      : 'উল্লেখ নেই'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-500 block">পরিমাণ (পিস ও ডজন):</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                    {extractedData.pieces !== null
                      ? `${toBengaliDigits(extractedData.pieces)} পিস (${formatDozensBn(
                          extractedData.dozens
                        )} ডজন)`
                      : 'উল্লেখ নেই'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-500 block">প্রতি ডজনের রেট:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                    {extractedData.ratePerDozen !== null
                      ? `${formatTaka(extractedData.ratePerDozen, true)}/ডজন`
                      : 'উল্লেখ নেই'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-teal-100/70 dark:bg-teal-900/50 border border-teal-300 dark:border-teal-700">
                  <span className="text-teal-800 dark:text-teal-300 block">
                    স্বয়ংক্রিয় মোট মজুরি:
                  </span>
                  <span className="font-mono font-bold text-teal-950 dark:text-teal-100">
                    {extractedData.totalWage !== null
                      ? formatTaka(extractedData.totalWage, true)
                      : '—'}
                  </span>
                </div>
              </div>

              {extractedData.missingFieldsBn.length > 0 && (
                <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 p-2.5 text-xs text-amber-800 dark:text-amber-200">
                  <strong>অনুপস্থিত তথ্য:</strong>{' '}
                  {extractedData.missingFieldsBn.join(', ')} — ফর্মে যাওয়ার পর আপনি ম্যানুয়ালি পূরণ করতে পারবেন।
                </div>
              )}

              <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onApplyToForm(extractedData);
                    onClose();
                  }}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>ফর্মে তথ্য বসান (যাচাই করে সংরক্ষণ করুন)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
