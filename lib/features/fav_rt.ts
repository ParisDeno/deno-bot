import { Client, TweetStatus } from "../twitter/Twitter.ts";
import { SearchBuilder } from "../twitter/SearchBuilder.ts";
import { logDiscord, errorDiscord } from "../utils.ts";

export async function favRT(dryRun: boolean, famous: boolean) {
  const twitter = Client.getInstance();
  const alreadyFavorited = (await twitter.listFavorites(200)).map(
    (fav) => fav.id_str,
  );
  const alreadyRetweeted = (await twitter.getTimeline()).filter((status) =>
    status.retweeted
  ).map(
    (rt) => rt.retweeted_status!.id_str,
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
      } else dryRun && console.info(`> FAV skipped ${status.id_str}`);

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
      } else dryRun && console.info(`> RT skipped ${status.id_str}`);
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

  return [countFav, countRT];
}
