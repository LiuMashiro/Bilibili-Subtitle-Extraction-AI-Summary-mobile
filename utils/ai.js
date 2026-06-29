// utils/ai.js —— 仅支持 OpenAI 兼容协议（DeepSeek/智谱/豆包）
var store = require('./store');

function buildRequest(messages, settings) {
  var actualModel = (settings.model === '自定义' ? (settings.customModel || '') : (settings.model || ''));
  actualModel = actualModel.replace(' (免费)', '');
  var apiKey = (settings.apiKey || '').replace(/[^\x20-\x7E]/g, '');

  return {
    url: settings.apiUrl,
    method: 'POST',
    header: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey,
      'Accept': 'text/event-stream'
    },
    data: {
      model: actualModel,
      messages: messages,
      stream: true,
      temperature: 0.7
    }
  };
}

function decodeUTF8(buf) {
  var bytes = new Uint8Array(buf);
  var binary = '';
  for (var i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  try {
    return decodeURIComponent(escape(binary));
  } catch (e) {
    return binary;
  }
}

function streamChat(messages, settings, onChunk) {
  return new Promise(function (resolve, reject) {
    if (!settings.apiKey) {
      reject(new Error('未设置 API Key，请前往设置页填写'));
      return;
    }
    var req = buildRequest(messages, settings);
    var full = '';
    var buf = '';
    var resolved = false;
    var idleTimer = null;

    function clearIdle() { if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; } }
    function resetIdle() {
      clearIdle();
      idleTimer = setTimeout(function () {
        if (!resolved) {
          resolved = true;
          try { task.abort && task.abort(); } catch (e) {}
          reject(new Error('流式响应超时（90s 无新数据）'));
        }
      }, 90000);
    }

    var task = wx.request({
      url: req.url,
      method: req.method || 'POST',
      header: req.header,
      data: req.data,
      enableChunked: true,
      timeout: 120000,
      responseType: 'text',
      success: function (res) {
        clearIdle();
        if (resolved) return;
        if (res.statusCode >= 400) {
          resolved = true;
          var map = {
            401: 'API Key 无效或已过期（401）',
            403: '无访问权限（403），请检查 API Key',
            404: '接口地址或模型不存在（404）',
            429: '请求过于频繁或额度不足（429）',
            500: '服务器内部错误（500）',
            502: '网关错误（502）',
            503: '服务暂不可用（503）'
          };
          reject(new Error(map[res.statusCode] || ('请求失败：' + res.statusCode)));
        } else {
          resolved = true;
          resolve(full);
        }
      },
      fail: function (err) {
        clearIdle();
        if (resolved) return;
        resolved = true;
        var msg = (err && err.errMsg) || '网络请求失败';
        if (msg.indexOf('timeout') !== -1) msg = '请求超时';
        reject(new Error(msg));
      }
    });

    resetIdle();

    task.onChunkReceived && task.onChunkReceived(function (res) {
      resetIdle();
      var text = decodeUTF8(res.data);
      buf += text;
      var lines = buf.split('\n');
      buf = lines.pop();
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line || line.charAt(0) === ':') continue;
        if (line.indexOf('data:') !== 0) continue;
        var ds = line.slice(5).trim();
        if (ds === '[DONE]') {
          clearIdle();
          if (!resolved) { resolved = true; resolve(full); }
          return;
        }
        try {
          var d = JSON.parse(ds);
          var chunk = (d.choices && d.choices[0] && d.choices[0].delta && d.choices[0].delta.content) || '';
          if (chunk) {
            full += chunk;
            onChunk(full);
          }
        } catch (e) {
          // incomplete JSON fragment, leave in buf
        }
      }
    });
  });
}

module.exports = {
  buildRequest: buildRequest,
  streamChat: streamChat
};
