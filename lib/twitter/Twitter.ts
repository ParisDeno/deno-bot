import { assert } from "https://deno.land/std/testing/asserts.ts";
import { hmac } from "https://deno.land/x/hmac/mod.ts";
import { OAuth } from "../oauth-1.0a/OAuth.ts";
import { SearchBuilder } from "./SearchBuilder.ts";

const TWITTER_API = "https://api.twitter.com/1.1";

interface WebhookGet {
  id: number;
  url: string;
  valid: boolean;
  created_timestamp: string;
}

export interface TweetStatus {
  created_at: string;
  id: number;
  id_str: string;
  text: string;
  truncated: boolean;
  entities: {
    hastags: Array<{ text: string; indices: number[] }>;
    symbols: any[];
  };
  user_mentions: Array<{
    screen_name: string;
    name: string;
    id: number;
    id_str: string;
    indices: number[];
  }>;
  source: string;
  retweet_count: number;
  favorite_count: number;
  favorited: boolean;
  retweeted: boolean;
  retweeted_status?: TweetStatus;
}

export interface TweetSearchResult {
  statuses: TweetStatus[];
  search_metadata: {
    next_results: string;
    count: number;
  };
}

interface ErrorEntry {
  readonly code: number;
  readonly error: Error["name"];
  readonly errorMessage: Error["message"];
  readonly message: string;
}

export class Client {
  private TWITTER_ACCESS_TOKEN!: string;
  private TWITTER_ACCESS_TOKEN_SECRET!: string;
  private TWITTER_CONSUMER_KEY!: string;
  private TWITTER_CONSUMER_SECRET!: string;
  private TWITTER_APP_ID!: string;

  public count = 100;

  private static INSTANCE: Client;

  private errorList: ErrorEntry[] = [];

  private constructor() {
    this.validateEnv();
  }

  public static getInstance() {
    if (!Client.INSTANCE) {
      Client.INSTANCE = new Client();
    }
    return Client.INSTANCE;
  }

  private validateEnv() {
    const TWITTER_ACCESS_TOKEN = Deno.env.get("TWITTER_ACCESS_TOKEN");
    const TWITTER_ACCESS_TOKEN_SECRET = Deno.env.get(
      "TWITTER_ACCESS_TOKEN_SECRET",
    );
    const TWITTER_CONSUMER_KEY = Deno.env.get("TWITTER_CONSUMER_KEY");
    const TWITTER_CONSUMER_SECRET = Deno.env.get("TWITTER_CONSUMER_SECRET");
    const TWITTER_APP_ID = Deno.env.get("TWITTER_APP_ID");

    assert(TWITTER_ACCESS_TOKEN);
    assert(TWITTER_ACCESS_TOKEN_SECRET);
    assert(TWITTER_CONSUMER_KEY);
    assert(TWITTER_CONSUMER_SECRET);
    assert(TWITTER_APP_ID);

    this.TWITTER_ACCESS_TOKEN = TWITTER_ACCESS_TOKEN;
    this.TWITTER_ACCESS_TOKEN_SECRET = TWITTER_ACCESS_TOKEN_SECRET;
    this.TWITTER_CONSUMER_KEY = TWITTER_CONSUMER_KEY;
    this.TWITTER_CONSUMER_SECRET = TWITTER_CONSUMER_SECRET;
    this.TWITTER_APP_ID = TWITTER_APP_ID;
  }

  public challengeCRCResponse(
    crcToken: string,
    consumerSecret = this.TWITTER_CONSUMER_SECRET,
  ) {
    return `sha256=${
      hmac("sha256", consumerSecret, crcToken, void 0, "base64").toString()
    }`;
  }

  public async registerWebhook(
    webhookUrl: string,
    env = Deno.env.get("WEBHOOK_ENV") as "dev" | "prod" ?? "dev",
  ): Promise<{}> {
    const webhookCreateResp = await this.request(
      {
        url: `/account_activity/all/${env}/webhooks.json`,
        method: "POST",
        data: { url: webhookUrl },
      },
    );

    try {
      return await webhookCreateResp.json();
    } catch (e) {
      return {
        code: webhookCreateResp.status,
        message: webhookCreateResp.statusText,
      };
    }
  }

  public async getWebhook(
    env = Deno.env.get("WEBHOOK_ENV") as "dev" | "prod" ?? "dev",
  ) {
    const webhookGet = await this.typedRequest<WebhookGet[]>({
      url: `/account_activity/all/${env}/webhooks.json`,
      method: "GET",
    });

    return webhookGet?.[0] ?? null;
  }

  public async rearmWebhook(
    webhookId: number,
    env = Deno.env.get("WEBHOOK_ENV") as "dev" | "prod" ?? "dev",
  ) {
    return this.typedRequest({
      url: `/account_activity/all/${env}/webhooks/${webhookId}.json`,
      method: "PUT",
    }, 204);
  }

