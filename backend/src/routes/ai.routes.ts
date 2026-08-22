import { Router, type Request, type Response } from "express";

const router = Router();

type AIChatBody = {
  message?: string;
};

router.post(
  "/chat",
  async (
    req: Request<Record<string, never>, unknown, AIChatBody>,
    res: Response,
  ) => {
    const message = req.body.message?.trim();

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(503).json({
        success: false,
        message: "Gemini API key is not configured",
      });
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
          apiKey,
        )}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `You are CodeForensic Forensic AI.

Rules:
- Do not invent files, commits, authors, vulnerabilities or dependencies.
- Clearly distinguish FACT, INFERENCE and RECOMMENDATION.
- If evidence is insufficient, say so.
- Be concise and technical.

Question:
${message}`,
                  },
                ],
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        console.error(
          "Gemini API error:",
          response.status,
          await response.text(),
        );

        return res.status(502).json({
          success: false,
          message: "Gemini request failed",
        });
      }

      const data = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              text?: string;
            }>;
          };
        }>;
      };

      const answer =
        data.candidates?.[0]?.content?.parts
          ?.map((part) => part.text ?? "")
          .join("")
          .trim() ?? "";

      return res.json({
        success: true,
        answer:
          answer ||
          "I don't have enough evidence to determine this reliably.",
      });
    } catch (error) {
      console.error("AI route error:", error);

      return res.status(500).json({
        success: false,
        message: "Forensic AI request failed",
      });
    }
  },
);

export default router;