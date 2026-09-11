// Winzige Markdown-Teilmenge (themenneutral, DOM-frei) für die Fließtexte der
// Shows-Seite. Bewusst KEINE Bibliothek: Eine vollständige Markdown-Engine wäre
// eine Laufzeit-Abhängigkeit für vier Auszeichnungen, die ein Abendtext braucht.
//
// UNTERSTÜTZT, mehr nicht:
//   Leerzeile          → neuer Absatz
//   einfacher Umbruch  → <br>
//   **fett**           → <strong>
//   *kursiv*           → <em>
//   [Text](https://…)  → <a target="_blank">
//   Zeilen mit "- "    → <ul><li>
//
// ESCAPING ZUERST, Auszeichnung danach. Das ist die ganze Sicherheitsstrategie
// und der Grund, warum die Reihenfolge nicht umgedreht werden darf: Nach `esc()`
// gibt es im Text keine spitzen Klammern und keine Anführungszeichen mehr, also
// kann auch keine Ersetzung versehentlich Markup öffnen. Umgekehrt — erst
// auszeichnen, dann escapen — würde das eigene <strong> gleich mit escapen; und
// wer das „löst", indem er gar nicht escapt, hat ein HTML-Einfallstor gebaut.

import { esc } from './oberflaeche.js';

// Nur http(s). Ohne diese Prüfung nähme die Link-Syntax auch `javascript:` und
// `data:` entgegen — der Text kommt zwar aus dem eigenen Repo, aber eine
// Ausnahme, die man sich merken muss, ist keine.
const SICHERES_ZIEL = /^https?:\/\//i;

function inline(zeile) {
  return zeile
    // Links vor allem anderen: Sonst zerlegt die Kursiv-Regel eine URL mit
    // Sternchen darin, und der Link zeigt ins Leere.
    .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (ganz, text, ziel) =>
      (SICHERES_ZIEL.test(ziel)
        ? `<a href="${ziel}" target="_blank" rel="noopener noreferrer">${text}</a>`
        : ganz))
    // Fett VOR kursiv: `**` enthält `*`, die umgekehrte Reihenfolge risse das
    // doppelte Sternchen auseinander und ließe ein einzelnes stehen.
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
}

// Liefert fertiges HTML. Leerer/fehlender Text ergibt einen leeren String,
// damit die Ansicht wie bisher `text ? … : ''` schreiben kann.
export function markdownHtml(roh) {
  const text = String(roh ?? '').trim();
  if (!text) return '';
  return esc(text)
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((block) => {
      const zeilen = block.split('\n').filter((z) => z.trim());
      if (!zeilen.length) return '';
      // Ein Block ist eine Liste, wenn JEDE seiner Zeilen mit "- " beginnt —
      // nicht schon, wenn eine es tut. Sonst würde ein Gedankenstrich am
      // Zeilenanfang einen Absatz still in eine Aufzählung verwandeln.
      if (zeilen.every((z) => /^\s*-\s+/.test(z))) {
        const punkte = zeilen.map((z) => `<li>${inline(z.replace(/^\s*-\s+/, ''))}</li>`).join('');
        return `<ul>${punkte}</ul>`;
      }
      return `<p>${zeilen.map(inline).join('<br>')}</p>`;
    })
    .join('');
}
