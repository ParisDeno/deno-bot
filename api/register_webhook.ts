import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "https://deno.land/x/lambda/mod.ts";
import { Client } from "../lib/twitter/Twitter.ts";
import { RequestBody } from "../lib/types.ts";

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context,
  req: RequestBody = JSON.parse(event.body ?? "{}"),
): Promise<APIGatewayProxyResult> {
  return {
    body: `Disabled.`,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
    statusCode: 302,
  };
  // const t = Client.getInstance();

  // const params = new URLSearchParams(req.path.split("?")[1]);
  // const force = params.has("force");

  // try {
  //   const webhook = await t.getWebhook();
  //   if (webhook) {
  //     console.log("Register: Webhook found", webhook);
  //     if (!webhook.valid) {
  //       console.log("Register: Webhook not valid, rearm...");
  //       if (!t.rearmWebhook(webhook.id)) {
  //         console.log("Register: Webhook rearm failed, delete...");
  //         t.deleteWebhook(webhook.id) || console.log("Register: Delete failed");
  //       } else {
  //         if (!force) {
  //           return {
  //             body: "Webhook rearmed.",
  //             headers: {
  //               "content-type": "text/html; charset=utf-8",
  //             },
  //             statusCode: 200,
  //           };
  //         }
  //       }
  //     } else {
  //       if (!force) {
  //         return {
  //           body: "Webhook is already active.",
  //           headers: {
  //             "content-type": "text/html; charset=utf-8",
  //           },
  //           statusCode: 200,
  //         };
  //       }
  //     }
  //   }
  //   console.log("Register: Webhook registering");
  //   const register = await t.registerWebhook(
  //     `https://${req.host}/api/webhook/twitter`,
  //   );
  //   return {
  //     body: JSON.stringify(register),
  //     headers: {
  //       "content-type": "application/json",
  //     },
  //     statusCode: 200,
  //   };
  // } catch (e) {
  //   console.error(e);
  //   return {
  //     body: `<p>Someting went wrong. Please look at <a href="https://${
  //       req.headers["x-vercel-deployment-url"]
  //     }/_logs">the logs</a>.</p>`,
  //     headers: {
  //       "content-type": "text/html; charset=utf-8",
  //     },
  //     statusCode: 500,
  //   };
  // }
}
