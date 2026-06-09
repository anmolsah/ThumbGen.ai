import OpenAI from "openai";

const openRouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY as string,
  baseURL: "https://openrouter.ai/api/v1",
});

export default openRouter;
