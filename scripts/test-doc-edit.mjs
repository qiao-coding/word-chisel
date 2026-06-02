// Test: apply "字典元素的排序输出" edits to .doc file via word-chisel
import { getDocument, invalidateCache } from "../dist/docx/DocumentStore.js";
import { replaceInParagraph } from "../dist/docx/TextReplacer.js";
import { saveDocx } from "../dist/docx/DocxWriter.js";
import { childrenOf, isElement, tagName, findChild } from "../dist/docx/XmlUtils.js";

const PATH = process.argv[2] || "./test.doc";
const OUTPUT_NAME = process.argv[3] || "edited-output";

// Read .doc → auto-converts to .docx via LibreOffice
console.log("Opening .doc file (converting to .docx)...");
const { doc, flatDoc, outputPath } = getDocument(PATH, OUTPUT_NAME);
console.log("Output:", outputPath);

// Helper: set text on empty paragraph in XML tree
function setParaText(idx, text) {
  let body = null;
  for (const node of doc.tree) {
    if (typeof node === "string") continue;
    if (isElement(node) && tagName(node) === "w:document") {
      body = findChild(node, "w:body");
      break;
    }
  }
  let pCount = 0;
  for (const child of childrenOf(body)) {
    if (!isElement(child)) continue;
    if (tagName(child) === "w:p") {
      if (pCount === idx) {
        childrenOf(child).push({ "w:r": [{ "w:t": [{ "#text": text }] }] });
        return true;
      }
      pCount++;
    }
  }
  return false;
}

function replace(idx, search, replacement) {
  const para = flatDoc.paragraphs.find((p) => p.index === idx);
  if (!para || !search) return;
  const r = replaceInParagraph(para, search, replacement, false, "firstRunFormatting");
  console.log(`  [${idx}] ${r.matchCount} match(es)`);
}

// 1. Project name
console.log("\n--- Header ---");
replace(26, flatDoc.paragraphs.find(p => p.index === 26).fullText,
  "项目名称：字典元素的排序输出                指导教师：张老师");

// 2. Type checkboxes
replace(23, flatDoc.paragraphs.find(p => p.index === 23).fullText,
  "类型： ☑ 验证性 □ 演示性 □ 综合性 □ 设计研究性 □ 其他：       ");

// 3. Background
console.log("\n--- Sections ---");
replace(29, flatDoc.paragraphs.find(p => p.index === 29).fullText,
  "在数据处理与信息检索场景中，字典是存储键值对数据的核心结构。新闻文本分类统计后，往往需要按照标签名称或文本数量进行多维度排序展示，以便快速掌握数据分布特征。本项目以新闻标签统计为例，通过Python字典排序操作，实现对结构化数据的灵活整理与可视化输出，是字典高级应用的典型实践。");

// 4. Task
replace(31, flatDoc.paragraphs.find(p => p.index === 31).fullText,
  "本项目旨在通过Python编程，完成新闻标签字典的多维度排序输出。具体任务包括：构建包含标签与文本数量的字典；分别按标签名字母顺序、文本数量升序、文本数量降序三种规则对字典元素排序；将排序结果以\"标签: XX, 新闻文本数量: XX\"的格式规范输出至控制台。");

// 5. Analysis
replace(33, flatDoc.paragraphs.find(p => p.index === 33).fullText,
  "数据结构设计：使用字典存储新闻标签与对应文本数量，键为标签字符串，值为整数型数量，贴合实际数据统计场景。");
replace(34, flatDoc.paragraphs.find(p => p.index === 34).fullText,
  "排序逻辑实现：借助sorted()函数配合key参数，分别指定按键排序、按值升序、按值降序的排序规则；利用lambda表达式提取字典项中的键或值作为排序依据。");
replace(35, flatDoc.paragraphs.find(p => p.index === 35).fullText,
  "格式化输出：遍历排序后的字典项列表，使用f-string格式化字符串，统一输出样式，确保结果清晰可读，满足题目要求的展示格式。");

