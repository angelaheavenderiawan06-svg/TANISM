import fs from 'node:fs';

const store = fs.readFileSync('C:/Users/LENOVO/TaniSM/js/store.js', 'utf8');
for (const k of ['getProducts()', 'formatRupiah(', 'escapeHtml', 'closeAllModals', 'invalidateAllViews']) {
  console.log('store.js has', k, '->', store.includes(k));
}
const admin = fs.readFileSync('C:/Users/LENOVO/TaniSM/js/admin.js', 'utf8');
for (const k of ['closeAllModals', 'invalidateAllViews', 'TaniAuth.showToast']) {
  console.log('admin.js has', k, '->', admin.includes(k));
}
const adminHtml = fs.readFileSync('C:/Users/LENOVO/TaniSM/admin.html', 'utf8');
for (const k of ['modal-overlay', 'modal-box', 'modal-header', 'modal-title', 'modal-close', 'modal-footer', 'btn-modal-cancel']) {
  console.log('admin.html has', k, '->', adminHtml.includes(k));
}
