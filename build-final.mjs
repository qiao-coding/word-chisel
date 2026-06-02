import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { getDocument, updateCachedTree } from "./dist/docx/DocumentStore.js";
import { replaceInParagraph } from "./dist/docx/TextReplacer.js";
import { saveDocx } from "./dist/docx/DocxWriter.js";
import { parseXml, buildXml } from "./dist/docx/XmlTree.js";

// ============================================================
// CONFIG
// ============================================================
const docPath = "C:\\Users\\32890\\Desktop\\《咕咕嘎嘎》的好朋友.doc";
const outputName = "咕咕嘎嘎的好朋友";
const guDir = "C:\\Users\\32890\\Desktop\\gu";

// Images to add: [file, after-paragraph-index, isHero]
const images = [
  { file: "a341557dc280932517d3258d1200f9bb.png", afterPara: 2, hero: true },
  { file: "咕咕嘎嘎.png", afterPara: 5, hero: false },
  { file: "非比就比.jpg", afterPara: 14, hero: false },
  { file: "doro.jpg", afterPara: 16, hero: false },
  { file: "糯糯.jpg", afterPara: 20, hero: false },
];

// ============================================================
// XML HELPERS (preserve-order format)
// ============================================================
const tagName = (e) => Object.keys(e).find(k => k !== ":@") || "";
const childrenOf = (e) => { const v = e[tagName(e)]; return Array.isArray(v) ? v : []; };
const findChild = (e, t) => childrenOf(e).find(c => typeof c === "object" && tagName(c) === t);
const findAll = (e, t) => childrenOf(e).filter(c => typeof c === "object" && tagName(c) === t);
const attrsOf = (e) => { const r = e[":@"]; return (r && typeof r === "object" && !Array.isArray(r)) ? r : {}; };

// ============================================================
// IMAGE DIMENSIONS
// ============================================================
function getPngDims(buf) { return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }; }
function getJpegDims(buf) {
  let off = 2;
  while (off < buf.length - 9) {
    if (buf[off] !== 0xFF) break;
    if (buf[off + 1] === 0xC0 || buf[off + 1] === 0xC2) return { h: buf.readUInt16BE(off + 5), w: buf.readUInt16BE(off + 7) };
    off += 2 + buf.readUInt16BE(off + 2);
  }
  return { w: 400, h: 400 };
}

function getImageInfo(filePath) {
  const buf = readFileSync(filePath);
  const ext = filePath.split(".").pop().toLowerCase();
  const dims = ext === "png" ? getPngDims(buf) : getJpegDims(buf);
  return { buf, ext, w: dims.w, h: dims.h };
}

// ============================================================
// DRAWING XML
// ============================================================
function drawingXml(rId, name, wEmu, hEmu) {
  return `<wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="${wEmu}" cy="${hEmu}"/><wp:docPr id="1" name="${name}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${wEmu}" cy="${hEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline>`;
}

function makeImageParagraph(rId, name, wEmu, hEmu, isHero) {
  const drawStr = drawingXml(rId, name, wEmu, hEmu);
  const parsedDrawing = parseXml(drawStr);
  const para = {
    "w:p": [
      { "w:pPr": [{ "w:jc": [], ":@": { "@_w:val": "center" } }] },
      { "w:r": [{ "w:drawing": parsedDrawing }] }
    ]
  };
  // Hero image gets extra spacing
  if (isHero) {
    const pPr = findChild(para, "w:p") ? childrenOf(para.children ? para.children[0] : para)[0] : null;
    // Add spacing via w:pPr
  }
  return para;
}

// ============================================================
// STEP 1: Get document from original .doc
// ============================================================
console.log("Step 1: Converting .doc and loading...");
const { doc, flatDoc, outputPath, note } = getDocument(docPath, outputName);
console.log("  Output:", outputPath);
if (note) console.log("  Note:", note);

// ============================================================
// STEP 2: All text replacements
// ============================================================
console.log("Step 2: Replacing text...");
let ok = 0, miss = 0;

function replace(idx, search, replace) {
  const para = flatDoc.paragraphs.find(p => p.index === idx);
  if (!para) { console.log(`  [${idx}] PARA MISSING`); miss++; return; }
  const r = replaceInParagraph(para, search, replace, true, "firstRunFormatting");
  if (r.matchCount > 0) { ok++; } else { console.log(`  [${idx}] MISS: "${search.substring(0,50)}..."`); miss++; }
}

