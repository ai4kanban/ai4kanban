// Which language to offer, decided in <head> before first paint so the bar
// above the header never pushes the page down after load.
//
// The script marks `<html data-suggest="zh">` with the browser's first language
// unless the reader has chosen one before; globals.css shows the matching
// banner if the page drew one (`components/LocaleBanner.tsx`). A click on
// anything carrying `data-locale-choice` — the banner's link and ×, the footer's
// language menu, the phone menu's languages — stores that choice, and the bar is not offered again.

const KEY = "ai4kanban:locale";

export const LOCALE_SUGGEST_SCRIPT = `(function(){var h=document.documentElement;try{if(localStorage.getItem("${KEY}")===null){var l=((navigator.languages&&navigator.languages[0])||navigator.language||"").split("-")[0].toLowerCase();if(l)h.setAttribute("data-suggest",l)}}catch(e){}document.addEventListener("click",function(e){var a=e.target instanceof Element&&e.target.closest("[data-locale-choice]");if(!a)return;try{localStorage.setItem("${KEY}",a.getAttribute("data-locale-choice"))}catch(e){}h.removeAttribute("data-suggest")})})()`;
