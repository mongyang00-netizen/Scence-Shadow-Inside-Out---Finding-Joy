import express from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Middleware for parsing JSON (audio data is sent as base64 in JSON payload, limit 25MB)
  app.use(express.json({ limit: '25mb' }));

  // Initialize GoogleGenAI SDK on server-side with User-Agent telemetry
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  // Audio Transcription STT Endpoint for Recorded Audio Blobs
  // Expects { audioBase64: string, mimeType: string, sentenceText?: string }
  app.post('/api/transcribe', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: 'GEMINI_API_KEY_NOT_CONFIGURED',
          message: 'Server Gemini API key is not configured. Please set GEMINI_API_KEY in environment variables.',
        });
      }

      const { audioBase64, mimeType, sentenceText } = req.body;
      if (!audioBase64) {
        return res.status(400).json({
          error: 'MISSING_AUDIO_DATA',
          message: 'audioBase64 field is required.',
        });
      }

      // Clean mimeType (remove codecs parameters if present for Gemini API compatibility)
      // e.g. "audio/webm;codecs=opus" -> "audio/webm", "audio/mp4" -> "audio/mp4"
      let cleanMimeType = (mimeType || 'audio/webm').split(';')[0].trim();
      if (!cleanMimeType.startsWith('audio/')) {
        cleanMimeType = 'audio/webm';
      }

      const audioPart = {
        inlineData: {
          mimeType: cleanMimeType,
          data: audioBase64,
        },
      };

      const promptText = sentenceText
        ? `Transcribe exactly what the student spoke in English from this audio recording. The student is attempting to shadow this sentence: "${sentenceText}". Output ONLY the exact transcribed English words, with no explanations, punctuation, or commentary. If inaudible or empty, output nothing.`
        : `Transcribe the spoken English speech in this audio accurately. Output ONLY the transcribed English text with no quotes or commentary.`;

      // Use gemini-2.5-flash as the fast, cost-effective multimodal transcription model
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
      // Clean up transcript
      const transcript = rawTranscript.trim().replace(/^["']|["']$/g, '');

      return res.json({
        transcript,
        mimeType: cleanMimeType,
      });
    } catch (error: any) {
      console.error('Transcription API error:', error);
      const errMsg = error?.message || 'Failed to transcribe audio';
      return res.status(500).json({
        error: 'TRANSCRIPTION_FAILED',
        message: errMsg,
      });
    }
  });

  // In development, hook up Vite dev server middlewares
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve built static files from dist
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });

  return app;
}

// Start server if run directly
createServer();
