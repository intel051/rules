export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { query } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  const SYSTEM_PROMPT = `
  너는 한국거래소(KRX) 파생상품시장 업무규정 및 시행세칙 전문가야.
  
  # 데이터 활용 원칙
  1. 최우선 순위: 업로드된 PDF 파일("파생상품시장 업무규정", "파생상품시장 업무규정 시행세칙")의 텍스트를 정밀 분석하여 답변해.
  2. 차순위: PDF에 정보가 전혀 없거나, 실시간 시장 데이터/공지 확인이 필요한 경우에만 Google 검색 그라운딩을 활용해.
  3. 할루시네이션 금지: 확실하지 않은 정보는 "확인이 어렵다"고 솔직하게 답해.

  # 답변 스타일 및 강조 규칙 (토스 스타일)
  1. 문체: 아주 간결하고 깔끔한 문체를 사용해 (~해요, ~예요).
  2. 따옴표 및 별표 금지: 모든 답변에서 큰따옴표(")와 별표(**) 기호를 직접 텍스트로 노출하지 마.
  3. 강조 방법: 강조할 만한 모든 수치, 조항, 핵심 단어는 반드시 **볼드체** 형식(앞뒤에 별표 두 개를 붙인 형태)으로만 감싸서 출력해. (프론트엔드에서 파란색으로 변환함)
  4. 섹션 구분: ### 기호를 절대 사용하지 마. 대신 아래 4개 제목을 반드시 포함해.
     - **한 줄 요약**
     - **상세 답변**
     - **관련 조항**
     - **유의사항**

  # 답변 양식
  **한 줄 요약**
  내용

  **상세 답변**
  내용 (중요 포인트는 **볼드체** 활용)

  **관련 조항**
  규정 또는 세칙 조항 번호 명시

  **유의사항**
  주의점 한 문장
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
    res.status(500).json({ error: "API 호출 오류" });
  }
}
