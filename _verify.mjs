import AdmZip from "adm-zip";
const p = "C:\\Users\\32890\\Desktop\\咕咕嘎嘎的好朋友.docx";
try {
  const z = new AdmZip(p);
  for (const e of z.getEntries()) console.log(e.entryName, "-", e.getData().length, "bytes");
} catch(e) {
  console.log("adm-zip error (expected):", e.message);
}
