// utils/prompt.js
function getFormatRules() {
  return '允许使用的 Markdown 格式（仅限以下几种）：\n' +
    '- 标题：#、##、###（最多三级，禁止四级及以上）\n' +
    '- 粗体：**文字**\n' +
    '- 斜体：*文字*\n' +
    '- 无序列表：- 或 *\n' +
    '- 有序列表：1. 2. 3.\n' +
    '- 引用：>\n' +
    '- 分割线：---\n' +
    '- 行内代码：`代码`\n\n' +
    '禁止使用的格式：\n' +
    '- 任何 HTML 标签（如 <div>、<script>、<span> 等）\n' +
    '- 表格（| ... |）\n' +
    '- 图片（![]()）\n' +
    '- 超链接（[]()）\n' +
    '- 四级及以上标题\n' +
    '- 任何 LaTeX 公式（禁止使用 $ 符号包裹公式，数学概念请用文字或代码描述）';
}

function getAISummaryPrompt(hasSubtitle, settings) {
  var aiEvaluation = settings.aiEvaluation;
  var opinionAnalysis = settings.opinionAnalysis;
  var formatRules = getFormatRules() + '\n\n';

  if (!hasSubtitle) {
    return formatRules + '注意：当前视频未提供字幕数据。请不要进行视频内容总结，而是根据提供的视频标题、简介以及热门评论区数据（如果有），直接进行舆论分析。\n' +
      '如果没有提供评论数据，则说明无法进行深度的舆论分析，可以仅分析标题与简介的倾向。\n\n' +
      '请直接输出舆论分析：\n## 舆论分析\n' +
      '- 提炼评论区或标题简介的1-N个主要观点方向，简明概括每个方向的核心立场，标注情感倾向（正面/负面/中性/混合）和大约占比。\n' +
      '- 如有高赞代表性观点，可简要引用（无需标注用户名）\n' +
      '- 一句话概括整体氛围\n' +
      (aiEvaluation ? '---\n\n## AI评价\n对视频做出客观、理性、简洁、透过现象看本质、深度且一针见血的评价。自行决定对本视频、本评论区的立场（可以支持、可以反对），但言语保持克制。考虑到信息滞后，请默认内容事实属实，不质疑事实真实性。\n' : '') +
      '\n标注音符♪符号的是背景音乐/主人物唱歌。\n';
  }

  var summaryWord, overviewWord, listWord;
  switch (settings.detailLevel) {
    case 'very_detailed': summaryWord = '非常详细'; overviewWord = '全面'; listWord = '详细地分点列出核心结论、关键信息和具体细节（包含论述过程和支撑论据）'; break;
    case 'detailed': summaryWord = '详细'; overviewWord = '详细'; listWord = '详细地分点列出核心结论和关键信息'; break;
    case 'minimal': summaryWord = '极简'; overviewWord = '极简'; listWord = '极简地分点列出核心要点（剔除一切修饰性废话）'; break;
    default: summaryWord = '简洁'; overviewWord = '简明'; listWord = '精简地分点列出核心结论和关键信息（剔除修饰性废话）'; break;
  }
  return formatRules + '注意：请不要在总结中提及视频中的任何广告植入、商业推广等内容，只聚焦核心内容。\n' +
    '字幕为智能识别，可能包含错误。\n\n' +
    '请根据字幕内容，生成一份【' + summaryWord + '】的视频总结（确保第一行为"## 视频总结"）：\n' +
    '1. ' + overviewWord + '概括视频核心主题和整体概述。\n' +
    '2. ' + listWord + '。\n' +
    '最多使用"###"三个井号。\n\n' +
    '正确的例子：\n## 视频总结\n\n### 核心主题\n示例内容。\n\n### 核心结论与关键信息\n\n- **示例内容**：\n  - 示例内容。\n\n' +
    '如果提供了热门评论数据，在"核心结论与关键信息"之后，使用分割线"---"隔开，输出舆论分析：\n' +
    '## 舆论分析\n' +
    '- 提炼评论区的1-N个主要观点方向（不一定非要是多个，根据情况决定），简明概括每个方向的核心立场，标注每个观点方向的情感倾向（正面/负面/中性/混合）和大约占比。\n' +
    '- 如有高赞代表性观点，可简要引用（无需标注用户名）\n' +
    '- 一句话概括评论区整体氛围\n' +
    '如果没有提供评论数据，则跳过此部分，不输出"---"和"## 舆论分析"。\n' +
    (aiEvaluation ? '\n无论是否输出舆论分析，在其后使用分割线"---"隔开，输出AI评价：\n## AI评价\n对视频做出客观、理性、简洁、透过现象看本质、深度且一针见血的评价。自行决定对本视频、本评论区的立场（可以支持、可以反对），但言语保持克制。考虑到信息滞后，请默认内容事实属实，不质疑事实真实性。\n' : '') +
    '\n标注音符符号的是背景音乐/主人物唱歌。\n\n';
}

function buildFullPrompt(subtitleText, videoInfo, comments, settings) {
  var hasSubtitle = !!(subtitleText && subtitleText.trim());
  var contextInfo = '';
  if (videoInfo) {
    if (videoInfo.title) contextInfo += '视频标题：' + videoInfo.title + '\n';
    if (videoInfo.desc) contextInfo += '视频简介：' + videoInfo.desc + '\n';
    if (videoInfo.tags && videoInfo.tags.length > 0) contextInfo += '视频标签：' + videoInfo.tags.join(', ') + '\n';
    if (contextInfo) contextInfo += '\n';
  }
  if (settings.opinionAnalysis && comments) {
    contextInfo += '===== 热门评论（按热度排序）=====\n' + comments + '\n\n';
  }
  var finalSubtitle = hasSubtitle ? subtitleText : '';
  return getAISummaryPrompt(hasSubtitle, settings) + '\n\n' + contextInfo + (hasSubtitle ? '===== 视频字幕 =====\n' + finalSubtitle : '');
}

module.exports = {
  getFormatRules: getFormatRules,
  getAISummaryPrompt: getAISummaryPrompt,
  buildFullPrompt: buildFullPrompt
};
