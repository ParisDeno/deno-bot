import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "https://deno.land/x/lambda/mod.ts";
import type { RequestBody } from "../../lib/types.ts";
import { favRT } from "../../lib/features/fav_rt.ts";

/**
 * Cron every 15 mins
 * - get user timeline (50 item) "GET statuses/user_timeline.json?count=50&include_entities=false"
 * - save latest "status.id_str"
 * - save "status.id_str" with "favorited=true"
 * - save "status.id_str" with "reteweeted_status" object ("retweeted_status.id_str")
 * - search "#denoland && #deno_land && #parisdeno" and like and retweet if not already favorited and retweeted
 * - search "@deno_land && @ParisDeno" and like if not already favorited
 *
 * Accept params "dry_run" for dry run mode and "famous" to process only status with more or equal than 5 fav or rt.
 * Need deno bot secret header to work.
 */
export async function handler(
  event: APIGatewayProxyEvent,
  context: Context,
  req: RequestBody = JSON.parse(event.body ?? "{}"),
): Promise<APIGatewayProxyResult> {
  const params = new URLSearchParams(req.path.split("?")[1]);
  const famous = params.has("famous");
  const dryRun = params.has("dry_run") || params.has("dr") ||
    params.has("dry") || params.has("dryRun");

  const [countFav, countRT] = await favRT(dryRun, famous);
  return {
    body: "OK",
    headers: {
      "x-deno-bot-favorited": countFav,
      "x-deno-bot-retweeted": countRT,
    },
    statusCode: 200,
  };
}
