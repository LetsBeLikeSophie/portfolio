// tesseract.js 워커를 감싸는 파일.
// .gz 파일을 올릴 수 없는 곳(예: 미리보기용 호스팅)에서는 학습 데이터 파일 이름 뒤에
// LANG_SUFFIX를 붙여 올리고 여기 값만 바꾸면 된다. itssophie.dev에서는 빈 값 그대로.
var LANG_SUFFIX = '';
var origFetch = self.fetch.bind(self);
self.fetch = function (url, opts) {
  if (LANG_SUFFIX && typeof url === 'string' && /\.traineddata(\.gz)?$/.test(url)) url += LANG_SUFFIX;
  return origFetch(url, opts);
};
importScripts('worker.min.js');
