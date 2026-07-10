export function renderUnapprovedMarkup(first, second, payload) {
  const computedName = 'inner' + 'HTML';
  first.innerHTML = payload;
  second['innerHTML'] = payload;
  first[computedName] = payload;
  second[`${'inner'}HTML`] = payload;
  first.insertAdjacentHTML('beforeend', payload);
  second['insert' + 'AdjacentHTML']('beforeend', payload);
}
