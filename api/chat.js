export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { query } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  const SYSTEM_PROMPT = `
  너는 한국거래소(KRX) 파생상품시장 업무규정 및 시행세칙 전문가야.
  사용자의 질문에 대해 조항을 근거로 정확하게 답변해줘.

  # 답변 스타일
  1. 토스처럼 아주 간결하고 명확한 문체 사용 (~해요, ~예요).
  2. 강조할 때 중요한 수치나 용어는 "따옴표"와 **볼드체** 형식을 적절히 섞어줘.
  3. 답변 양식: "한 줄 요약", "상세 답변", "관련 조항", "유의사항" 순서로 작성해.
  4. 답변 중 긴 수치나 영어 단어가 있을 경우 말풍선 줄바꿈이 일어날 수 있도록 공백을 적절히 사용해.
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
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    res.status(200).json({ text });
  } catch (err) {
    res.status(500).json({ error: "API Error" });
  }
}
