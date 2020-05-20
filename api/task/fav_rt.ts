import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "https://deno.land/x/lambda/mod.ts";
import type { RequestBody } from "../../lib/types.ts";
import { Client, TweetStatus } from "../../lib/twitter/Twitter.ts";
import type { SearchBuilder } from "../../lib/twitter/SearchBuilder.ts";
import { logDiscord, errorDiscord } from "../../lib/utils.ts";

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

  const twitter = Client.getInstance();
  const timeline = await twitter.getTimeline();
  const alreadyFavorited = timeline.filter((status) => status.favorited).map(
    (status) => status.id_str,
  );
  const alreadyRetweeted = timeline.filter((status) => status.retweeted).map(
    (status) => status.retweeted_status!.id_str,
  );

  let countFav = 0, countRT = 0;
  const favAndRT = async (statuses: TweetStatus[], fav = true, rt = true) => {
    const p: Promise<any>[] = [];
    for (const status of statuses) {
      if (fav && !alreadyFavorited.includes(status.id_str)) {
        if (dryRun) {
          console.info(
            `FAV ${status.id_str} ${
              status.text.replace("\r\n", "").substr(0, 50)
            }`,
          );
        } else {
          p.push(twitter.favorite(status.id_str));
        }
        countFav++;
        alreadyFavorited.push(status.id_str);
      } else console.info(`> FAV skipped ${status.id_str}`);

      if (rt && !alreadyRetweeted.includes(status.id_str)) {
        if (dryRun) {
          console.info(
            `RT ${status.id_str} ${
              status.text.replace("\n", "").substr(0, 50)
            }`,
          );
        } else {
          p.push(twitter.retweet(status.id_str));
        }
        countRT++;
        alreadyRetweeted.push(status.id_str);
      } else console.info(`> RT skipped ${status.id_str}`);
    }

    await Promise.allSettled(p);
  };

  const strictSearch = (sb: SearchBuilder) =>
    sb.exc.subject("RT").exc
      .filter(
        "replies",
      ).inc.lang("fr", "en");

  const searchHashtags = await twitter.search((sb) =>
    strictSearch(sb.inc.subject("#denoland", "#deno_land", "#parisdeno"))
      .toString()
  );
  const searchUsers = await twitter.search((sb) =>
    strictSearch(sb.inc.subject("@deno_land", "@ParisDeno")).toString()
  );

  const filterFamous = (s: TweetStatus) =>
    !famous || s.favorite_count > 4 || s.retweet_count > 4;

  await favAndRT(
    searchHashtags.filter(filterFamous),
  );
  await favAndRT(
    searchUsers.filter(filterFamous),
    true,
    false,
  );

  await logDiscord(
    `Webhook ended: 💙 = ${countFav} ; RT = ${countRT} ${
      dryRun ? "(dry run mode)" : ""
    }`,
  );

  const errors = twitter.getErrorList();
  if (errors.length) {
    await errorDiscord(errors);
  }

  return {
    body: "OK",
    headers: {
      "x-deno-bot-favorited": countFav,
      "x-deno-bot-retweeted": countRT,
    },
    statusCode: 200,
  };
}