// Title area
replace(2, "《咕咕嘎嘎》的好朋友", "《咕咕嘎嘎》的好朋友"); // keep title
replace(4, "姓    名：      咕咕嘎嘎", "名字：咕咕嘎嘎");
replace(5, "好 朋 友：      非比揪比", "好朋友们：非比就比、doro、糯糯");
replace(7, "实验（实训）报告", "咕咕嘎嘎和朋友们的故事");
replace(10, "课程名称：Python程序设计                   课程性质：专业基础课", "主角：咕咕嘎嘎                            性格：活泼开朗、热情善良");
replace(11, "项目名称：个人名片设计---美好愿景                指导教师：韦兰飞", "好朋友：非比就比、doro、糯糯                相遇地点：咕咕星球");
replace(12, "班级：计算机应用工程3班学号：2410180320  学生姓名：萧明昊", "生日：2024年6月1日    星座：双子座          最喜欢：和朋友们一起冒险");

// Section I - 非比就比
replace(13, "一、实验项目背景", "一、非比就比：勇敢的小兔子");
replace(14, "在当今社会，个人名片是展示个人形象、传递联系方式的重要工具。一个设计精美、信息清晰的个人名片，不仅能够给个人留下深刻的印象，还能够有效地提升个人品牌价值。", "非比就比是咕咕嘎嘎最好的朋友之一，是一只充满好奇心的小兔子，总是带着灿烂的笑容，喜欢探索未知的世界。它最大的特点是勇敢和机智——每当朋友们遇到困难，它总是第一个站出来想办法。它说：\"世界上没有过不去的坎，因为我们有彼此！\"");

// Section II - doro
replace(15, "二、实验项目任务", "二、doro：温柔的小猫咪");
replace(16, "本项目实训在通过Python编程，设计一个交互式的个人名片生成程序，用户可以根据提示输入个人信息，选择自己喜欢的样式，程序将自动生成美观的个人名片。", "doro是一只温柔可爱的小猫咪，有着柔软的毛发和一双会说话的大眼睛。它性格温和但内心坚强，喜欢在安静的地方读故事书，也喜欢和咕咕嘎嘎一起在草地上晒太阳，分享彼此的小秘密。doro教会了大家：温柔，是世界上最强大的力量。");

// Section III - 糯糯
replace(17, "三、实验项目分析", "三、糯糯：纯真的小团子");
replace(18, "1．使用input()函数获取用户的个人信息，如呢称、博客、联系电话、邮箱、项目等。", "糯糯是一只软萌的小团子，圆滚滚的身体让它看起来就像一颗会走路的糯米团子。它天真烂漫，对一切都充满了善意和好奇，最喜欢吃甜食，每次吃到美味的点心都会开心得原地转圈圈。");
replace(19, "2．使用print()函数和格式控制，设计名片设计。", "咕咕嘎嘎经常带糯糯去探索新的甜品店，两只小可爱一起品尝美食的场景总是让人忍不住微笑。糯糯说：\"和最好的朋友们分享甜蜜，就是世界上最幸福的事情！\"");
replace(20, "3．将生成的名片输出到控制台或保存到文件中。", "虽然糯糯有时候会有些笨手笨脚，但它纯真的心和满满的爱让每一个朋友都感到温暖。它教会了大家：做最真实的自己，就是最可爱的。");

