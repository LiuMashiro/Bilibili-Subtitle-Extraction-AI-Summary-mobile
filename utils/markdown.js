// utils/markdown.js

function escapeHtml(t) {
  if (t == null) return '';
  return String(t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function textNode(t) {
  return { type: 'text', text: t };
}

var STYLE_LIGHT = {
  h1: 'font-size:20px;font-weight:800;margin:20px 0 10px;padding-bottom:8px;border-bottom:1px solid #E2E8F0;line-height:1.4;',
  h2: 'font-size:18px;font-weight:700;margin:24px 0 12px;line-height:1.4;',
  h3: 'font-size:16px;font-weight:600;color:#00AEEC;margin:28px 0 10px;line-height:1.4;',
  p: 'margin:10px 0;color:#334155;line-height:1.95;font-size:15px;',
  strong: 'font-weight:700;color:#0F172A;',
  em: 'font-style:italic;',
  code: 'background:#F1F5F9;color:#00AEEC;padding:2px 6px;border-radius:4px;font-size:13px;font-family:monospace;',
  blockquote: 'border-left:3px solid #00AEEC;padding:10px 12px;margin:12px 0;background:rgba(0,174,236,0.04);border-radius:0 6px 6px 0;color:#64748B;line-height:1.9;font-size:14px;',
  ul: 'padding-left:20px;margin:10px 0;',
  ol: 'padding-left:20px;margin:10px 0;',
  li: 'margin:7px 0;font-size:15px;color:#334155;line-height:1.9;',
  hrDiv: 'height:1px;background:#E2E8F0;margin:36px 0;font-size:0;line-height:0;overflow:hidden;',
  pre: 'background:#0F172A;color:#E2E8F0;padding:14px;border-radius:8px;overflow-x:auto;font-size:13px;line-height:1.7;',
  preCode: 'background:transparent;color:inherit;padding:0;font-size:13px;font-family:monospace;'
};

var STYLE_DARK = {
  h1: 'font-size:20px;font-weight:800;margin:20px 0 10px;padding-bottom:8px;border-bottom:1px solid #334155;line-height:1.4;color:#F1F5F9;',
  h2: 'font-size:18px;font-weight:700;margin:24px 0 12px;line-height:1.4;color:#F1F5F9;',
  h3: 'font-size:16px;font-weight:600;color:#00AEEC;margin:28px 0 10px;line-height:1.4;',
  p: 'margin:10px 0;color:#CBD5E1;line-height:1.95;font-size:15px;',
  strong: 'font-weight:700;color:#F1F5F9;',
  em: 'font-style:italic;',
  code: 'background:#334155;color:#00AEEC;padding:2px 6px;border-radius:4px;font-size:13px;font-family:monospace;',
  blockquote: 'border-left:3px solid #00AEEC;padding:10px 12px;margin:12px 0;background:rgba(0,174,236,0.08);border-radius:0 6px 6px 0;color:#94A3B8;line-height:1.9;font-size:14px;',
  ul: 'padding-left:20px;margin:10px 0;',
  ol: 'padding-left:20px;margin:10px 0;',
  li: 'margin:7px 0;font-size:15px;color:#CBD5E1;line-height:1.9;',
  hrDiv: 'height:1px;background:#334155;margin:36px 0;font-size:0;line-height:0;overflow:hidden;',
  pre: 'background:#000000;color:#E2E8F0;padding:14px;border-radius:8px;overflow-x:auto;font-size:13px;line-height:1.7;',
  preCode: 'background:transparent;color:inherit;padding:0;font-size:13px;font-family:monospace;'
};

function getStyle() {
  try {
    var info = wx.getSystemInfoSync();
    if (info && info.theme === 'dark') return STYLE_DARK;
  } catch (e) {}
  return STYLE_LIGHT;
}

var STYLE = getStyle();

function styledNode(name, style, children) {
  return { type: 'node', name: name, attrs: { style: style }, children: children };
}

// 行内：**粗体** *斜体* `代码`
function processInline(text) {
  var nodes = [];
  var regex = /(`[^`]+`)|(\*\*[\s\S]+?\*\*)|(\*[\s\S]+?\*)/g;
  var last = 0;
  var m;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(textNode(text.slice(last, m.index)));
    }
    var tok = m[0];
    if (tok.charAt(0) === '`') {
      nodes.push(styledNode('code', STYLE.code, [textNode(tok.slice(1, -1))]));
    } else if (tok.charAt(0) === '*' && tok.charAt(1) === '*') {
      nodes.push(styledNode('strong', STYLE.strong, [textNode(tok.slice(2, -2))]));
    } else if (tok.charAt(0) === '*') {
      nodes.push(styledNode('em', STYLE.em, [textNode(tok.slice(1, -1))]));
    }
    last = regex.lastIndex;
  }
  if (last < text.length) {
    nodes.push(textNode(text.slice(last)));
  }
  return nodes.length ? nodes : [textNode(text)];
}

