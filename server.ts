import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured in environment secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractGeminiError(error: unknown, fallback: string): { status: number; message: string } {
  const rawMessage = error instanceof Error ? error.message : fallback;
  if (rawMessage.includes('GEMINI_API_KEY')) {
    return { status: 503, message: rawMessage };
  }
  try {
    const parsed = JSON.parse(rawMessage) as { error?: { code?: number; message?: string; status?: string } };
    if (parsed?.error?.message) {
      const code = typeof parsed.error.code === 'number' ? parsed.error.code : 500;
      const friendlyHint =
        code === 403
          ? ' Please check your billing-enabled API key in Settings > Secrets.'
          : '';
      return {
        status: code >= 400 && code < 600 ? code : 500,
        message: `${parsed.error.message}${friendlyHint}`,
      };
    }
  } catch {
    // not JSON, return raw text
  }
  return { status: 500, message: rawMessage };
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'campusshield-server' });
  });

  // Multi-turn AI Safety Advisor (grounded in campus sectors & active alerts)
  app.post('/api/ai/safety-chat', async (req, res) => {
    try {
      const { messages, campusContext } = req.body as {
        messages?: { role: 'user' | 'assistant'; text: string }[];
        campusContext?: {
          userName?: string;
          userRole?: string;
          activeIncidentSummary?: string;
          sectorSummary?: string;
        };
      };

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'Conversation messages are required.' });
      }

      const latestUserMessage = messages[messages.length - 1]?.text?.trim();
      if (!latestUserMessage) {
        return res.status(400).json({ error: 'Message text cannot be empty.' });
      }

      const ai = getGeminiClient();

      const systemInstruction = [
        'You are CampusShield Safety Advisor, an expert university campus safety, safe-commute, and emergency preparedness assistant.',
        'Respond concisely (under 180 words unless asked for more detail), calmly, and with concrete campus-grounded next steps.',
        'Always clarify that CampusShield coordinates campus security dispatch and simulated prototype notifications—in a real life-threatening emergency outside prototype testing, advise contacting local emergency services.',
        campusContext?.userName
          ? `Active User: ${campusContext.userName} (${campusContext.userRole || 'student'}).`
          : '',
        campusContext?.sectorSummary
          ? `Monitored Campus Sectors:\n${campusContext.sectorSummary}`
          : '',
        campusContext?.activeIncidentSummary
          ? `Current Active Campus Alerts:\n${campusContext.activeIncidentSummary}`
          : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      const historyContents = messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.text }],
      }));

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: historyContents,
        config: {
          systemInstruction,
        },
      });

      const reply = (response.text || '').trim();
      if (!reply) {
        return res.status(502).json({ error: 'Empty response received from Gemini model.' });
      }

      return res.json({ reply });
    } catch (error) {
      const formatted = extractGeminiError(error, 'Failed to generate AI safety response.');
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Structured AI Incident Tactical & Escalation Brief
  app.post('/api/ai/incident-brief', async (req, res) => {
    try {
      const { incident } = req.body as {
        incident?: {
          id?: string;
          category?: string;
          description?: string;
          sectorName?: string;
          priority?: string;
          isSos?: boolean;
          isLateNight?: boolean;
          isAlone?: boolean;
        };
      };

      if (!incident || !incident.description || !incident.category) {
        return res.status(400).json({ error: 'Incident category and description are required.' });
      }

      const ai = getGeminiClient();
      const prompt = `Analyze this campus safety incident and produce a concise tactical dispatch & student safety brief:
Category: ${incident.category}
Sector: ${incident.sectorName || 'Campus'}
Current Priority: ${incident.priority || 'High'}
SOS Beacon: ${incident.isSos ? 'Yes' : 'No'}
Late Night: ${incident.isLateNight ? 'Yes' : 'No'}
Alone: ${incident.isAlone ? 'Yes' : 'No'}
Details: ${incident.description}`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'You are a university campus security dispatch analyst. Return concise, operational tactical advice in strict JSON.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              riskSummary: { type: Type.STRING },
              recommendedPatrolAction: { type: Type.STRING },
              studentSafetyDirective: { type: Type.STRING },
              checkList: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['riskSummary', 'recommendedPatrolAction', 'studentSafetyDirective', 'checkList'],
          },
        },
      });

      const raw = (response.text || '').trim();
      const parsed = JSON.parse(raw);
      return res.json({ brief: parsed });
    } catch (error) {
      const formatted = extractGeminiError(error, 'Failed to generate AI incident brief.');
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CampusShield server listening on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start CampusShield server:', err);
  process.exit(1);
});
