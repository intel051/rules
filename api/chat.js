import { google } from 'googleapis';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: "Method Not Allowed" });

  const { query } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const driveFileIds = process.env.DRIVE_FILE_IDS;

  // 1. 환경 변수 누락 체크
  if (!apiKey || !serviceAccountJson || !driveFileIds) {
    return res.status(500).json({ 
      error: "Vercel 환경 변수(API_KEY, JSON, FILE_IDS) 중 일부가 설정되지 않았어요. 대시보드를 확인해 주세요." 
    });
  }

  try {
    // 2. JSON 파싱 및 Private Key 복구
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch (e) {
      return res.status(500).json({ error: "GOOGLE_SERVICE_ACCOUNT_JSON 형식이 올바른 JSON이 아니에요. 복사할 때 오타가 났는지 확인해 주세요." });
    }

    const privateKey = serviceAccount.private_key ? serviceAccount.private_key.replace(/\\n/g, '\n') : null;
    if (!privateKey) return res.status(500).json({ error: "JSON 내부에 private_key가 없어요." });

    // 3. Google Drive 인증 및 파일 로드
    const auth = new google.auth.JWT(
      serviceAccount.client_email,
      null,
      privateKey,
      ['https://www.googleapis.com/auth/drive.readonly']
    );

    const drive = google.drive({ version: 'v3', auth });
    const fileIds = driveFileIds.split(',').map(id => id.trim());

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
      } catch (err) {
        console.error(`File ${fileId} 접근 실패:`, err.message);
        return null;
      }
    }));

    const validParts = fileParts.filter(p => p !== null);
    if (validParts.length === 0) {
      return res.status(500).json({ error: "구글 드라이브 파일에 접근할 수 없어요. 서비스 계정 이메일을 PDF 공유 대상(뷰어)으로 추가했는지 확인해 주세요." });
    }

    // 4. Gemini API 호출
    const systemInstruction = `
      너는 한국거래소(KRX) "해외주식파생부 국내파생팀" 소속의 파생상품시장 업무규정 전문가야.
      
      # 답변 원칙
      1. 토스처럼 아주 간결하고 깔끔하게 대답해 (~해요).
      2. 섹션 타이틀 앞의 ### 기호는 절대 쓰지 마.
      3. 강조가 필요한 부분은 따옴표(")를 사용하거나 **볼드체** 형식을 사용해. (UI에서 파란색으로 변함)
      4. 답변 양식: 아래 4개 제목을 반드시 포함해.
         - **한 줄 요약**
         - **상세 답변**
         - **관련 조항**
         - **유의사항**
      5. 제공된 PDF 내용을 최우선으로 분석하고, 검색 결과를 통해 할루시네이션이 없도록 검증해.
    `;

    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [...validParts, { text: query }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        tools: [{ "google_search": {} }]
      })
    });

    const result = await geminiRes.json();
    if (result.error) throw new Error(`Gemini API 오류: ${result.error.message}`);

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    res.status(200).json({ text: text || "답변을 생성하지 못했어요." });

  } catch (err) {
    console.error("Critical Server Error:", err);
    res.status(500).json({ error: `서버 오류 발생: ${err.message}` });
  }
}