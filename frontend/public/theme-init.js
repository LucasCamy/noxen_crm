// Aplica o tema salvo antes da primeira pintura (evita o "flash" de tema errado).
// Arquivo externo porque a CSP do nginx não permite scripts inline.
try {
  var t = localStorage.getItem('noxen.theme')
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t)
} catch (e) {
  /* sem storage: segue o sistema */
}
