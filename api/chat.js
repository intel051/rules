import { google } from 'googleapis';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { query } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const driveFileIds = process.env.DRIVE_FILE_IDS;

  if (!apiKey || !serviceAccountJson || !driveFileIds) {
    return res.status(500).json({ error: "환경 변수 설정이 누락되었습니다." });
  }

  try {
    // 1. 서비스 계정 JSON 파싱 및 Private Key 줄바꿈 수정 (Vercel 특화)
    const serviceAccount = JSON.parse(serviceAccountJson);
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    const fileIds = driveFileIds.split(',').map(id => id.trim());

    // 2. Google Drive 인증 설정
    const auth = new google.auth.JWT(
      serviceAccount.client_email,
      null,
      serviceAccount.private_key,
      ['https://www.googleapis.com/auth/drive.readonly']
    );

    const drive = google.drive({ version: 'v3', auth });

    // 3. 드라이브에서 PDF 파일들 읽기
    const fileParts = await Promise.all(fileIds.map(async (fileId) => {
      try {
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
      } catch (fileErr) {
        console.error(`File ID ${fileId} 접근 실패:`, fileErr.message);
        return null;
      }
    }));

    const validFileParts = fileParts.filter(part => part !== null);

    if (validFileParts.length === 0) {
      return res.status(500).json({ error: "드라이브 파일에 접근할 수 없습니다. 권한 설정을 확인해주세요." });
    }

    const SYSTEM_PROMPT = `
      너는 한국거래소(KRX) 파생상품시장 업무규정 전문가야.
      
      # 답변 원칙
      1. 토스처럼 아주 간결하고 깔끔하게 대답해 (~해요).
      2. 강조할 때 큰따옴표(")나 ### 기호를 절대 쓰지 마.
      3. 중요 수치, 조항, 용어는 반드시 **볼드체** 형식으로 감싸줘. (파란색으로 표시됨)
      4. 답변 양식: **한 줄 요약**, **상세 답변**, **관련 조항**, **유의사항** 필수.
      5. 검색 시 할루시네이션이 없도록 한 번 더 검증 후 대답해줘.
    `;

    // 4. Gemini API 호출 (Google Search Grounding 포함)
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [...validFileParts, { text: query }]
        }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        tools: [{ "google_search": {} }]
      })
    });

    const result = await geminiRes.json();
    
    if (result.error) {
      return res.status(500).json({ error: `AI 응답 오류: ${result.error.message}` });
    }

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    res.status(200).json({ text });

  } catch (err) {
    console.error("Critical Error:", err.message);
    res.status(500).json({ error: `데이터 처리 실패: ${err.message}` });
  }
}
