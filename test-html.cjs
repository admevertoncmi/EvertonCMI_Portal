const linkifyHtml = (htmlText) => {
  if (!htmlText) return '';
  const urlRegex = /(?<!href=["'])(https?:\/\/[^\s<]+)/g;
  return htmlText.replace(urlRegex, function(url) {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });
}
const m = { roteiro: '<p>Line 1</p><p><br></p><p>Line 2</p>' };
const html = linkifyHtml(((m.roteiro?.includes('<p>') || m.roteiro?.includes('<br>')) ? m.roteiro : m.roteiro.replace(/\n/g, '<br/>')).replace(/\u00A0/g, ' ').replace(/&nbsp;/g, ' '));
console.log(html);
