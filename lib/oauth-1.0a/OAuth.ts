export namespace OAuth {
  /**
     * OAuth data, including the signature.
     */
  export interface Authorization extends Data {
    oauth_signature: string;
  }

  /**
     * Method used to generate the body hash.
     *
     * Note: the key is used for implementation HMAC algorithms for the body hash,
     * but typically it should return SHA1 hash of base_string.
     */
  export type BodyHashFunction = (base_string: string, key: string) => string;

  /**
     * OAuth key/secret pair.
     */
  export interface Consumer {
    key: string;
    secret: string;
  }

  /**
     * OAuth data, excluding the signature.
     */
  export interface Data {
    oauth_consumer_key: string;
    oauth_nonce: string;
    oauth_signature_method: string;
    oauth_timestamp: string;
    oauth_version: string;
    oauth_token?: string;
    oauth_body_hash?: string;
  }

  /**
     * Method used to hash the the OAuth and form/querystring data.
     */
  export type HashFunction = (baseString: string, key: string) => string;

  /**
     * Authorization header.
     */
  export interface Header {
    Authorization: string;
  }

  /**
     * OAuth options.
     */
  export interface Options {
    bodyHashFn?: BodyHashFunction;
    consumer: Consumer;
    hashFn?: HashFunction;
    lastAmpersand?: boolean;
    nonceLength?: number;
    parameterSeparator?: string;
    realm?: string;
    signatureMethod?: string;
    version?: string;
  }

  /**
     * Extra data.
     */
  export interface Param {
    [key: string]: string | string[];
  }

  /**
     * Request options.
     */
  export interface RequestOptions {
    url: string;
    method: "GET" | "POST" | "DELETE" | "PUT";
    data?: any;
    includeBodyHash?: boolean;
  }

  /**
     * OAuth token key/secret pair.
     */
  export interface Token {
    key: string;
    secret: string;
  }
}

export class OAuth implements OAuth.Options {
  public bodyHashFn: OAuth.BodyHashFunction;
  public consumer: OAuth.Consumer;
  public hashFn: OAuth.HashFunction;
  public lastAmpersand: boolean;
  public nonceLength: number;
  public parameterSeparator: string;
  public realm: string;
  public signatureMethod: string;
  public version: string;

  constructor({
    consumer,
    hashFn,
    bodyHashFn,
    nonceLength = 32,
    version = "1.0",
    parameterSeparator = ",",
    realm = "",
    lastAmpersand = false,
    signatureMethod = "PLAINTEXT",
  }: OAuth.Options) {
    this.consumer = consumer;
    this.nonceLength = nonceLength;
    this.version = version;
    this.parameterSeparator = parameterSeparator;
    this.realm = realm;
    this.lastAmpersand = lastAmpersand;
    this.signatureMethod = signatureMethod;

    if (this.signatureMethod === "PLAINTEXT" && !hashFn) {
      hashFn = (_, key) => key;
    }

    if (!hashFn) {
      throw new Error(
        "OAuth1.0a: Hash function is required when signature method is not PLAINTEXT",
      );
    }

    this.hashFn = hashFn;
    this.bodyHashFn = bodyHashFn ?? this.hashFn;
  }

  /**
     * OAuth request authorize
     * @param  request data
     * @param  token and secret token
     *
     * @returns OAuth Authorized data
     */
  public authorize(
    request: OAuth.RequestOptions,
    token?: OAuth.Token,
  ): OAuth.Authorization {
    if (!request.data) {
      request.data = {};
    }

    const oauth_data: OAuth.Data = {
      oauth_consumer_key: this.consumer.key,
      oauth_nonce: this.getNonce(),
      oauth_signature_method: this.signatureMethod,
      oauth_timestamp: this.getTimeStamp(),
      oauth_version: this.version,
      oauth_token: token?.key,
    };

    if (request.includeBodyHash) {
      oauth_data.oauth_body_hash = this.getBodyHash(request, token?.secret);
    }

    return {
      ...oauth_data,
      oauth_signature: this.getSignature(request, token?.secret, oauth_data),
    };
  }

  /**
     * Get OAuth data as Header
     * @param  oauthData
     * @returns Header data key - value
     */
  public toHeader(oauthData: OAuth.Authorization): OAuth.Header {
    const sorted = this.sortObject(oauthData);

    let header_value = "OAuth ";
    if (this.realm) {
      header_value += 'realm="' + this.realm + '"' + this.parameterSeparator;
    }

    for (let i = 0; i < sorted.length; i++) {
      if (!sorted[i].key.startsWith("oauth_")) {
        continue;
      }

      header_value += `${OAuth.percentEncode(sorted[i].key)}="${
        OAuth.percentEncode(`${sorted[i].value}`)
      }"${this.parameterSeparator}`;
    }

    return {
      Authorization: header_value.substr(
        0,
        header_value.length - this.parameterSeparator.length,
      ), //cut the last chars
    };
  }

  /**
     * Create a Signing Key
     * @param  tokenSecret Secret Token
     *
     * @returns Signing Key
     */
  private getSigningKey(tokenSecret = "") {
    if (!this.lastAmpersand && !tokenSecret) {
      return OAuth.percentEncode(this.consumer.secret);
    }

    return `${OAuth.percentEncode(this.consumer.secret)}&${
      OAuth.percentEncode(tokenSecret)
    }`;
  }

