const html = '<p>https://google.com&nbsp;and https://apple.com</p>';
const urlRegex = /((?:https?:\/\/|www\.)[^\s<]+)/gi;
let tempHtml = html;
tempHtml = tempHtml.replace(urlRegex, (url) => {
  console.log('Matched:', url);
  return 'X';
});
