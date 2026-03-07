export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { query } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  // 제공해주신 2개의 PDF File URI
  const pdf1 = "https://generativelanguage.googleapis.com/v1beta/files/v66m50n0k8v7";
  const pdf2 = "https://generativelanguage.googleapis.com/v1beta/files/w8y5unom36m8";

  const SYSTEM_PROMPT = `
  너는 한국거래소(KRX) 파생상품시장 업무규정 전문가야.
  
  # 데이터 활용 원칙 (중요)
  1. 최우선 순위: 제공된 2개의 PDF 파일 원문을 정밀 분석하여 답변해.
  2. 차순위: PDF에 정보가 전혀 없는 경우에만 Google 검색 결과를 보완적으로 사용해.
  3. 할루시네이션(환각) 금지: 확실하지 않은 내용은 추측하지 말고 솔직하게 말해줘.

  # 스타일 및 서식 지침 (필수)
  1. 문체: 아주 간결하고 깔끔한 토스 스타일 문체를 사용해 (~해요).
  2. 기호 제거: 따옴표(")와 섹션 앞의 ### 기호를 절대 쓰지 마.
  3. 강조 규칙: 강조가 필요한 모든 수치, 조항 번호, 핵심 단어는 반드시 **볼드체** 형식(앞뒤 별표 2개)으로만 감싸서 출력해. (프론트엔드에서 파란색으로 변환함)
  4. 섹션 타이틀: 아래 4개 제목을 반드시 포함하고, **볼드체**로만 작성해.
     - **한 줄 요약**
     - **상세 답변**
     - **관련 조항**
     - **유의사항**

  # 답변 양식
  **한 줄 요약**
  내용

  **상세 답변**
  핵심 정보 (**볼드체** 강조)

  **관련 조항**
  규정 또는 세칙 조항 번호 (**볼드체**)

  **유의사항**
  주의점 한 문장
  `;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { fileData: { mimeType: "application/pdf", fileUri: pdf1 } },
              { fileData: { mimeType: "application/pdf", fileUri: pdf2 } },
              { text: query }
            ]
          }
        ],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        tools: [{ google_search: {} }]
      })
    });

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    res.status(200).json({ text });
  } catch (err) {
    res.status(500).json({ error: "Failed to analyze files" });
  }
}
