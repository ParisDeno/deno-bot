# deno-bot
Deno Bot made in Deno used to like and retweet stuff with configured hashtags (primarily #denoland)

## Setup
### Vercel (Zeit)
Fork this repository then import a project in Vercel from Git (https://vercel.com/import/git)  
After your project is imported, add required env var ; from your project overview, "Setting > General > Environment Variables". You can found a template in [.env.dist](.env.dist) file.

### Other
This bot was not tested in other environement. But should works as Amazon Lambda. Please don't hesitate to edit this section if you succeed to make it work elsewhere.

## Lambdas
###  `/task/fav_rt`
Lambda to run manually or with a cron.  
Will:
- get user favorited statuses (200) `GET favorites/list.json?include_entities=false`
- save `status.id_str`
- get user timeline (200) `GET statuses/user_timeline.json?include_entities=false`
- save `status.id_str` with `reteweeted_status` object (`retweeted_status.id_str`)
- search `#denoland && #deno_land && #parisdeno` and like and retweet if not already favorited and retweeted (100 items by default)
- search `@deno_land && @ParisDeno` and like if not already favorited (100 items by default)
- if famous mode filter `recent` type statuses, else filter `mixed` (which is `popular` + `recent`)
- optionally send operation result to a Discord webhook (success and errors)

#### Params
- `dr` | `dryRun` | `dry_run` | `dry` - when set, will only read data and output (console, discord)
- `famous` - when set, will filter found request to only statuses with at least 5 fav or RT. This can help limit the flood.

#### Header
- `x-deno-bot-secret` - must be equivalent to env var `DENO_BOT_SECRET`

## Env var
Most of `TWITTER_` var can be found after creating a dev account and an app: https://developer.twitter.com/en/apps  
Then go to "Keys and tokens" tab. 

- `TWITTER_ACCESS_TOKEN` - App Access token ; used for OAuth1.0-a
- `TWITTER_ACCESS_TOKEN_SECRET` - App Access token secret ; used for OAuth1.0-a
- `TWITTER_CONSUMER_KEY` - User API key
- `TWITTER_CONSUMER_SECRET` - User API secret key
- `TWITTER_APP_ID` - App ID (found in "apps" page)
- `WEBHOOK_ENV` - When using webhook, env name where to register subscriptions
- `DENO_BOT_SECRET` - more or less complexe pass(word|phrase) that shoud be set in header
- `DISCORD_WEBHOOK` - (Optional) http link to a discord webhook.

## Todo
- [ ] add config for "famous" threshold
- [ ] webhook
  - ignore my likes and retweets
  - retweet pings
  - auto reply DM with "Sorry I'm only a bot"

## Maintainer
[Lilian Saget-Lethias](https://github.com/bios21)  
[ParisDeno](https://github.com/ParisDeno)  

## Licence

[MIT](LICENSE)
