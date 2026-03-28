import OpenAI from "openai";

const xai = new OpenAI({
  apiKey: process.env.XAI_API_KEY as string,
  baseURL: "https://api.x.ai/v1",
});

export default xai;