  /**
     * Create a OAuth Signature
     * @param  request data
     * @param  tokenSecret key and secret token
     * @param  oauthData   OAuth data
     *
     * @returns Signature
     */
  private getSignature(
    request: OAuth.RequestOptions,
    tokenSecret: string | undefined,
    oauthData: OAuth.Data,
  ) {
    return this.hashFn(
      this.getBaseString(request, oauthData),
      this.getSigningKey(tokenSecret),
    );
  }

  /**
     * Create a OAuth Body Hash
     * @param request data
     */
  private getBodyHash(
    request: OAuth.RequestOptions,
    tokenSecret?: string,
  ): string {
    const body = typeof request.data === "string"
      ? request.data
      : JSON.stringify(request.data);

    if (!this.bodyHashFn) {
      throw new Error("OAuth1.0a: body_hash_function option is required");
    }

    return this.bodyHashFn(body, this.getSigningKey(tokenSecret));
  }

  /**
     * Base String = Method + Base Url + ParameterString
     */
  private getBaseString(
    request: OAuth.RequestOptions,
    oauthData: OAuth.Data,
  ): string {
    return request.method.toUpperCase() + "&" +
      OAuth.percentEncode(this.getBaseUrl(request.url)) + "&" +
      OAuth.percentEncode(this.getParameterString(request, oauthData));
  }

  /**
     * Get data from url
     * -> merge with oauth data
     * -> percent encode key & value
     * -> sort
     */
  private getParameterString(
    request: OAuth.RequestOptions,
    oauthData: OAuth.Data,
  ): string {
    const params: OAuth.Param = oauthData.oauth_body_hash
      ? this.deParamUrl(request.url)
      : { ...request.data, ...this.deParamUrl(request.url) };
    const explodedData = this.sortObject(
      OAuth.percentEncodeData({ ...oauthData, ...params }) as
        & OAuth.Data
        & OAuth.Param,
    );

    let data_str = "";
    //base_string_data to string
    for (let i = 0; i < explodedData.length; i++) {
      let key = explodedData[i].key;
      let value = explodedData[i].value;
      // check if the value is an array
      // this means that this key has multiple values
      if (value && Array.isArray(value)) {
        // sort the array first
        value.sort();

        let valString = "";
        // serialize all values for this key: e.g. formkey=formvalue1&formkey=formvalue2
        value.forEach(((item: any) => {
          valString += key + "=" + item;
          if (i < value.length) {
            valString += "&";
          }
        }).bind(this));
        data_str += valString;
      } else {
        data_str += key + "=" + value + "&";
      }
    }
    //remove the last character
    data_str = data_str.substr(0, data_str.length - 1);

    return data_str;
  }

  /**
     * Get base url
     */
  private getBaseUrl(url: string) {
    return url.split("?")[0];
  }

  /**
     * Get data from String
     */
  private deParam(queryParam: string): OAuth.Param {
    let data: OAuth.Param = {};

    const params = new URLSearchParams(queryParam);
    for (const key of params.keys()) {
      if (!data[key]) {
        const values = params.getAll(key);
        data[key] = values.length > 1 ? values : values[0];
      }
    }

    return data;
  }

  /**
     * Get data from url
     */
  private deParamUrl(url: string) {
    const tmp = url.split("?");
    if (tmp.length === 1) {
      return {};
    }

    return this.deParam(tmp[1]);
  }

  /**
     * Percent Encode
     */
  public static percentEncode(str: string) {
    return encodeURIComponent(str)
      .replace(/\!/g, "%21")
      .replace(/\*/g, "%2A")
      .replace(/\'/g, "%27")
      .replace(/\(/g, "%28")
      .replace(/\)/g, "%29");
  }

  /**
     * Percent Encode Object
     * @param  data
     * @returns percent encoded data
     */
  public static percentEncodeData<
    T extends Record<string, string | string[] | undefined>,
  >(data: T): {} {
    let result: any = {};

    for (let key in data) {
      let value: string | string[] | undefined = data[key];
      // check if the value is an array
      if (value && Array.isArray(value)) {
        let newValue: string[] = [];
        // percentEncode every value
        value.forEach(((item: string) => {
          newValue.push(OAuth.percentEncode(item));
        }).bind(this));
        value = newValue;
      } else {
        value = OAuth.percentEncode(value ?? "");
      }
      const newKey = OAuth.percentEncode(key);
      result[newKey] = value;
    }

    return result;
  }

  /**
     * Create a random word characters string with input length
     *
     * @returns a random word characters string
     */
  private getNonce() {
    const word_characters =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < this.nonceLength; i++) {
      result +=
        word_characters[Math.floor(Math.random() * word_characters.length)];
    }

    return result;
  }

  /**
     * Get Current Unix TimeStamp
     * @returns current unix timestamp
     */
  private getTimeStamp() {
    return `${Math.floor(Date.now() / 1000)}`;
  }

  ////////////////////// HELPER FUNCTIONS //////////////////////

  /**
     * Sort object by key
     */
  private sortObject<K extends string, V>(obj: Partial<Record<K, V>>) {
    const keys = Object.keys(obj) as K[];
    const result: Array<{ key: K; value: V }> = [];

    keys.sort();
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      result.push({
        key,
        value: obj[key]!,
      });
    }

    return result;
  }
}
