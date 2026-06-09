import { getAppBaseUrl } from "@/lib/app-url";

describe("getAppBaseUrl", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.APP_URL;
    delete process.env.VERCEL_URL;
    delete process.env.NODE_ENV;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("ignora localhost configurado em producao e usa VERCEL_URL", () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.VERCEL_URL = "meu-app.vercel.app";

    expect(getAppBaseUrl()).toBe("https://meu-app.vercel.app");
  });

  it("ignora localhost configurado em producao e usa fallback de producao", () => {
    process.env.NODE_ENV = "production";
    process.env.APP_URL = "http://127.0.0.1:3000";

    expect(getAppBaseUrl()).toBe("https://indicacao.rrs.net.br");
  });

  it("mantem URL configurada valida em producao", () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.exemplo.com/";

    expect(getAppBaseUrl()).toBe("https://app.exemplo.com");
  });

  it("permite localhost em desenvolvimento", () => {
    process.env.NODE_ENV = "development";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

    expect(getAppBaseUrl()).toBe("http://localhost:3000");
  });
});
