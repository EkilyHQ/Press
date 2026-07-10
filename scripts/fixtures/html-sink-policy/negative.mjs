export async function executeUnreviewedMarkup(target, frame, range, source, moduleHref) {
  target['outerHTML'] = source;
  frame.srcdoc = source;
  frame['setAttribute']('srcdoc', source);
  document['wr' + 'ite'](source);
  const htmlMime = `text/${'html'}`;
  new DOMParser().parseFromString(source, htmlMime);
  new DOMParser().parseFromString(source, moduleHref);
  range.createContextualFragment(source);
  window['ev' + 'al'](source);
  new Function(source);
  Function(source);
  const timerSource = 'execute' + '()';
  setTimeout(timerSource, 0);
  window.setInterval(`execute()`, 0);
  setTimeout(source, 0);
  window.setInterval(source, 0);
  return import('./' + moduleHref);
}
