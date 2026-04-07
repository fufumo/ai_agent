function preprocessText(text = '') {
  return String(text || '')
    .trim()
    .replace(/　/g, ' ')
    .replace(/[，。！？；：]/g, s => {
      const map = {
        '，': ',',
        '。': '.',
        '！': '!',
        '？': '?',
        '；': ';',
        '：': ':'
      };
      return map[s] || s;
    })
    .replace(/\s+/g, ' ');
}

module.exports = {
  preprocessText
};