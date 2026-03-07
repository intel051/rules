import { google } from 'googleapis';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { query } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const driveFileIds = process.env.DRIVE_FILE_IDS; // 쉼표로 구분된 ID들

  if (!apiKey || !serviceAccountJson || !driveFileIds) {
    return res.status(500).json({ error: "환경 변수(API_KEY, SERVICE_ACCOUNT_JSON, DRIVE_FILE_IDS)를 확인해주세요." });
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    const fileIds = driveFileIds.split(',').map(id => id.trim());

    // 1. Google Drive 인증 설정
    const auth = new google.auth.JWT(
      serviceAccount.client_email,
      null,
      serviceAccount.private_key,
      ['https://www.googleapis.com/auth/drive.readonly']
    );

    const drive = google.drive({ version: 'v3', auth });

    // 2. 드라이브에서 PDF 파일들 읽기 (Base64 변환)
    const fileParts = await Promise.all(fileIds.map(async (fileId) => {
      const response = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'arraybuffer' }
      );
      return {
        inlineData: {
          mimeType: "application/pdf",
          data: Buffer.from(response.data).toString('base64')
        }
      };
    }));

    const SYSTEM_PROMPT = `
      너는 한국거래소(KRX) 파생상품시장 업무규정 전문가야.
      
      # 데이터 활용 원칙
      1. 최우선 순위: 함께 전달된 PDF 파일 내용을 바탕으로 정확하게 답변해.
      2. 차순위: PDF에 내용이 없으면 Google 검색 그라운딩을 통해 보완해.

      # 스타일 및 서식 규칙 (엄수)
      1. 문체: 토스처럼 아주 간결하고 깔끔한 문체를 사용해 (~해요).
      2. 기호 제거: 따옴표(")와 섹션 앞의 ### 기호를 절대 쓰지 마.
      3. 강조 방법: 모든 중요 수치, 용어, 조항 번호는 반드시 **볼드체** 형식으로만 감싸서 출력해. (프론트엔드에서 파란색으로 변환됨)
      4. 섹션 타이틀: 아래 4개 제목을 반드시 포함하고, **볼드체**로만 작성해.
         - **한 줄 요약**
         - **상세 답변**
         - **관련 조항**
         - **유의사항**
    `;

    // 3. Gemini API 호출
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [...fileParts, { text: query }]
        }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        tools: [{ google_search: {} }]
      })
    });

    const result = await geminiRes.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    res.status(200).json({ text });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "드라이브 연결 또는 분석 중 오류 발생" });
  }
}

