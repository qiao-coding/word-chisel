import { describe, it, expect } from "vitest";
import { parseXml, buildXml } from "../src/docx/XmlTree.js";

describe("parseXml", () => {
  it("parses a simple OOXML document", () => {
    const xml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Hello</w:t></w:r></w:p>
  </w:body>
</w:document>`;
    const tree = parseXml(xml);
    expect(tree).toHaveLength(1);
    expect(typeof tree[0]).toBe("object");
  });

  it("handles XML with declaration", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<w:document><w:body><w:p/></w:body></w:document>`;
    const tree = parseXml(xml);
    expect(tree).toHaveLength(1);
  });
});

describe("buildXml", () => {
  it("round-trips XML preserving declaration", () => {
    const decl = '<?xml version="1.0" encoding="UTF-8"?>';
    const xml = `${decl}<root><child>text</child></root>`;
    const tree = parseXml(xml);
    const out = buildXml(tree, decl);
    expect(out).toContain('<?xml version="1.0"');
    expect(out).toContain("<root>");
    expect(out).toContain("text");
  });
});
