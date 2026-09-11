// INFINITY — explicit scoreboard scrolling affordance.
(() => {
  'use strict';

  const style = document.createElement('style');
  style.textContent = `
    #scoreboardMenu #scoreList {
      max-height: min(48vh, 420px);
      overflow-y: scroll;
      overflow-x: hidden;
      scrollbar-width: auto;
      scrollbar-color: rgba(255,255,255,.58) rgba(255,255,255,.08);
      padding-right: 7px;
    }
    #scoreboardMenu #scoreList::-webkit-scrollbar { width: 9px; }
    #scoreboardMenu #scoreList::-webkit-scrollbar-track {
      background: rgba(255,255,255,.07);
      border-radius: 999px;
    }
    #scoreboardMenu #scoreList::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,.52);
      border-radius: 999px;
      border: 2px solid rgba(0,0,0,.16);
    }
    #scoreboardMenu #scoreList::-webkit-scrollbar-thumb:hover {
      background: rgba(255,255,255,.72);
    }
  `;
  document.head.appendChild(style);
})();