// Section IV - 冒险故事
replace(21, "四、实验项目实现", "四、彩虹森林大冒险");
replace(22, "(1)", "在一个阳光明媚的早晨，咕咕嘎嘎推开窗户，心想：今天要约好朋友们一起去彩虹森林冒险！");
replace(23, 'name = input(&quot;请输入昵称：&quot;)', "咕咕嘎嘎先去找非比就比，非比就比正在院子里浇花。听到要去冒险，它立刻放下水壶，兴奋地跳了起来：\"早就想去彩虹森林了！我们出发吧！\"");
replace(24, 'blog = input(&quot;请输入博客：&quot;)', "接着它们去找doro，doro正趴在窗台上打盹。被叫醒后，doro慵懒地伸了个懒腰，温柔地说：\"和你们一起去，哪里都好。\"");
replace(25, 'phone = input(&quot;请输入手机号：&quot;)', "最后来到糯糯家门口，糯糯正在吃早餐——一颗大大的草莓蛋糕。听说要去冒险，糯糯三口两口吃完，蹦蹦跳跳地加入：\"等等我！带上我的小饼干！\"");
replace(26, 'email = input(&quot;请输入邮箱：&quot;)', "就这样，四个好朋友手拉着手出发了。一路上唱歌、说笑，连路边的小花都跟着摇摆起来。它们穿过金色的麦田，跨过叮咚的小溪，向着远方彩虹的方向前进。");
replace(27, 'project = input(&quot;请输入你的项目：&quot;)', "在彩虹森林里，它们遇到了会说话的老橡树——橡树爷爷，会发光的蘑菇精灵，还有一条善良的小溪姑娘。每一个新朋友都让冒险更加精彩。");
replace(29, 'print(&quot;=&quot; * 30)', "它们互相帮助跨过了摇晃的木桥，钻过了开满紫藤花的隧道，终于来到了传说中的「星星草地」——那是一片在夜晚会发光的草原。");
replace(30, 'print(f&quot;姓名：{name}&quot;)', "躺在星星草地上，满天繁星触手可及。非比就比说：\"有你们在身边，我就是世界上最勇敢的小兔子！\"");
replace(31, 'print(f&quot;博客：{blog}&quot;)', "doro微笑着说：\"和你们在一起的每一天，都像在读一本最温暖的故事书。\"");
replace(32, 'print(f&quot;手机号：{phone}&quot;)', "糯糯开心地打了个滚：\"你们是我最甜最甜的好朋友，比草莓蛋糕还要甜一百倍！\"");
replace(33, 'print(f&quot;邮箱：{email}&quot;)', "咕咕嘎嘎看着三个好朋友，心里暖洋洋的：\"不管去到哪里，只要有你们在，那里就是最棒的地方！\"");
replace(34, 'print(f&quot;项目：{project}&quot;)', "夜幕降临，萤火虫点亮了回家的小路。四个好朋友手牵着手，约定明天还要一起去新的地方冒险。友谊的光芒，比任何星星都要明亮。");
replace(36, "（2）", "因为真正的快乐，不是去了哪里，而是和谁在一起。非比就比给了它勇气，doro给了它温暖，糯糯给了它甜蜜——这就是世界上最棒的礼物。");

// Section V - 友谊真谛
replace(39, "五、实验项目优化", "五、友谊教会我们的事");
replace(40, "为了进一步提升个人名片生成程序的功能和用户体验，可以从以下方面进行优化。", "和好朋友们相处的每一天，咕咕嘎嘎都学到了不一样的道理。这些道理就像一颗颗闪闪发光的宝石，串成了心中最珍贵的项链。");
replace(41, "首先，丰富名片模板库，设计多种样式的名片模板，以满足用户多样化的需求；其次，引", "非比就比教会了它勇敢——面对困难不退缩，相信自己可以做到。每当咕咕嘎嘎感到害怕时，想");
replace(42, "入GUI，使用Tkinter等开发直观的操作界面，以提升程序的交互性和易用性；再次，增", "起非比就比坚定的眼神，就会重新充满力量，勇敢地迈出第一步。朋友是照亮黑暗的那盏灯。");
replace(43, "加名片预览功能，允许用户在生成名片前实时查看效果，并支持对名片样式进行调整；最", "doro教会了它温柔——说话轻声细语，对每一个人都充满耐心和善意。咕咕嘎嘎学着doro的样子去对待身边的人，");
replace(44, "后，扩展批量生成功能，支持同时为多个用户生成名片，以应对团队或公司等需要批量处", "发现世界也变得更加柔软和温暖。温柔不是软弱，而是一种让周围的人都感到舒服的力量。");
replace(45, "理的场景，从而提升程序的实用性和效率。", "糯糯教会了它纯真——用最简单的心去看世界，用最真诚的爱去对待朋友，每一天都能发现生活中的小美好。朋友是甜蜜的糖果，让平凡的日子变得闪闪发光。");

