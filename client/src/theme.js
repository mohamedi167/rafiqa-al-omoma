// تبديل ألوان التطبيق حسب نوع المولود: ولد = أزرق، بنت = وردي.
const KEY = 'rafiqa_theme';

export function setGenderTheme(gender) {
  const root = document.documentElement;
  let theme = '';
  if (gender === 'male') theme = 'boy';
  else if (gender === 'female') theme = 'girl';
  if (theme) {
    root.setAttribute('data-theme', theme);
    localStorage.setItem(KEY, theme);
  } else {
    root.removeAttribute('data-theme');
    localStorage.removeItem(KEY);
  }
}

export function restoreGenderTheme() {
  const saved = localStorage.getItem(KEY);
  if (saved) document.documentElement.setAttribute('data-theme', saved);
}
