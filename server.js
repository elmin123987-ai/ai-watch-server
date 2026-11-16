const express = require('express');
const app = express();
app.use(express.json());

const API_KEY = process.env.LLM_API_KEY;
const API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const MODELS = [
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
  'qwen/qwen3.8-27b'
];

async function askGroq(text, systemPrompt) {
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: text });

  const tried = [];
  let lastError = null;

  for (const model of MODELS) {
    try {
      const r = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({ model, messages, max_tokens: 200, temperature: 0.3 })
      });
      const data = await r.json();

      if (data.error) {
        if (/invalid_api_key|unauthorized/i.test(data.error.message || '')) {
          return { error: data.error.message, tried };
        }
        tried.push({ model, error: data.error.message });
        lastError = data.error.message;
        continue;
      }

      const answer = data?.choices?.[0]?.message?.content?.trim();
      if (answer) return { answer, model, tried };

      tried.push({ model, error: 'Пустой ответ' });
      lastError = 'Пустой ответ';
    } catch (e) {
      tried.push({ model, error: e.message });
      lastError = e.message;
    }
  }

  return { error: 'Все модели недоступны', last: lastError, tried };
}

app.post('/ask', async (req, res) => {
  const q = (req.body.q || '').trim().slice(0, 500);
  if (!q) return res.json({ answer: 'Пустой вопрос' });
  const result = await askGroq(q, 'Отвечай очень кратко, 1-3 предложения.');
  if (result.error) return res.json({ answer: `Ошибка: ${result.error}` });
  res.json({ answer: result.answer });
});

app.get('/test', async (req, res) => {
  const result = await askGroq('Capital of Australia?');
  res.json(result);
});

app.get('/ping', (_, res) => res.send('ok'));
app.get('/', (_, res) => res.send('AI-сервер работает. /ping, /test'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Сервер: http://localhost:${PORT}`));
