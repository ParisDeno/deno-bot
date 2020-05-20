export type NowHeader = "x-vercel-deployment-url" | "x-now-deployment-url";
export type CustomHeader = "x-deno-bot-secret";

export interface RequestBody {
  method: string;
  headers: Record<string, string> & Record<NowHeader | CustomHeader, string>;
  path: string;
  host: string;
  body: unknown;
  encoding: string;
}
