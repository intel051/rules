export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { query } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  const SYSTEM_PROMPT = `
  너는 한국거래소(KRX) 파생상품시장 업무규정 및 시행세칙 전문가야.
  
  # 데이터 활용 원칙 (중요)
  1. 최우선 순위: 업로드된 PDF 파일("파생상품시장 업무규정", "파생상품시장 업무규정 시행세칙")에서 답변을 찾으세요.
  2. 차순위: PDF 내에 정보가 없거나, 실시간 시장 조치(예: 오늘자 공지 등)가 필요한 경우에만 Google 검색 그라운딩을 활용하세요.
  3. 근거 명시: 답변 끝에 "출처: 업무규정 제○조" 또는 "출처: 구글 검색 결과"와 같이 정보의 근거를 반드시 밝히세요.

  # 스타일 및 규칙
  1. 토스 스타일로 간결하고 깔끔한 문체를 사용해 (~해요).
  2. 강조할 때 별표(**)를 직접 쓰지 말고, 따옴표(")를 사용하거나 시스템 렌더링을 위해 **볼드체** 형식을 포함해.
  3. 모든 전문 용어는 가급적 "따옴표"로 감싸줘.
  4. 답변 양식: "한 줄 요약", "상세 답변", "관련 조항", "유의사항" 순서로 작성해.
  5. 할루시네이션 방지를 위해 모르는 내용은 솔직하게 확인 불가하다고 답해줘.
  `;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
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
    res.status(500).json({ error: "Failed" });
  }
}
