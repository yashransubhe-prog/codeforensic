import { Router } from "express";

const router = Router();

router.post("/chat", async (req, res) => {
  const message = req.body?.message;

  if (!message) {
    return res.status(400).json({
      success: false,
      message: "Message is required",
    });
  }

  return res.json({
    success: true,
    message: "Forensic AI route is working",
  });
});

export default router;