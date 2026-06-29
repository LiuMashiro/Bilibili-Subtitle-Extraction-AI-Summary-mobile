// utils/subtitle.js
function pad2(n) { return n < 10 ? '0' + n : '' + n; }

function formatTime(s) {
  var m = Math.floor(s / 60);
  var sec = Math.floor(s % 60);
  return m + ':' + pad2(sec);
}

function formatTimeWithMs(s) {
  var m = Math.floor(s / 60);
  var sec = Math.floor(s % 60);
  var ms = Math.floor((s % 1) * 100);
  return m + ':' + pad2(sec) + '.' + pad2(ms);
}

function getTimestampedText(body) {
  if (!body || !body.length) return '';
  var lines = [];
  for (var i = 0; i < body.length; i++) {
    var it = body[i];
    lines.push('[' + formatTime(it.from) + ' - ' + formatTime(it.to) + '] ' + (it.content || ''));
  }
  return lines.join('\n');
}

function getPlainText(body) {
  if (!body || !body.length) return '';
  var lines = [];
  for (var i = 0; i < body.length; i++) {
    lines.push(body[i].content || '');
  }
  return lines.join('\n');
}

function formatCommentsForAI(comments) {
  if (!comments || !comments.length) return '';
  var lines = [];
  for (var i = 0; i < comments.length; i++) {
    var c = comments[i];
    var text = c.content || '';
    if (text.length > 200) text = text.slice(0, 200) + '...';
    lines.push('"' + text + '" ' + (c.like || 0) + '赞');
  }
  return lines.join('\n');
}

module.exports = {
  formatTime,
  formatTimeWithMs,
  getTimestampedText,
  getPlainText,
  formatCommentsForAI
};
