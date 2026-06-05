import { formatPhone, normalizePhone, sanitizeWhatsapp } from "@/lib/phone";

describe("phone helpers", () => {
  it("remove toda a formatacao para armazenamento e comparacao", () => {
    expect(normalizePhone("(11) 91222-7040")).toBe("11912227040");
    expect(sanitizeWhatsapp("(11) 91222-7040")).toBe("11912227040");
  });

  it("aplica mascara brasileira ao exibir o numero", () => {
    expect(formatPhone("11912227040")).toBe("(11)91222-7040");
    expect(formatPhone("(11) 91222-7040")).toBe("(11)91222-7040");
  });
});