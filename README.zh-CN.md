# word-chisel

[English](README.md)

让 Claude 直接帮你改 Word 文档——不需要打开 Office，不需要手动复制粘贴。**格式、字体、图片位置、页面布局、信息排版全部原样保留**，只替换你指定的文本内容。

安装后，Claude 能像编辑纯文本一样精准修改 `.docx` / `.doc` 文件：

- **改文字不改格式**——加粗、斜体、字体、颜色全部原样保留，只替换你指定的文本
- **跨样式边界智能匹配**——搜索词分散在多个不同格式的片段中也能一次找到、一次替换
- **原始文件零风险**——所有修改都在副本上进行，原文件毫发无伤
- **`.doc` 自动转换**——老版本文档自动转为 `.docx` 再编辑，无缝兼容

适用于改实验报告、更新合同条款、批量替换文档中的关键信息、在不破坏排版的前提下微调内容。

## 安装

**方式一：复制到 Claude（推荐）**

把下面这段话直接发给 Claude，AI 会自动完成安装和配置：

```
请帮我安装 word-chisel。

这是它的 npm 包：word-chisel（https://www.npmjs.com/package/word-chisel）

安装步骤：
1. 检查 Node.js 是否可用（node --version），如不可用请提示我安装
2. 运行 npx word-chisel setup，这会自动注册 MCP 服务器和安装 skill
3. 验证 ~/.claude/.mcp.json 中已包含 word-chisel 配置
4. 验证 ~/.claude/skills/word-chisel.md 已创建
5. 保存以下记忆：当使用 Claude 进行 Word 文档（.docx/.doc）编辑时，阅读 ~/.claude/skills/word-chisel.md，调用 word-chisel 的 MCP 工具（list_paragraphs / read_docx / replace_text）进行精确修改。
6. 告诉我安装完成，需要重启客户端才能生效

如果遇到错误，请解释原因并告诉我如何解决，不要自行安装额外软件。
```

**方式二：终端命令**

```bash
npx word-chisel setup
```

## 功能


| 工具                | 用途                                                            |
| ----------------- | ------------------------------------------------------------- |
| `list_paragraphs` | 浏览文档结构 — 段落索引、样式、run 数量、文本预览                                  |
| `read_docx`       | 读取完整文本，含 run 级格式详情（加粗、斜体、字体、字号、颜色等）                           |
| `replace_text`    | 精确替换文本并保留全部格式。支持跨 run 匹配。两种策略：继承首个 run 的格式，或按比例分配保持各 run 原有格式 |


## 安全机制

所有编辑遵循 **先复制再修改** 原则：

- `.docx` → 复制为 `<outputName>.docx`，编辑写入副本
- `.doc` → LibreOffice 转换为 `.docx`，编辑写入转换文件
- **原始文件始终不被触碰**

每次工具返回都包含 `outputPath`（实际被编辑的文件路径）和 `note`（说明复制/转换情况）。

## 环境要求

- **Node.js** 18+

### 编辑 `.doc` 文件需要 LibreOffice

> `.doc`（Word 97-2003）是微软的私有二进制格式。word-chisel 依赖 LibreOffice 将其无损转为 `.docx` 后再处理。

如果你只编辑 `.docx` 文件，**无需安装任何额外工具**。如果遇到 `.doc` 文件，有两个选择：

**方案 A：安装 LibreOffice（推荐，全自动）**

安装后 word-chisel 自动探测，无需配置 PATH。

| 平台 | 安装命令 | 备用下载 |
|------|---------|---------|
| Windows | `winget install TheDocumentFoundation.LibreOffice` | [libreoffice.org/download](https://www.libreoffice.org/download/) |
| macOS | `brew install --cask libreoffice` | [libreoffice.org/download](https://www.libreoffice.org/download/) |
| Linux | `sudo apt install libreoffice` | `sudo dnf install libreoffice`（Fedora） |

> macOS 未安装 Homebrew？先执行 `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`

**方案 B：手动另存**

用 Word / WPS 打开 `.doc` → 另存为 `.docx` → 交给 word-chisel 处理。完全不依赖 LibreOffice。

未安装 LibreOffice 时尝试编辑 `.doc` 文件，会返回明确的 `LIBREOFFICE_NOT_FOUND` 错误。

## 使用示例

安装后，在 Claude 中直接说：

```
"帮我把 C:/docs/实验报告.docx 第三段的'个人名片设计'改成'字典排序'"
```

Claude 会自动：

1. `list_paragraphs` — 查看文档结构
2. `read_docx` — 确认精确文本
3. `replace_text` — 精准替换，保留格式
4. 返回输出文件路径

## 开发

```bash
git clone <repo>
cd word-chisel
npm install
npm run build
npm test
```

## 许可证

MIT