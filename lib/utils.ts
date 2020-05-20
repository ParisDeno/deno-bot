import { RequestBody } from "./types.ts";

export function getBody<T = any>(req: RequestBody) {
  const rawBody = req.body
    ? req.encoding === "base64" ? atob(req.body as string) : req.body
    : null;

  if (typeof rawBody === "string") {
    if (rawBody.includes("Content-Disposition: form-data")) {
      throw new Error(
        "Form Data unsuported. Please user raw json or urlencorded data",
      );
    } else if (rawBody.startsWith("{") || rawBody.startsWith("[")) {
      return JSON.parse(rawBody) as T;
    } else {
      const usp = new URLSearchParams(rawBody);
      let body: any = {};
      usp.forEach((v, k) => body[k] = v);
      return body as T;
    }
  } else throw new Error("Unsuported body type");
}

export function assertAccess(req: RequestBody): asserts req {
  const secret = Deno.env.get("DENO_BOT_SECRET");
  const headerSecret = req.headers["x-deno-bot-secret"];
  if (!secret || !headerSecret) {
    throw new Error("No secret, no webhook. 😛");
  } else if (secret !== headerSecret) {
    throw new Error("Bad secret. 🙅‍♂️");
  }
}

export async function logDiscord(message: string) {
  const DISCORD_WEBHOOK = Deno.env.get("DISCORD_WEBHOOK");
  if (!DISCORD_WEBHOOK) {
    console.warn("No DISCORD_WEBHOOK found.");
    return;
  }

  return await fetch(DISCORD_WEBHOOK, {
    method: "POST",
    body: new URLSearchParams({
      content: `deno-bot execution result: \`${message}\``,
    }),
  });
}

export async function errorDiscord(data: any) {
  const DISCORD_WEBHOOK = Deno.env.get("DISCORD_WEBHOOK");
  if (!DISCORD_WEBHOOK) {
    console.warn("No DISCORD_WEBHOOK found.");
    return;
  }

  const body = new FormData();
  const strData = JSON.stringify(data);
  if (strData.length > 1000) {
    body.set("content", ":warning: deno-bot execution **failed**!");
    body.set(
      "file",
      new Blob([strData], { type: "application/json" }),
      "errors.json",
    );
  } else {
    body.set(
      "content",
      `:warning: deno-bot execution **failed**!\n\n\`\`\`json\n${strData}\n\`\`\``,
    );
  }

  return await fetch(DISCORD_WEBHOOK, {
    method: "POST",
    body,
  });
}
