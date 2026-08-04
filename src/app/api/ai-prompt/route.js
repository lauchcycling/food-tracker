import { GoogleGenAI, Type } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req) {
  try {
    const { promptText } = await req.json();

    if (!promptText) {
      return NextResponse.json({ error: "Kein Text übergeben" }, { status: 400 });
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Analysiere folgende Nahrungsangabe in natürlicher Sprache und zerlege sie in logische einzelne Lebensmittel-Bestandteile mit realistischen Nährwerten pro 100g sowie der erkannten Gramm-Menge. Angabe: "${promptText}". Antworte ausschließlich im vorgegebenen JSON-Format.`
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              amount: { type: Type.NUMBER, description: "Gramm-Menge" },
              per100g: {
                type: Type.OBJECT,
                properties: {
                  calories: { type: Type.INTEGER },
                  p: { type: Type.NUMBER },
                  c: { type: Type.NUMBER },
                  f: { type: Type.NUMBER }
                },
                required: ["calories", "p", "c", "f"]
              }
            },
            required: ["name", "amount", "per100g"]
          }
        },
        temperature: 0.1
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("KI hat keine Antwort generiert.");
    }

    const parsedItems = JSON.parse(resultText);
    return NextResponse.json(parsedItems, { status: 200 });

  } catch (error) {
    console.error("AI Prompt API Fehler:", error);
    return NextResponse.json({ error: "Fehler bei der KI-Analyse." }, { status: 500 });
  }
}