// Toda classe "fr-*" usada no HTML das telas precisa ter estilo no <style> do app. Pega tela nova que ficou sem
// CSS (aconteceu com o Perfil em 07/10/2026: estrutura certa, tela toda empilhada). Classes que só servem de gancho
// para o JavaScript ficam na lista abaixo, com o motivo.
const fs = require('fs');
const path = require('path');
const { ok } = require('../harness/carregar.js');
const SO_GANCHO = {
  'fr-histmenu': 'botão de três pontos do histórico de musculação (o estilo vem de .ds-mini)',
  'fr-semplano': 'cartão "sem plano" usa .mrt-card; o título tem .fr-semplano-tit',
};
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'treino-app.html'), 'utf8');
const css = (html.match(/<style[\s\S]*?<\/style>/g) || []).join('\n');
const usadas = new Set();
for (const m of html.matchAll(/class="([^"]*)"/g)) m[1].split(/\s+/).forEach(c => { if (/^fr-[\w-]+$/.test(c)) usadas.add(c); });
const semEstilo = [...usadas].filter(c => !SO_GANCHO[c] && !new RegExp('\\.' + c.replace(/-/g, '\\-') + '(?![\\w-])').test(css)).sort();
ok(semEstilo.length === 0, 'toda classe fr-* das telas tem estilo' + (semEstilo.length ? ' (sem estilo: ' + semEstilo.join(', ') + ')' : ` (${usadas.size} classes)`));
