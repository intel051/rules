// Vercel Serverless Function
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query } = req.body;
  // Vercel 환경 변수에서 키를 가져옵니다.
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API Key not configured' });
  }

  const SYSTEM_PROMPT = `
  너는 "한국거래소(KRX) 파생상품시장 업무규정 및 시행세칙" 전문가야.
  사용자의 질문에 대해 정확하게 답변해줘.

  # 스타일
  1. 토스처럼 아주 간결하고 깔끔한 문체 사용 (~해요, ~예요).
  2. 강조하고 싶은 단어나 문구는 반드시 **볼드체**로 작성해. 별표 기호는 빼지 말고 포함해줘.
  3. 인사말 없이 본론부터 시작해.

  # 답변 양식
  **한 줄 요약**
  내용 요약

  **상세 답변**
  1. 내용 (**볼드체** 활용)
  
  **관련 조항**
  규정 제○조

  **유의사항**
  주의점 한 문장.
  `;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: query }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        tools: [{ google_search: {} }]
      })
    });

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "답변을 생성할 수 없습니다.";
    
    res.status(200).json({ text });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch from Gemini' });
  }
}

