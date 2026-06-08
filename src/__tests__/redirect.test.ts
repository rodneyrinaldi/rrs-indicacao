import { GET } from "@/app/r/[slug]/[hash]/[appId]/route";
import { query } from "@/lib/db";

jest.mock("@/lib/db", () => ({
  query: jest.fn(),
}));

const queryMock = query as jest.MockedFunction<typeof query>;

describe("redirect route", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-06-04T12:00:00Z"));
    queryMock.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("bloqueia no dia 4+ quando escritorio nao esta na lista positiva", async () => {
    queryMock.mockResolvedValueOnce([
      {
        lead_id: "lead-1",
        escritorio_id: "esc-1",
        liberado_lista_positiva: false,
        url_destino: "https://exemplo.com/lp",
      },
    ] as never);

    const request = new Request("https://indicacao.rrs.net.br/r/rrs/hash123/app123", {
      method: "GET",
      headers: {
        "x-vercel-ip-country": "BR",
        "x-vercel-ip-country-region": "SP",
        "x-vercel-ip-city": "Sao Paulo",
        "user-agent": "Jest",
      },
    });

    const response = await GET(request as never, {
      params: Promise.resolve({
        slug: "rrs",
        hash: "hash123",
        appId: "app123",
      }),
    });

    expect(response.status).toBe(423);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});
