export async function renderControlledMarkup(target, template) {
  const xmlMime = 'application/xml';
  const later = () => target.removeAttribute('aria-busy');
  function finish() {
    target.removeAttribute('aria-live');
  }
  target.innerHTML = '';
  const serialized = template.outerHTML;
  target.insertAdjacentHTML('beforeend', serialized);
  new DOMParser().parseFromString('<root/>', xmlMime);
  setTimeout(later, 0);
  setInterval(finish, 1000);
  return import('./reviewed-module.js');
}
