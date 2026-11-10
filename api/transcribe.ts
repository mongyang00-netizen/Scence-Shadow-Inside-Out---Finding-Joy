import { GoogleGenAI } from '@google/genai';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Only POST is supported.' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY_NOT_CONFIGURED',
        message: 'Server Gemini API key is not configured. Please set GEMINI_API_KEY in Vercel Environment Variables.',
      });
    }

    const { audioBase64, mimeType, sentenceText } = req.body || {};
    if (!audioBase64) {
      return res.status(400).json({
        error: 'MISSING_AUDIO_DATA',
        message: 'audioBase64 is required.',
      });
    }

    let cleanMimeType = (mimeType || 'audio/webm').split(';')[0].trim();
    if (!cleanMimeType.startsWith('audio/')) {
      cleanMimeType = 'audio/webm';
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const audioPart = {
      inlineData: {
        mimeType: cleanMimeType,
        data: audioBase64,
      },
    };

    const promptText = sentenceText
      ? `Transcribe exactly what the student spoke in English from this audio recording. The student is attempting to shadow this sentence: "${sentenceText}". Output ONLY the exact transcribed English words, with no explanations, punctuation, or commentary. If inaudible or empty, output nothing.`
      : `Transcribe the spoken English speech in this audio accurately. Output ONLY the transcribed English text with no quotes or commentary.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          audioPart,
          { text: promptText },
        ],
      },
    });

    const rawTranscript = response.text || '';
    const transcript = rawTranscript.trim().replace(/^["']|["']$/g, '');

    return res.status(200).json({
      transcript,
      mimeType: cleanMimeType,
    });
  } catch (error: any) {
    console.error('Vercel serverless transcribe error:', error);
    return res.status(500).json({
      error: 'TRANSCRIPTION_FAILED',
      message: error?.message || 'Failed to transcribe audio',
    });
  }
}
