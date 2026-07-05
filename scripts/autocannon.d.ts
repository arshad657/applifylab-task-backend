declare module "autocannon" {
  interface Options {
    url: string;
    connections?: number;
    duration?: number;
    title?: string;
  }

  interface Result {
    requests: { average: number };
    latency: { p50: number; p99: number; max: number };
    throughput: { average: number };
    errors: number;
    timeouts: number;
  }

  function autocannon(opts: Options, cb: (err: Error | null, result: Result) => void): void;

  namespace autocannon {
    export { Options, Result };
  }

  export = autocannon;
}