// 6. Code
console.log("\n--- Code ---");
replace(37, flatDoc.paragraphs.find(p => p.index === 37).fullText, "新闻标签统计字典");
replace(38, flatDoc.paragraphs.find(p => p.index === 38).fullText, 'news_tags = {');
replace(39, flatDoc.paragraphs.find(p => p.index === 39).fullText, '    "体育": 80,');
replace(40, flatDoc.paragraphs.find(p => p.index === 40).fullText, '    "娱乐": 90,');
replace(41, flatDoc.paragraphs.find(p => p.index === 41).fullText, '    "时政": 50,');
replace(42, flatDoc.paragraphs.find(p => p.index === 42).fullText, '    "科技": 60,');
replace(44, flatDoc.paragraphs.find(p => p.index === 44).fullText, '    "财经": 70');
replace(45, flatDoc.paragraphs.find(p => p.index === 45).fullText, '}');
replace(46, flatDoc.paragraphs.find(p => p.index === 46).fullText, 'print("按标签名排序输出：")');
replace(47, flatDoc.paragraphs.find(p => p.index === 47).fullText, 'for tag, count in sorted(news_tags.items(), key=lambda x: x[0]):');
replace(48, flatDoc.paragraphs.find(p => p.index === 48).fullText, '    print(f"标签: {tag}, 新闻文本数量: {count}")');
replace(49, flatDoc.paragraphs.find(p => p.index === 49).fullText, 'print()');

// Fill empty paras for remaining code
setParaText(50, 'print("按新闻文本数量升序输出：")');
setParaText(52, 'for tag, count in sorted(news_tags.items(), key=lambda x: x[1]):');
setParaText(53, '    print(f"标签: {tag}, 新闻文本数量: {count}")');

// 7. Optimization
console.log("\n--- Optimization ---");
replace(55, flatDoc.paragraphs.find(p => p.index === 55).fullText,
  "为提升程序的通用性与健壮性，可从以下方面优化：");
replace(56, flatDoc.paragraphs.find(p => p.index === 56).fullText,
  "首先，封装排序输出为独立函数，支持传入任意字典与排序规则，避免重复代码；其次，增加输入校验，处理非字符串键、非数值值等异常数据，防止排序报错；再次，支持自定义输出格式模板，适配不同场景的展示需求；最后，扩展文件读写功能，支持从CSV/JSON文件加载数据、将排序结果导出保存，实现数据处理的完整闭环。");
// Clear old remaining opt text
for (const idx of [57, 58, 59, 60]) {
  const para = flatDoc.paragraphs.find(p => p.index === idx);
  if (para && para.fullText.trim()) {
    replaceInParagraph(para, para.fullText, "", false, "firstRunFormatting");
  }
}

// 8. Summary
console.log("\n--- Summary ---");
replace(63, flatDoc.paragraphs.find(p => p.index === 63).fullText,
  "本次实验围绕字典元素排序输出展开，成功实现了新闻标签字典按标签名、文本数量升序及降序三种维度的排序与格式化输出。通过sorted()函数与lambda表达式的组合运用，掌握了字典多维度排序的核心方法；借助f-string完成了规范的结果展示，验证了Python在结构化数据处理中的简洁高效。实验全程紧扣教材项目要求，从数据结构搭建到排序逻辑落地，完整走通了字典排序应用的开发流程，也梳理出函数封装、异常处理、文件交互等优化方向，为后续复杂数据处理项目奠定了基础。");
replace(65, flatDoc.paragraphs.find(p => p.index === 65).fullText,
  "字典排序是数据处理的基础能力：sorted()配合key参数可灵活适配各类排序需求，理解键值对的提取逻辑是掌握字典高级操作的关键，也是后续学习数据分析、算法排序的前置基础。");
replace(66, flatDoc.paragraphs.find(p => p.index === 66).fullText,
  "代码复用与封装提升开发效率：将排序、输出逻辑封装为函数，能减少重复代码、增强程序可维护性，这启示我们在编程中要养成模块化思维，避免面向过程式的冗余编码。");
replace(67, flatDoc.paragraphs.find(p => p.index === 67).fullText,
  "格式化输出关乎数据呈现效果：统一的输出格式能让数据更直观易读，f-string等格式化工具是提升程序用户体验的重要手段，数据处理不仅要保证逻辑正确，也要注重结果的可视化表达。");
replace(68, flatDoc.paragraphs.find(p => p.index === 68).fullText,
  "小项目蕴含通用编程思维：新闻标签排序虽是简单案例，但涵盖了数据结构选择、排序算法应用、结果展示等核心环节，这类贴近实际的小项目能有效锻炼我们将理论知识转化为解决实际问题能力，也为后续处理更复杂的业务数据积累了经验。");

// Save
console.log("\nSaving...");
saveDocx(doc, doc.tree);
invalidateCache(PATH);
console.log("Saved to:", outputPath);