// Section VI - 结语
replace(47, "六、总结和启示", "六、致我最爱的好朋友们");
replace(48, "本次Python程序设计实验完成了交互式个人名片生成程序的基础开发。通过对Python基础输入输出函数的运用，成功实现了用户信息采集、名片格式化展示的核心功能：借助input()获取昵称、联系方式等自定义信息，利用print()结合字符串格式化完成名片排版，最终可以在控制台输出清晰规整的个人名片。实验围绕需求拆解了开发步骤，从功能分析到代码落地，验证了Python基础语法解决实际小项目的可行性。同时实验也梳理出基础版本的优化方向，明确了程序在功能丰富度、交互体验、实用性上可以拓展的空间，为后续迭代提供了清晰路径。", "咕咕嘎嘎和好朋友们的故事还在继续。每一天都是新的一页，每一次相遇都是珍贵的礼物。非比就比的勇敢、doro的温柔、糯糯的纯真，这些美好的品质就像星星一样照亮了咕咕嘎嘎的世界。友谊不需要华丽的语言，它就在每一次牵手、每一个微笑、每一句\"我们一起\"里面。这就是《咕咕嘎嘎》的好朋友们——一群平凡却又不平凡的小伙伴，用最真诚的心，写下了最动人的故事。");
replace(49, "启示", "写给好朋友们的话");
replace(50, "编程学习要从落地小项目切入：本次项目依托Python最基础的输入输出语法就能完成实用工具开发，说明编程能力的提升离不开从简单需求出发的实践，把基础语法和实际场景结合，能更深刻理解编程语言的应用价值。", "谢谢非比就比，你的勇敢让我学会面对困难不退缩。谢谢你总是在我需要的时候站在我身边，用行动告诉我：没有什么过不去的坎。");
replace(51, '需求分析是开发的核心前提：将&quot;生成个人名片&quot;这个大需求拆解为信息获取、排版设计、结果输出三个子任务，让开发过程变得清晰可控，这启示我们解决任何编程问题，都需要先拆解目标、分步实现，避免无从下手。', "谢谢doro，你的温柔让我学会用心去感受这个世界。谢谢你用最柔软的方式教会我最坚强的道理：温柔的人最强大，善良的人最美丽。");
replace(52, "程序开发是持续迭代的过程：基础版本虽然实现了核心功能，但依然存在功能单一、交互性不足的问题，这说明开发完成不是终点，从用户体验和场景需求出发持续优化，才能让程序更具实用性；同时也培养了我们对项目的扩展思维，学会从不同维度思考程序的改进方向。", "谢谢糯糯，你的纯真让我学会用最简单的心去爱这个世界。谢谢你让我明白：快乐不需要理由，幸福就藏在每一颗糖果和每一个拥抱里面。");
replace(53, "Python语法的灵活性为小工具开发提供了便利：仅用基础语法就快速实现了交互式工具，体现了Python作为入门语言简洁、高效的优势，也增强了我们后续深入学习Python开发更复杂应用的信心。", "谢谢咕咕星球，让我们相遇。在这颗小小的星球上有太多美好的事物，而最美好的，就是和你们——我最爱的好朋友们——一起度过的每一天。");

console.log(`  Text: ${ok} OK, ${miss} MISS`);

// ============================================================
// STEP 3: Add images to in-memory zip
// ============================================================
console.log("Step 3: Adding images...");

// Read rels from zip
const relsEntry = doc.zip.getEntry("word/_rels/document.xml.rels");
const relsXml = relsEntry.getData().toString("utf-8");
const relsTree = parseXml(relsXml);
const rels = relsTree[0]; // Root IS Relationships

// Read content types
const ctEntry = doc.zip.getEntry("[Content_Types].xml");
const ctXml = ctEntry.getData().toString("utf-8");
const ctTree = parseXml(ctXml);
const types = ctTree[0]; // Root IS Types

// Ensure content types
let hasPng = false, hasJpg = false;
for (const d of findAll(types, "Default")) {
  const a = attrsOf(d);
  if (a["@_Extension"] === "png") hasPng = true;
  if (a["@_Extension"] === "jpg" || a["@_Extension"] === "jpeg") hasJpg = true;
}
if (!hasPng) childrenOf(types).push({ "Default": [], ":@": { "@_Extension": "png", "@_ContentType": "image/png" } });
if (!hasJpg) childrenOf(types).push({ "Default": [], ":@": { "@_Extension": "jpg", "@_ContentType": "image/jpeg" } });

