// utils/store.js
var PLATFORMS = {
  deepseek: {
    name: 'DeepSeek (性价比高)',
    url: 'https://api.deepseek.com/v1/chat/completions',
    models: ['deepseek-v4-flash', 'deepseek-v4-pro', '自定义'],
    link: 'https://platform.deepseek.com/'
  },
  zlm: {
    name: '智谱 (提供免费模型)',
    url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    models: ['GLM-4.7-Flash (免费)', 'GLM-5.2', 'GLM-5.1', 'GLM-5', 'GLM-5-Turbo', 'GLM-4.7', 'GLM-4.7-FlashX', 'GLM-4.6', 'GLM-4.5-Air', 'GLM-4.5-AirX', 'GLM-4-Long', 'GLM-4-FlashX-250414', 'GLM-4-Flash-250414', '自定义'],
    link: 'https://bigmodel.cn/'
  },
  doubao: {
    name: '火山方舟 (豆包)',
    url: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    models: ['doubao-seed-2-0-lite-260428', 'doubao-seed-2-0-mini-260428', 'doubao-seed-2-0-pro-260215', '自定义'],
    link: 'https://www.volcengine.com/product/ark'
  }
};

var DETAIL_LEVELS = [
  { value: 'very_detailed', label: '非常详细' },
  { value: 'detailed', label: '详细' },
  { value: 'concise', label: '简洁' },
  { value: 'minimal', label: '极简' }
];

var DEFAULT_SETTINGS = {
  envId: '',
  platform: 'deepseek',
  apiUrl: 'https://api.deepseek.com/v1/chat/completions',
  apiKey: '',
  model: 'deepseek-v4-flash',
  customModel: '',
  sessdata: '',
  detailLevel: 'concise',
  opinionAnalysis: true,
  aiEvaluation: false,
  opinionCommentsCount: 30,
  autoAIAnalysis: false,
  confirmBeforeAI: true,
  confirmThreshold: 20000
};

function getSettings() {
  var s = wx.getStorageSync('settings') || {};
  return Object.assign({}, DEFAULT_SETTINGS, s);
}

function saveSettings(obj) {
  var cur = getSettings();
  var next = Object.assign({}, cur, obj);
  wx.setStorageSync('settings', next);
  return next;
}

function getApiKey() { return getSettings().apiKey; }
function getSessdata() { return getSettings().sessdata; }
function getEnvId() { return getSettings().envId; }

function getActualModel() {
  var s = getSettings();
  if (s.model === '自定义') return s.customModel || '';
  return (s.model || '').replace(' (免费)', '');
}

module.exports = {
  PLATFORMS: PLATFORMS,
  DETAIL_LEVELS: DETAIL_LEVELS,
  DEFAULT_SETTINGS: DEFAULT_SETTINGS,
  getSettings: getSettings,
  saveSettings: saveSettings,
  getApiKey: getApiKey,
  getSessdata: getSessdata,
  getEnvId: getEnvId,
  getActualModel: getActualModel
};
