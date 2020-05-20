import { OAuth } from "../oauth-1.0a/OAuth.ts";

export interface Criterion {
  exclude: boolean;
  type: "lang" | "from" | "to" | "filter" | "plain";
  text: string;
}

interface CriterionWithID extends Criterion {
  id: number;
}

type Filter =
  | "safe"
  | "media"
  | "retweets"
  | "native_video"
  | "periscope"
  | "vine"
  | "images"
  | "twimg"
  | "links"
  | "replies";

/**
 * Chained builder for Standard Search param.
 *
 * Output can be either OAuth compatible encoded (toString), or raw (toRawString).
 *
 *
 * Example:
 * ```ts
 * const sb = new SearchBuilder();
 * sb.inc.subject("#denoland", "@deno_land")
 *  .inc.lang("fr", "en")
 *  .exc.filter("replies")
 *  .exc.subject("RT");
 * // output: (-filter:replies) (lang:fr OR lang:en) (#denoland OR @deno_land) (-RT)
 * console.log(sb.toRawString())
 * ```
 *
 * @see https://developer.twitter.com/en/docs/tweets/search/guides/standard-operators
 */
export class SearchBuilder {
  private criteria: CriterionWithID[] = [];
  private nextAction: "inc" | "exc" | null = null;
  private question = false;
  private positive = false;
  private negative = false;
  private incrementalID = 0;

  private partialBuilder() {
    const that = this;
    return {
      /**
       * Manually add criteria
       */
      criterion(...c: Criterion[]) {
        return that.criterion(...c);
      },

      /**
       * Compose a subject ; a word, hashtag, or user contained in a status.
       */
      subject(...s: string[]) {
        return that.subject(...s);
      },

      /**
       * Compose a lang. Have to have 2 chars. E.g "fr", "en", "de", ...
       */
      lang(...l: string[]) {
        return that.lang(...l);
      },

      /**
       * Compose a user that made the status. "@" at the begining will be stripped.
       */
      from(...f: string[]) {
        return that.from(...f);
      },

      /**
       * Compose a user that the status if made for. "@" at the begining will be stripped.
       */
      to(...t: string[]) {
        return that.to(...t);
      },

      /**
       * Compose defined filter.
       */
      filter(...f: Filter[]) {
        return that.filter(...f);
      },
    };
  }

  /**
   * Return ready-to-use, percent-encoded, string format of the search.
   */
  public toString() {
    return OAuth.percentEncode(this.toRawString());
  }

  /**
   * Return raw string format of the search. Cannot be used straight as is with OAuth-1.0a
   *
   * If you need encoded version, either encode it yourself, either use `getString()`.
   */
  public toRawString() {
    const sortedCriteria = this.criteria.sort((a, b) =>
      a.type === b.type ? 0 : a.type > b.type ? 1 : -1
    );

    let ret = sortedCriteria.reduce((str, criterion, idx) => {
      const prev = sortedCriteria[idx - 1];
      const prevType = prev?.type;
      const prevId = prev?.id;
      if (prev) {
        if (prevType !== criterion.type || prevId !== criterion.id) {
          str += ") ";
        } else {
          str += " OR ";
        }
      }

      if (!prevType || prevType !== criterion.type || prevId !== criterion.id) {
        str += "(";
      }

      if (criterion.exclude) {
        str += "-";
      }

      if (criterion.type !== "plain") {
        str += `${criterion.type}:`;
      }

      str += criterion.text;

      if (!sortedCriteria[idx + 1]) {
        str += ")";
      }

      return str;
    }, "").trim();

    if (this.positive) {
      ret += " :)";
    } else if (this.negative) {
      ret += " :(";
    }

    if (this.question) {
      ret += " ?";
    }

    return ret;
  }

  /**
   * Will include next given criteria
   */
  public get inc() {
    this.nextAction = "inc";
    return this.partialBuilder();
  }

  /**
   * Will exclude next given criteria
   */
  public get exc() {
    this.nextAction = "exc";
    return this.partialBuilder();
  }

  /**
   * Search with positive attitude
   */
  public [":)"](positive = true) {
    this.positive = positive;
    this.negative = positive ? false : this.negative;
    return this;
  }

  /**
   * Search with negative attitude
   */
  public [":("](negative = true) {
    this.negative = negative;
    this.positive = negative ? false : this.positive;
    return this;
  }

  /**
   * Search only for questions
   */
  public ["?"](question = true) {
    this.question = question;
    return this;
  }

  private criterion(...c: Criterion[]) {
    if (this.nextAction === null) {
      throw new Error("SearchBuilder: Can't invoke criterion alone.");
    }

    this.criteria.push(...c.map((crit): CriterionWithID => ({
      ...crit,
      id: this.incrementalID++,
    })));
    return this;
  }

  private lang(...l: string[]) {
    if (this.nextAction === null) {
      throw new Error("SearchBuilder: Can't invoke lang alone.");
    }

    if (l.length !== 2) {
      throw new Error(
        `SearchBuilder: Lang search criterion should have 2 chars. Found "${l}".`,
      );
    }

    const id = this.incrementalID++;
    this.criteria.push(...l.map((text): CriterionWithID => ({
      id,
      text,
      exclude: this.nextAction === "exc",
      type: "lang",
    })));

    return this;
  }

  private from(...f: string[]) {
    if (this.nextAction === null) {
      throw new Error("SearchBuilder: Can't invoke lang alone.");
    }

    const id = this.incrementalID++;
    this.criteria.push(...f.map((text): CriterionWithID => ({
      id,
      text: text.replace(/^@*/, ""),
      exclude: this.nextAction === "exc",
      type: "from",
    })));

    return this;
  }

  private to(...t: string[]) {
    if (this.nextAction === null) {
      throw new Error("SearchBuilder: Can't invoke lang alone.");
    }

    const id = this.incrementalID++;
    this.criteria.push(...t.map((text): CriterionWithID => ({
      id,
      text: text.replace(/^@*/, ""),
      exclude: this.nextAction === "exc",
      type: "to",
    })));

    return this;
  }

  private filter(...f: Filter[]) {
    if (this.nextAction === null) {
      throw new Error("SearchBuilder: Can't invoke lang alone.");
    }

    const id = this.incrementalID++;
    this.criteria.push(...f.map((text): CriterionWithID => ({
      id,
      text: text.replace(/^@*/, ""),
      exclude: this.nextAction === "exc",
      type: "filter",
    })));

    return this;
  }

  private subject(...s: string[]) {
    if (this.nextAction === null) {
      throw new Error("SearchBuilder: Can't invoke subject alone.");
    }

    const id = this.incrementalID++;
    this.criteria.push(...s.map((text): CriterionWithID => ({
      id,
      text,
      exclude: this.nextAction === "exc",
      type: "plain",
    })));

    return this;
  }
}