// Get max rId
let maxRid = 0;
for (const rel of findAll(rels, "Relationship")) {
  const id = attrsOf(rel)["@_Id"] || "";
  const n = parseInt(id.replace("rId", ""));
  if (n > maxRid) maxRid = n;
}

// Get existing media count
let maxMedia = 0;
for (const e of doc.zip.getEntries()) {
  const n = e.entryName;
  const m = n.match(/word\/media\/image(\d+)\./);
  if (m) { const num = parseInt(m[1]); if (num > maxMedia) maxMedia = num; }
}

// Map paragraph indices to body child positions
const body = findChild(doc.tree[0], "w:body");
const bodyChildren = childrenOf(body);
let paraIdx = 0;
const paraMap = [];
for (let i = 0; i < bodyChildren.length; i++) {
  const c = bodyChildren[i];
  if (typeof c === "object" && tagName(c) === "w:p") {
    paraMap.push({ idx: paraIdx, bodyIdx: i });
    paraIdx++;
  }
}

// Add images
let ridCtr = maxRid;
let mediaIdx = maxMedia + 1;
let inserted = 0;
const toInsert = [];

for (const img of images) {
  const filePath = join(guDir, img.file);
  if (!existsSync(filePath)) { console.log(`  SKIP: ${img.file} not found`); continue; }

  const info = getImageInfo(filePath);
  const mediaName = `image${mediaIdx}.${info.ext}`;
  const rId = `rId${++ridCtr}`;
  const imgName = img.file.replace(/\.[^.]+$/, "");

  // Scale: hero images wider, regular images max ~4 inches
  const MAX_HERO_W = 5702400;  // ~5.9 inches at 96dpi
  const MAX_REG_W = 3657600;   // ~3.8 inches
  const maxW = img.hero ? MAX_HERO_W : MAX_REG_W;
  let wEmu = info.w * 9525;
  let hEmu = info.h * 9525;
  if (wEmu > maxW) { hEmu = Math.round(hEmu * maxW / wEmu); wEmu = maxW; }

  // Add image to in-memory zip
  doc.zip.addFile(`word/media/${mediaName}`, info.buf);

  // Add relationship
  childrenOf(rels).push({
    "Relationship": [],
    ":@": {
      "@_Id": rId,
      "@_Type": "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image",
      "@_Target": `media/${mediaName}`
    }
  });

  // Find paragraph position (paragraphs shift by +1 for each previously inserted image)
  const pe = paraMap.find(p => p.idx === img.afterPara);
  if (pe) {
    toInsert.push({ bodyIdx: pe.bodyIdx + 1 + inserted, para: makeImageParagraph(rId, imgName, wEmu, hEmu, img.hero) });
    inserted++;
    console.log(`  Added ${img.file} (${info.w}x${info.h}px -> ${wEmu}x${hEmu} EMU) rId=${rId}`);
  } else {
    console.log(`  WARN: paragraph ${img.afterPara} not found for ${img.file}`);
  }
  mediaIdx++;
}

// Insert paragraphs in reverse order
toInsert.sort((a, b) => b.bodyIdx - a.bodyIdx);
for (const ins of toInsert) {
  bodyChildren.splice(ins.bodyIdx, 0, ins.para);
}

// ============================================================
// STEP 4: Update zip entries for rels, content types, and document
// ============================================================
console.log("Step 4: Saving all changes...");

// Update rels in zip
const relsDecl = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
doc.zip.updateFile("word/_rels/document.xml.rels", Buffer.from(buildXml(relsTree, relsDecl), "utf-8"));

// Update content types in zip
const ctDecl = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
doc.zip.updateFile("[Content_Types].xml", Buffer.from(buildXml(ctTree, ctDecl), "utf-8"));

// Update document tree cache and save
updateCachedTree(docPath, doc.tree);
saveDocx(doc, doc.tree);

console.log("\nDone! Final file:", outputPath);
console.log(`Text replacements: ${ok} OK, ${miss} missed`);
console.log(`Images added: ${inserted}`);
