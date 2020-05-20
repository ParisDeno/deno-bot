import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "https://deno.land/x/lambda/mod.ts";
import { Client } from "../../lib/twitter/Twitter.ts";
import type { RequestBody } from "../../lib/types.ts";

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
  // console.dir(context);
  // console.dir("================");
  // console.dir(req);

  // const params = new URLSearchParams(req.path.split("?")[1]);
  // if (params.has("crc_token")) {
  //   const response_token = Client.getInstance().challengeCRCResponse(
  //     params.get("crc_token")!,
  //   );
  //   return {
  //     body: JSON.stringify({
  //       response_token,
  //     }),
  //     headers: {
  //       "content-type": "application/json",
  //     },
  //     statusCode: 200,
  //   };
  // }

  // return {
  //   body: `${Deno.env.get("TWITTER_APP_ID")}`,
  //   headers: {
  //     "content-type": "text/html; charset=utf-8",
  //   },
  //   statusCode: 200,
  // };
}