  public async deleteWebhook(
    webhookId: number,
    env = Deno.env.get("WEBHOOK_ENV") as "dev" | "prod" ?? "dev",
  ) {
    return this.typedRequest({
      url: `/account_activity/all/${env}/webhooks/${webhookId}.json`,
      method: "DELETE",
    }, 204);
  }

  public async verifyCredentials() {
    const cred: any = await this.typedRequest({
      url: `/account/verify_credentials.json`,
      method: "GET",
    });

    return this.TWITTER_ACCESS_TOKEN.startsWith(
      cred?.id_str,
    );
  }

  public async search(
    termBuilder: (
      searchBuild: SearchBuilder,
    ) => string,
    result_type: "recent" | "mixed" | "popular" = "recent",
    count = this.count,
  ) {
    const search = termBuilder(new SearchBuilder());
    const result = await this.typedRequest<TweetSearchResult>({
      url:
        `/search/tweets.json?qQ=${search}&result_type=${result_type}&count=${count}`,
      method: "GET",
    });

    return result?.statuses ?? [];
  }

  public async getTimeline(userID?: number, count = this.count) {
    const timeline = await this.typedRequest<TweetSearchResult | TweetStatus[]>(
      {
        url:
          `/statuses/user_timeline.json?count=${count}&include_entities=false${
            userID ? `&user_id=${userID}` : ""
          }`,
        method: "GET",
      },
    );

    if ((timeline as TweetSearchResult)?.statuses?.length) {
      return (timeline as TweetSearchResult).statuses;
    }

    return (timeline as TweetStatus[]) ?? [];
  }

  public async retweet(statusID: string) {
    return this.typedRequest({
      url: `/statuses/retweet/${statusID}.json?trim_user=true`,
      method: "POST",
    }, "2xx");
  }

  public async favorite(statusID: string) {
    return this.typedRequest({
      url: `/favorites/create.json?id=${statusID}&include_entities=false`,
      method: "POST",
    }, 200);
  }

  public request(
    reqOpts: OAuth.RequestOptions & { headers?: Record<string, string> },
  ) {
    const oauth = new OAuth({
      consumer: {
        key: this.TWITTER_CONSUMER_KEY,
        secret: this.TWITTER_CONSUMER_SECRET,
      },
      signatureMethod: "HMAC-SHA1",
      hashFn: (message, secret) =>
        hmac("sha1", secret, message, void 0, "base64").toString(),
    });

    if (!reqOpts.url.startsWith(TWITTER_API)) {
      if (reqOpts.url.startsWith("http")) {
        throw new Error(
          `Twitter requests should start with a twitter api url. Found "${reqOpts.url}".`,
        );
      }

      if (reqOpts.url.startsWith("/")) {
        reqOpts.url = TWITTER_API + reqOpts.url;
      } else {
        reqOpts.url = `${TWITTER_API}/${reqOpts.url}`;
      }
    }

    const headers = oauth.toHeader(
      oauth.authorize(
        reqOpts,
        {
          key: this.TWITTER_ACCESS_TOKEN,
          secret: this.TWITTER_ACCESS_TOKEN_SECRET,
        },
      ),
    );

    return fetch(reqOpts.url, {
      method: reqOpts.method,
      headers: {
        ...headers,
        ...reqOpts.headers,
      },
      body: reqOpts.data ? new URLSearchParams(reqOpts.data) : null,
    });
  }

  public async typedRequest<T>(
    reqOpts: OAuth.RequestOptions & { headers?: Record<string, string> },
  ): Promise<T | null>;
  public async typedRequest(
    reqOpts: OAuth.RequestOptions & { headers?: Record<string, string> },
    expectedStatus: number | "2xx",
  ): Promise<boolean>;
  public async typedRequest(
    reqOpts: OAuth.RequestOptions & { headers?: Record<string, string> },
    expectedStatus?: number | "2xx",
  ): Promise<any> {
    const resp = await this.request(reqOpts);

    // if status checking, return boolean
    if (expectedStatus) {
      if (expectedStatus === "2xx" && `${resp.status}`.startsWith("2")) {
        return true;
      }

      if (resp.status === expectedStatus) {
        return true;
      }

      this.logError(
        resp,
        new Error(`Twitter request failed: "${await resp.text()}"`),
      );
      return false;
    }

    // else, try to return json response
    try {
      const ret = await resp.json();
      if (ret.errors?.length) {
        throw new Error(
          `Twitter errors: \n${
            ret.errors.map((e: any) => `- (${e.code}) ${e.message}`).join("\n")
          }`,
        );
      } else if (!`${resp.status}`.startsWith("2")) {
        throw new Error("Unknown Twitter error.");
      }

      return ret;
    } catch (e) {
      this.logError(resp, e);
      return null;
    }
  }

  private logError(response: Response, e: Error) {
    const entry: ErrorEntry = {
      code: response.status,
      error: e.name,
      errorMessage: e.message,
      message: response.statusText,
    };
    this.errorList.push(entry);
  }

  public getErrorList() {
    return [...this.errorList] as const;
  }
}