function markdownToNodes(md) {
  if (!md) return [textNode('')];
  STYLE = getStyle();
  md = md.replace(/\r\n/g, '\n');
  var lines = md.split('\n');
  var nodes = [];
  var stack = []; // { type, indent, node, lastLi }
  var inCode = false;
  var codeLines = [];

  function closeAllLists() { stack = []; }

  function makeListNode(type, indent) {
    var listNode = styledNode(type, type === 'ul' ? STYLE.ul : STYLE.ol, []);
    return { type: type, indent: indent, node: listNode, lastLi: null };
  }

  function makeLiNode(content) {
    return styledNode('li', STYLE.li, processInline(content));
  }

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line.trim().indexOf('```') === 0) {
      if (inCode) {
        nodes.push(styledNode('pre', STYLE.pre, [styledNode('code', STYLE.preCode, [textNode(codeLines.join('\n'))])]));
        codeLines = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) { codeLines.push(line); continue; }

    var indentMatch = line.match(/^[ \t]*/);
    var indent = indentMatch[0].replace(/\t/g, '    ').length;
    var t = line.trim();
    if (!t) { closeAllLists(); continue; }

    var ul = t.match(/^[-*][ \t]+(.*)$/);
    var ol = t.match(/^(\d+)\.[ \t]+(.*)$/);
    if (ul || ol) {
      var type = ul ? 'ul' : 'ol';
      var content = ul ? ul[1] : ol[2];
      var liNode = makeLiNode(content);

      if (!stack.length) {
        var entry = makeListNode(type, indent);
        entry.node.children.push(liNode);
        entry.lastLi = liNode;
        nodes.push(entry.node);
        stack.push(entry);
      } else {
        var top = stack[stack.length - 1];
        if (indent > top.indent) {
          var childEntry = makeListNode(type, indent);
          childEntry.node.children.push(liNode);
          childEntry.lastLi = liNode;
          top.lastLi.children.push(childEntry.node);
          stack.push(childEntry);
        } else if (indent < top.indent) {
          while (stack.length && stack[stack.length - 1].indent > indent) stack.pop();
          if (!stack.length || stack[stack.length - 1].indent < indent) {
            var newEntry = makeListNode(type, indent);
            newEntry.node.children.push(liNode);
            newEntry.lastLi = liNode;
            if (stack.length) {
              stack[stack.length - 1].lastLi.children.push(newEntry.node);
            } else {
              nodes.push(newEntry.node);
            }
            stack.push(newEntry);
          } else {
            top.node.children.push(liNode);
            top.lastLi = liNode;
          }
        } else {
          if (top.type !== type) {
            stack.pop();
            var repEntry = makeListNode(type, indent);
            repEntry.node.children.push(liNode);
            repEntry.lastLi = liNode;
            if (stack.length) {
              stack[stack.length - 1].lastLi.children.push(repEntry.node);
            } else {
              nodes.push(repEntry.node);
            }
            stack.push(repEntry);
          } else {
            top.node.children.push(liNode);
            top.lastLi = liNode;
          }
        }
      }
      continue;
    }

    closeAllLists();
    if (/^---+$/.test(t)) { nodes.push(styledNode('div', STYLE.hrDiv, [textNode(' ')])); continue; }
    var h = t.match(/^(#{1,6})[ \t]+(.*)$/);
    if (h) {
      var level = Math.min(h[1].length, 3);
      var hStyle = level === 1 ? STYLE.h1 : (level === 2 ? STYLE.h2 : STYLE.h3);
      nodes.push(styledNode('h' + level, hStyle, processInline(h[2])));
      continue;
    }
    var bq = t.match(/^>[ \t]*(.*)$/);
    if (bq) {
      nodes.push(styledNode('blockquote', STYLE.blockquote, processInline(bq[1])));
      continue;
    }
    nodes.push(styledNode('p', STYLE.p, processInline(t)));
  }
  if (inCode) {
    nodes.push(styledNode('pre', STYLE.pre, [styledNode('code', STYLE.preCode, [textNode(codeLines.join('\n'))])]));
  }
  closeAllLists();

  return nodes;
}

module.exports = {
  escapeHtml,
  processInline,
  markdownToNodes
};
