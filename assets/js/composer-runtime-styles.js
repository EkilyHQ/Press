export function injectComposerRuntimeStyles(options = {}) {
  const documentRef = options.documentRef || (typeof document !== 'undefined' ? document : null);
  if (!documentRef || !documentRef.head || typeof documentRef.createElement !== 'function') return null;
  if (documentRef.getElementById && documentRef.getElementById('composer-runtime-styles')) {
    return documentRef.getElementById('composer-runtime-styles');
  }
  const css = `
  .ci-item,.ct-item{border:1px solid var(--border);border-radius:8px;background:var(--card);margin:.5rem 0;position:relative;filter:none;--ci-hover-tint:var(--primary);--ci-ring-shadow:0 0 0 0 transparent;--ci-depth-shadow:0 1px 2px rgba(15,23,42,0.05);box-shadow:var(--ci-ring-shadow),var(--ci-depth-shadow);}
  .ci-head,.ct-head{display:flex;align-items:center;gap:.5rem;padding:.5rem .6rem;border-bottom:1px solid var(--border);}
  .ci-head,.ct-head{border-bottom:none;}
  .ci-item.is-open .ci-head,.ct-item.is-open .ct-head{border-bottom:1px solid var(--border);}
  .ci-key,.ct-key{transition:color .18s ease;}
  .ci-body,.ct-body{display:none;padding:.5rem .6rem;}
  .ci-body-inner,.ct-body-inner{overflow:visible;}
  .ci-grip,.ct-grip{cursor:grab;user-select:none;opacity:.7}
  .ci-actions,.ct-actions{margin-left:auto;display:inline-flex;gap:.35rem}
  .ci-head-add-lang-slot{display:inline-flex;align-items:center}
  .ci-meta,.ct-meta{color:var(--muted);font-size:.85rem}
  .ci-lang,.ct-lang{border:1px dashed var(--border);border-radius:8px;margin:.4rem 0;background:color-mix(in srgb, var(--text) 3%, transparent);}
  .ci-lang{border:0;border-radius:0;margin:0;background:transparent;padding:.65rem 0;}
  .ci-lang+.ci-lang{border-top:1px solid color-mix(in srgb, var(--border) 82%, transparent);}
  .ct-lang{padding:.0625rem;}
  .ci-lang-head{display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem}
  .ci-lang-label{display:inline-flex;align-items:center;gap:.35rem;line-height:1.1;}
  .ci-lang-label .ci-lang-flag{display:inline-grid;place-items:center;width:1.2em;height:1.2em;font-size:1rem;line-height:1;}
  .ci-lang-label .ci-lang-code{display:inline-flex;align-items:center;line-height:1.2;font-size:1rem;font-weight:700;letter-spacing:.035em;}
  .ci-lang-actions{margin-left:auto;display:inline-flex;gap:.35rem}
  .ct-lang{display:flex;align-items:stretch;gap:0;overflow:hidden;}
  .ct-lang-label{display:flex;align-items:center;justify-content:center;gap:.3rem;padding:.35rem .6rem;background:color-mix(in srgb, var(--text) 14%, var(--card));color:var(--text);min-width:78px;white-space:nowrap;font-weight:700;border-radius:6px 0 0 6px;}
  .ct-lang-label .ct-lang-flag{font-size:1.25rem;line-height:1;transform:translateY(-1px);}
  .ct-lang-label .ct-lang-code{font-size:.9rem;font-weight:700;letter-spacing:.045em;}
  .ci-item[data-child-draft="dirty"] .ci-key,.ct-item[data-child-draft="dirty"] .ct-key{color:#f97316;}
  .ci-item[data-child-draft="conflict"] .ci-key,.ct-item[data-child-draft="conflict"] .ct-key{color:#ef4444;}
  .ct-draft-indicator,.ci-draft-indicator{display:inline-flex;width:.55rem;height:.55rem;border-radius:999px;background:color-mix(in srgb,var(--muted) 48%, transparent);box-shadow:0 0 0 3px color-mix(in srgb,var(--muted) 14%, transparent);flex:0 0 auto;opacity:0;transform:scale(.6);transition:opacity .18s ease, transform .18s ease, background-color .18s ease, box-shadow .18s ease;}
  .ct-draft-indicator[hidden],.ci-draft-indicator[hidden]{display:none;}
  .ct-lang[data-draft-state] .ct-draft-indicator,.ci-ver-item[data-draft-state] .ci-draft-indicator{opacity:1;transform:scale(.95);}
  .ct-lang[data-draft-state="dirty"] .ct-draft-indicator,.ci-ver-item[data-draft-state="dirty"] .ci-draft-indicator{background:#f97316;box-shadow:0 0 0 3px color-mix(in srgb,#f97316 22%, transparent);}
  .ct-lang[data-draft-state="saved"] .ct-draft-indicator,.ci-ver-item[data-draft-state="saved"] .ci-draft-indicator{background:#22c55e;box-shadow:0 0 0 3px color-mix(in srgb,#22c55e 20%, transparent);}
  .ct-lang[data-draft-state="conflict"] .ct-draft-indicator,.ci-ver-item[data-draft-state="conflict"] .ci-draft-indicator{background:#ef4444;box-shadow:0 0 0 3px color-mix(in srgb,#ef4444 25%, transparent);}
  .ct-lang-main{flex:1 1 auto;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;gap:.5rem;align-items:center;padding:.35rem .6rem .35rem .75rem;}
  .ct-field{display:flex;align-items:center;gap:.4rem;font-weight:600;color:color-mix(in srgb, var(--text) 65%, transparent);white-space:nowrap;}
  .ct-field input{flex:1 1 auto;min-width:0;height:2rem;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--text);padding:.25rem .4rem;}
  .ct-lang-actions{display:flex;gap:.35rem;justify-content:flex-end;}
  .ct-lang-actions .btn-secondary{white-space:nowrap;}
  @media (max-width:720px){
    .ct-lang{flex-direction:column;gap:.4rem;}
    .ct-lang-label{justify-content:flex-start;border-radius:6px;}
    .ct-lang-main{grid-template-columns:1fr;padding:.25rem 0 0;}
    .ct-field{white-space:normal;}
    .ct-lang-actions{justify-content:flex-start;}
  }
  .ci-ver-item{display:flex;align-items:center;gap:.55rem;margin:.3rem 0;padding:.4rem .5rem;border:1px solid color-mix(in srgb,var(--border) 88%, transparent);border-radius:8px;background:color-mix(in srgb,var(--text) 2%, transparent)}
  .ci-ver-label{flex:1 1 auto;min-width:0;font-weight:600;color:var(--text)}
  .ci-ver-actions button:disabled{opacity:.5;cursor:not-allowed}
  /* Add Language row: compact button, keep menu aligned to trigger width */
  .ci-add-lang,.ct-add-lang,.cs-add-lang{display:inline-flex;align-items:center;gap:.5rem;margin-top:.5rem;position:relative;flex:0 0 auto}
  .ci-actions .ci-add-lang{margin-top:0}
  .ci-actions .ci-add-lang .btn-secondary{border-bottom:1px solid var(--border)!important}
  .ci-add-lang .btn-secondary,.ct-add-lang .btn-secondary{justify-content:center;border-bottom:0 !important}
  .ci-add-lang input,.ct-add-lang input{height:2rem;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--text);padding:.25rem .4rem}
  .ci-add-lang select,.ct-add-lang select{height:2rem;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--text);padding:.25rem .4rem}
  .has-menu{overflow:visible}
  .has-menu.is-open{z-index:100}
  /* Button when open looks attached to menu */
  .ci-add-lang .btn-secondary.is-open,.ct-add-lang .btn-secondary.is-open{border-bottom-left-radius:0;border-bottom-right-radius:0;background:color-mix(in srgb, var(--text) 5%, var(--card));border-color:color-mix(in srgb, var(--primary) 45%, var(--border));border-bottom:0 !important}
  /* Custom menu popup */
  .press-menu{position:absolute;top:calc(100% - 1px);left:0;right:auto;z-index:101;border:1px solid var(--border);background:var(--card);box-shadow:var(--shadow);width:max-content;min-width:100%;max-width:min(320px,calc(100vw - 3rem));border-top:none;border-bottom-left-radius:8px;border-bottom-right-radius:8px;border-top-left-radius:0;border-top-right-radius:0;transform-origin: top left;}
  .has-menu.is-open > .press-menu{animation: press-menu-in 160ms ease-out both}
  @keyframes press-menu-in{from{opacity:0; transform: translateY(-4px) scale(0.98);} to{opacity:1; transform: translateY(0) scale(1);} }
  /* Closing animation */
  .press-menu.is-closing{animation: press-menu-out 130ms ease-in both !important}
  @keyframes press-menu-out{from{opacity:1; transform: translateY(0) scale(1);} to{opacity:0; transform: translateY(-4px) scale(0.98);} }
  .press-menu .press-menu-item{display:block;width:100%;text-align:left;background:transparent;color:var(--text);border:0 !important;border-bottom:0 !important;padding:.4rem .6rem;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  /* Only draw a single divider: use top border on following items */
  .press-menu .press-menu-item + .press-menu-item{border-top:1px solid color-mix(in srgb, var(--text) 16%, var(--border))}
  .press-menu .press-menu-item:hover{background:color-mix(in srgb, var(--text) 6%, var(--card))}
  /* Make selects look like secondary buttons */
  .btn-like-select{appearance:none;-webkit-appearance:none;cursor:pointer;padding:.45rem .8rem;height:2.25rem;line-height:1}
  .btn-like-select:focus-visible{outline:2px solid color-mix(in srgb, var(--primary) 45%, transparent); outline-offset:2px}
  .dragging{opacity:.96}
  .drag-placeholder{border:1px dashed var(--border);border-radius:8px;background:transparent}
  .is-dragging-list{touch-action:none}
  body.press-noselect{user-select:none;cursor:grabbing}
  /* Simple badges for verify modal */
  .badge{display:inline-flex;align-items:center;gap:.25rem;border:1px solid var(--border);background:var(--card);color:var(--muted);font-size:.72rem;padding:.05rem .4rem;border-radius:999px}
  .badge-ver{ color: var(--primary); border-color: color-mix(in srgb, var(--primary) 40%, var(--border)); }
  .badge-lang{}
  .ci-item.is-dirty{border-color:color-mix(in srgb,#f97316 42%, var(--border));--ci-ring-shadow:0 0 0 2px color-mix(in srgb,#f97316 18%, transparent);--ci-depth-shadow:0 10px 20px color-mix(in srgb,#f97316 16%, transparent);--ci-hover-tint:#f97316;}
  .ci-item[data-diff="added"]{border-color:color-mix(in srgb,#16a34a 60%, var(--border));--ci-hover-tint:#16a34a;}
  .ci-item[data-diff="removed"]{border-color:color-mix(in srgb,#dc2626 60%, var(--border));--ci-hover-tint:#dc2626;}
  .ci-item[data-diff="modified"],.ci-item[data-diff="changed"]{--ci-hover-tint:#f59e0b;}
  .ci-diff{display:inline-flex;gap:.25rem;align-items:center;font-size:.78rem;color:color-mix(in srgb,var(--text) 68%, transparent);}
  .ci-diff-badge{display:inline-flex;align-items:center;gap:.2rem;border:1px solid color-mix(in srgb,var(--border) 70%, transparent);border-radius:999px;padding:.05rem .35rem;line-height:1;background:color-mix(in srgb,var(--text) 4%, transparent);font-size:.72rem;font-weight:600;text-transform:uppercase;color:color-mix(in srgb,var(--text) 80%, transparent);}
  .ci-diff-badge.ci-diff-badge-added{border-color:color-mix(in srgb,#16a34a 45%, var(--border));color:#166534;background:color-mix(in srgb,#16a34a 12%, transparent);}
  .ci-diff-badge.ci-diff-badge-removed{border-color:color-mix(in srgb,#dc2626 45%, var(--border));color:#b91c1c;background:color-mix(in srgb,#dc2626 12%, transparent);}
  .ci-diff-badge.ci-diff-badge-changed{border-color:color-mix(in srgb,#f59e0b 45%, var(--border));color:#b45309;background:color-mix(in srgb,#f59e0b 12%, transparent);}
  .ci-lang[data-diff="added"]{border-color:color-mix(in srgb,#16a34a 55%, var(--border));background:color-mix(in srgb,#16a34a 10%, var(--card));}
  .ci-lang[data-diff="removed"]{border-color:color-mix(in srgb,#dc2626 55%, var(--border));background:color-mix(in srgb,#dc2626 8%, var(--card));opacity:.9;}
  .ci-lang[data-diff="modified"]{border-color:color-mix(in srgb,#f59e0b 45%, var(--border));}
  .ci-ver-item[data-diff="added"]{border-color:color-mix(in srgb,#16a34a 60%, var(--border));background:color-mix(in srgb,#16a34a 8%, transparent);}
  .ci-ver-item[data-diff="changed"]{border-color:color-mix(in srgb,#f59e0b 60%, var(--border));background:color-mix(in srgb,#f59e0b 6%, transparent);}
  .ci-ver-item[data-diff="moved"]{border-color:color-mix(in srgb,#2563eb 55%, var(--border));border-style:dashed;}
  .ci-ver-removed{margin-top:.2rem;font-size:.78rem;color:#b91c1c;}
  .ct-item.is-dirty{border-color:color-mix(in srgb,#2563eb 42%, var(--border));--ci-ring-shadow:0 0 0 2px color-mix(in srgb,#2563eb 16%, transparent);--ci-depth-shadow:0 10px 20px color-mix(in srgb,#2563eb 14%, transparent);}
  .ct-item[data-diff="added"]{border-color:color-mix(in srgb,#16a34a 55%, var(--border));}
  .ct-item[data-diff="removed"]{border-color:color-mix(in srgb,#dc2626 55%, var(--border));}
  .ct-diff{display:inline-flex;gap:.25rem;align-items:center;font-size:.78rem;color:color-mix(in srgb,var(--text) 68%, transparent);}
  .ct-diff-badge{display:inline-flex;align-items:center;gap:.2rem;border:1px solid color-mix(in srgb,var(--border) 70%, transparent);border-radius:999px;padding:.05rem .35rem;line-height:1;background:color-mix(in srgb,var(--text) 4%, transparent);font-size:.72rem;font-weight:600;text-transform:uppercase;color:color-mix(in srgb,var(--text) 80%, transparent);}
  .ct-diff-badge.ct-diff-badge-added{border-color:color-mix(in srgb,#16a34a 45%, var(--border));color:#166534;background:color-mix(in srgb,#16a34a 12%, transparent);}
  .ct-diff-badge.ct-diff-badge-removed{border-color:color-mix(in srgb,#dc2626 45%, var(--border));color:#b91c1c;background:color-mix(in srgb,#dc2626 12%, transparent);}
  .ct-diff-badge.ct-diff-badge-changed{border-color:color-mix(in srgb,#2563eb 45%, var(--border));color:#1d4ed8;background:color-mix(in srgb,#2563eb 10%, transparent);}
  .ct-lang[data-diff="added"]{border-color:color-mix(in srgb,#16a34a 55%, var(--border));background:color-mix(in srgb,#16a34a 8%, var(--card));}
  .ct-lang[data-diff="removed"]{border-color:color-mix(in srgb,#dc2626 55%, var(--border));background:color-mix(in srgb,#dc2626 6%, var(--card));opacity:.9;}
  .ct-lang[data-diff="modified"]{border-color:color-mix(in srgb,#2563eb 45%, var(--border));}
  .ct-field input[data-diff="changed"]{border-color:color-mix(in srgb,#2563eb 60%, var(--border));background:color-mix(in srgb,#2563eb 6%, transparent);}
  /* Caret arrow for Details buttons */
  .ci-expand .caret,.ct-expand .caret{display:inline-block;width:0;height:0;border-style:solid;border-width:5px 0 5px 7px;border-color:transparent transparent transparent currentColor;margin-right:.35rem;transform:rotate(0deg);transform-origin:50% 50%;transition:transform 480ms cubic-bezier(.45,0,.25,1)}
  .ci-expand[aria-expanded="true"] .caret,.ct-expand[aria-expanded="true"] .caret{transform:rotate(90deg)}
  @media (prefers-reduced-motion: reduce){
    .ci-expand .caret,.ct-expand .caret{transition:none}
  }
  /* Composer Guide */
  .comp-guide{border:1px dashed var(--border);border-radius:8px;background:color-mix(in srgb, var(--text) 3%, transparent);padding:.6rem .6rem .2rem;margin:.6rem 0 .8rem}
  .comp-guide-head{display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem}
  .comp-guide-head .muted{color:var(--muted);font-size:.88rem}
  /* Titlebar-like header inside modal */
  .press-modal-dialog .comp-guide-head{
    display:flex;align-items:center;justify-content:space-between;gap:.6rem;
    background: color-mix(in srgb, var(--text) 6%, var(--card));
    border-bottom: 1px solid color-mix(in srgb, var(--text) 12%, var(--border));
    /* Pull to dialog edges to resemble an app title bar */
    /* Remove top gap by not offsetting beyond dialog top */
    margin: 0 -.85rem .9rem;
    padding: .65rem .85rem;
    border-top-left-radius: 12px; border-top-right-radius: 12px;
    position: sticky; top: 0; z-index: 2;
  }
  .press-modal-dialog .comp-head-left{display:flex;align-items:baseline;gap:.6rem;min-width:0}
  .press-modal-dialog .comp-guide-head strong{font-weight:700}
  .press-modal-dialog .comp-guide-head .muted{opacity:.9}
  .comp-form{display:grid;grid-template-columns:1fr 1fr;gap:.5rem;align-items:end;margin-bottom:.5rem}
  .comp-form label{display:flex;flex-direction:column;gap:.25rem;font-weight:600}
  .comp-form label{position:relative}
  .comp-form input[type=text]{height:2rem;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--text);padding:.25rem .4rem}
  .comp-langs{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}
  .comp-langs .lab{font-weight:600; margin-right:.25rem}
  .comp-langs label{display:inline-flex;align-items:center;gap:.35rem;border:1px solid var(--border);border-radius:999px;padding:.18rem .5rem;background:var(--card);color:var(--text);cursor:pointer;user-select:none}
  .comp-langs label:hover{background:color-mix(in srgb, var(--text) 5%, transparent)}
  .comp-langs label input{display:none}
  .comp-langs label:has(input:checked){background:color-mix(in srgb, var(--primary) 16%, var(--card));border-color:color-mix(in srgb, var(--primary) 45%, var(--border))}
  .comp-langs label span{font-weight:400;font-size:.85rem}
  /* Disabled states for form + language chips */
  .comp-form input[disabled]{opacity:.6;cursor:not-allowed;background:color-mix(in srgb, var(--text) 4%, var(--card))}
  .comp-langs label:has(input[disabled]){opacity:.5;cursor:not-allowed;pointer-events:none}
  .comp-langs label:has(input[disabled]):hover{background:var(--card)}
  /* Floating bubble over inputs */
  .comp-bubble{position:absolute;bottom:calc(100% + 6px);left:0;z-index:3;padding:.28rem .5rem;border-radius:6px;border:1px solid #fecaca;background:#fee2e2;color:#7f1d1d;font-size:.88rem;line-height:1.2;box-shadow:0 1px 2px rgba(0,0,0,.05);max-width:min(72vw,560px);pointer-events:none}
  .comp-bubble::after{content:'';position:absolute;top:100%;left:14px;border-width:6px;border-style:solid;border-color:#fee2e2 transparent transparent transparent}
  /* Floating variant appended to modal to avoid clipping */
  .comp-bubble.is-floating{position:fixed;z-index:100000;bottom:auto;left:auto}
  .comp-actions{display:flex;gap:.5rem;}
  .comp-steps{margin-top:.25rem}
  /* Divider between form and steps */
  .comp-divider{height:1px;background:var(--border);opacity:.8;margin:1.5rem 0}
  .comp-step{display:grid;grid-template-columns:1.6rem 1fr;column-gap:.6rem;align-items:start;margin:.4rem 0;padding:.4rem;border:1px solid var(--border);border-radius:8px;background:var(--card)}
  .comp-step > .num{grid-column:1}
  .comp-step > .body{grid-column:2}
  .comp-step > .comp-warn{grid-column:1 / -1}
  .comp-step > .comp-ok{grid-column:1 / -1}
  .comp-step .num{flex:0 0 auto;width:1.6rem;height:1.6rem;border-radius:999px;background:color-mix(in srgb, var(--primary) 14%, var(--card));border:1px solid color-mix(in srgb, var(--primary) 36%, var(--border));display:grid;place-items:center;font-weight:700;color:var(--text)}
  .comp-step .title{font-weight:700;margin-bottom:.15rem}
  .comp-step .desc{color:var(--muted);font-size:.92rem;margin:.1rem 0}
  .comp-step .actions{display:flex;gap:.4rem;margin-top:.25rem}
  .comp-step code{font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Ubuntu Mono', monospace; background: color-mix(in srgb, var(--text) 10%, transparent); padding: .08rem .35rem; border-radius: 6px; font-size: .9em;}
  /* Footer hint next to Verify */
  .comp-footer .comp-hint{color:var(--muted);font-size:.9rem;align-self:center}
  /* Validation status */
  .comp-step.ok{border-color: color-mix(in srgb, #16a34a 60%, var(--border));}
  .comp-step.err{border-color: color-mix(in srgb, #dc2626 60%, var(--border));}
  .comp-status{margin-top:.2rem;font-size:.9rem;color:var(--muted)}
  .comp-status[data-state="ok"]{color:#16a34a}
  /* Warning area at card bottom */
  .comp-warn{margin:.5rem -.4rem -.4rem -.4rem; padding:.45rem .6rem; border-top:1px solid #fecaca; background:#fee2e2; border-bottom-left-radius:8px; border-bottom-right-radius:8px; color:#7f1d1d}
  .comp-warn .comp-warn-text{font-size:.92rem; line-height:1.35}
  /* Success note at card bottom */
  .comp-ok{margin:.5rem -.4rem -.4rem -.4rem; padding:.45rem .6rem; border-top:1px solid #bbf7d0; background:#dcfce7; border-bottom-left-radius:8px; border-bottom-right-radius:8px; color:#065f46}
  .comp-ok .comp-ok-text{font-size:.92rem; line-height:1.35}
  .btn-compact{height:1.9rem;padding:.2rem .55rem;font-size:.9rem}
  /* Unify button styles inside modal (anchors and buttons) */
  .press-modal-dialog .btn-secondary,
  .press-modal-dialog a.btn-secondary,
  .press-modal-dialog button.btn-secondary {
    display:inline-flex; align-items:center; justify-content:center; gap:.35rem;
    height:2.25rem; padding:.45rem .8rem; border-radius:8px; font-size:.93rem; line-height:1;
    text-decoration:none; border:1px solid var(--border); background:var(--card); color:var(--text);
  }
  .press-modal-dialog a.btn-secondary:visited { color: var(--text); }
  .press-modal-dialog .btn-secondary:hover { background: color-mix(in srgb, var(--text) 5%, var(--card)); }
  /* GitHub green button variant (overrides theme packs) */
  .press-modal-dialog .btn-github,
  .press-modal-dialog a.btn-github,
  .press-modal-dialog button.btn-github {
    background:#428646 !important; color:#ffffff !important; border:1px solid #3d7741 !important; border-radius:8px !important;
  }
  .press-modal-dialog a.btn-github:visited { color:#ffffff !important; }
  .press-modal-dialog .btn-github:hover { background:#3d7741 !important; }
  .press-modal-dialog .btn-github:active { background:#298e46 !important; }
  .press-modal-dialog .btn-secondary[disabled],
  .press-modal-dialog button.btn-secondary[disabled]{opacity:.5;cursor:not-allowed;pointer-events:none;filter:grayscale(25%)}
  .press-modal-dialog .btn-primary,
  .press-modal-dialog a.btn-primary,
  .press-modal-dialog button.btn-primary {
    display:inline-flex; align-items:center; justify-content:center; gap:.35rem;
    height:2.25rem; padding:.45rem .8rem; border-radius:8px; font-size:.93rem; line-height:1;
    text-decoration:none;
  }
  .press-modal-dialog .btn-primary[disabled],
  .press-modal-dialog button.btn-primary[disabled]{opacity:.6;cursor:not-allowed;pointer-events:none;filter:grayscale(25%)}
  .press-modal-dialog a.btn-primary:visited { color: white; }

  /* Simple modal for the Composer wizard */
  .press-modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,0.45);backdrop-filter:blur(3px);z-index:9999;padding:1rem}
  .press-modal.is-open{display:flex}
  /* Nudge modal upward on short viewports */
  @media (max-height: 820px){
    .press-modal{align-items:flex-start;padding-top:calc(max(12px, env(safe-area-inset-top)) + 24px)}
  }
  /* Remove top padding so sticky header can sit flush */
  .press-modal-dialog{position:relative;background:var(--card);color:var(--text);border:1px solid color-mix(in srgb, var(--primary) 28%, var(--border));border-radius:12px;box-shadow:0 14px 36px rgba(0,0,0,0.18),0 6px 18px rgba(0,0,0,0.12),0 1px 2px rgba(0,0,0,0.06);width:min(92vw, 760px);max-height:min(90vh, 720px);overflow:auto;padding:0 .85rem .85rem}
  .press-modal-close{position:absolute;top:.5rem;right:.6rem;z-index:3}
  /* When close button is inside the header, make it part of the flow */
  .press-modal-dialog .comp-guide-head .press-modal-close{position:static;top:auto;right:auto;margin-left:auto}
  body.press-modal-open{overflow:hidden}
  .press-modal-dialog .comp-guide{border:none;background:transparent;padding:0;margin:0}

  .composer-diff-tabs{display:flex;flex-wrap:wrap;gap:.35rem;margin:0 -.85rem;padding:0 .85rem .6rem;border-bottom:1px solid color-mix(in srgb,var(--text) 14%, var(--border));background:transparent}
  .composer-diff-tab{position:relative;border:0;background:none;padding:.48rem .92rem;border-radius:999px;font-weight:600;font-size:.93rem;color:color-mix(in srgb,var(--text) 68%, transparent);cursor:pointer;transition:color 160ms ease, background-color 160ms ease, transform 160ms ease}
  .composer-diff-tab.is-active{background:color-mix(in srgb,var(--primary) 18%, transparent);color:color-mix(in srgb,var(--primary) 92%, var(--text));box-shadow:0 6px 16px rgba(37,99,235,0.18)}
  .composer-diff-tab.is-active::after{content:'';position:absolute;left:50%;bottom:-6px;transform:translateX(-50%);width:36%;min-width:24px;height:3px;border-radius:999px;background:color-mix(in srgb,var(--primary) 80%, var(--text));}
  .composer-diff-tab:hover{color:color-mix(in srgb,var(--primary) 94%, var(--text));background:color-mix(in srgb,var(--primary) 12%, transparent)}
  .composer-diff-tab:focus-visible{outline:2px solid color-mix(in srgb,var(--primary) 55%, transparent);outline-offset:2px}
  .composer-diff-views{padding:.85rem .15rem .35rem}
  .composer-diff-view{display:block}
  .composer-diff-empty{margin:.65rem 0;font-size:.95rem;color:var(--muted)}
  .composer-diff-actions{display:flex;justify-content:flex-end;gap:.6rem;padding:.75rem .85rem .85rem;margin:0;border-top:1px solid color-mix(in srgb,var(--text) 12%, var(--border));background:color-mix(in srgb,var(--text) 2%, var(--card))}
  .composer-diff-actions .btn-secondary{min-width:140px;font-weight:600}
  .composer-diff-overview-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.65rem;margin-bottom:1rem}
  .composer-diff-stat{border:1px solid color-mix(in srgb,var(--text) 14%, var(--border));border-radius:12px;padding:.65rem .75rem;background:color-mix(in srgb,var(--text) 4%, var(--card));display:flex;flex-direction:column;gap:.12rem;min-height:74px}
  .composer-diff-stat-value{font-size:1.6rem;font-weight:700;color:color-mix(in srgb,var(--text) 88%, transparent)}
  .composer-diff-stat[data-id="order"] .composer-diff-stat-value{font-size:1.08rem}
  .composer-diff-stat-label{font-size:.85rem;color:color-mix(in srgb,var(--text) 60%, transparent)}
  .composer-diff-overview-blocks{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.85rem;margin:.6rem 0 1rem}
  .composer-diff-overview-block{border:1px solid var(--border);border-radius:10px;padding:.65rem .75rem;background:color-mix(in srgb,var(--text) 3%, var(--card))}
  .composer-diff-overview-block h3{margin:0 0 .45rem;font-size:.92rem;color:color-mix(in srgb,var(--text) 80%, transparent)}
  .composer-diff-key-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:.28rem}
  .composer-diff-key-list code{font-family:var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace);font-size:.86rem;color:color-mix(in srgb,var(--text) 82%, transparent)}
  .composer-diff-key-more{font-size:.86rem;color:var(--muted)}
  .composer-diff-overview-langs{margin:.4rem 0 0;font-size:.9rem;color:color-mix(in srgb,var(--text) 62%, transparent)}
  .composer-diff-section{margin-bottom:1.05rem}
  .composer-diff-section h3{margin:0 0 .5rem;font-size:.98rem}
  .composer-diff-entry-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:.55rem}
  .composer-diff-entry{border:1px solid color-mix(in srgb,var(--text) 14%, var(--border));border-radius:10px;padding:.55rem .75rem;background:color-mix(in srgb,var(--text) 3%, var(--card));display:flex;flex-direction:column;gap:.35rem}
  .composer-diff-entry-key{font-family:var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace);font-weight:600;font-size:.95rem;color:var(--text)}
  .composer-diff-entry-badges{display:flex;flex-wrap:wrap;gap:.3rem;font-size:.8rem}
  .composer-diff-field-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:.2rem;font-size:.88rem;color:color-mix(in srgb,var(--text) 70%, transparent)}
  .composer-diff-field-list li{display:flex;align-items:flex-start;gap:.35rem}
  .composer-diff-field-list li::before{content:'•';color:color-mix(in srgb,var(--primary) 62%, var(--text));line-height:1.1}
  @media (max-width:640px){
    .composer-diff-tabs{margin:0 0 .6rem;padding:0 0 .6rem}
    .composer-diff-overview-stats{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
    .composer-diff-overview-blocks{grid-template-columns:1fr}
  }
  .composer-order-dialog{width:min(96vw, 880px);max-height:min(90vh, 720px);padding-bottom:1rem}
  .composer-order-head{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem;margin:0 -.85rem .85rem;background:color-mix(in srgb,var(--text) 5%, var(--card));border-bottom:1px solid color-mix(in srgb,var(--text) 14%, var(--border));padding:.75rem .85rem;position:sticky;top:0;z-index:3}
  .composer-order-head h2{margin:0;font-size:1.15rem;font-weight:700;flex:1 1 auto}
  .composer-order-subtitle{margin:0;font-size:.9rem;color:var(--muted);flex-basis:100%;order:3}
  .composer-order-close{margin-left:auto}
  .composer-order-stats{display:flex;flex-wrap:wrap;gap:.4rem;margin:0 0 .85rem;font-size:.85rem;color:var(--muted)}
  .composer-order-chip{display:inline-flex;align-items:center;gap:.3rem;border-radius:999px;padding:.18rem .55rem;border:1px solid color-mix(in srgb,var(--text) 16%, var(--border));background:color-mix(in srgb,var(--text) 4%, var(--card));font-weight:600;color:color-mix(in srgb,var(--text) 70%, transparent)}
  .composer-order-chip[data-status="moved"]{border-color:color-mix(in srgb,#2563eb 55%, var(--border));background:color-mix(in srgb,#2563eb 14%, transparent);color:#1d4ed8}
  .composer-order-chip[data-status="added"]{border-color:color-mix(in srgb,#16a34a 55%, var(--border));background:color-mix(in srgb,#16a34a 12%, transparent);color:#166534}
  .composer-order-chip[data-status="removed"]{border-color:color-mix(in srgb,#dc2626 55%, var(--border));background:color-mix(in srgb,#dc2626 12%, transparent);color:#b91c1c}
  .composer-order-chip[data-status="neutral"]{border-style:dashed}
  .composer-order-body{padding:0 0 0}
  .composer-order-visual{position:relative;padding:.4rem 3.4rem 1.9rem}
  .composer-order-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(3.2rem, 8vw, 6.8rem);position:relative;z-index:1}
  .composer-order-column-title{text-transform:uppercase;letter-spacing:.08em;font-weight:700;font-size:.8rem;color:color-mix(in srgb,var(--text) 60%, transparent);margin-bottom:.4rem}
  .composer-order-list{display:flex;flex-direction:column;gap:.45rem;min-height:1.5rem}
  .composer-order-item{display:flex;align-items:center;gap:.55rem;padding:.38rem .6rem;border:1px solid var(--border);border-radius:8px;background:color-mix(in srgb,var(--text) 3%, var(--card));position:relative;box-shadow:0 1px 2px rgba(15,23,42,0.05)}
  .composer-order-item[data-status="moved"]{border-color:color-mix(in srgb,#2563eb 55%, var(--border));background:color-mix(in srgb,#2563eb 11%, transparent)}
  .composer-order-item[data-status="added"]{border-color:color-mix(in srgb,#16a34a 55%, var(--border));background:color-mix(in srgb,#16a34a 10%, transparent)}
  .composer-order-item[data-status="removed"]{border-color:color-mix(in srgb,#dc2626 55%, var(--border));background:color-mix(in srgb,#dc2626 10%, transparent)}
  .composer-order-index{font-weight:700;font-size:.84rem;color:color-mix(in srgb,var(--text) 70%, transparent);min-width:2.3rem}
  .composer-order-key{flex:1 1 auto;min-width:0;font-family:var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace);font-size:.9rem;color:var(--text);word-break:break-word}
  .composer-order-badge{margin-left:auto;font-size:.78rem;color:color-mix(in srgb,var(--text) 62%, transparent);font-weight:600}
  .composer-order-badge.is-hidden{display:none}
  .composer-order-lines{position:absolute;inset:0;pointer-events:none;overflow:visible;z-index:0;opacity:0;transition:opacity .18s ease}
  .composer-order-lines.is-hovering{opacity:1}
  .composer-order-path{fill:none;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;opacity:0;transition:opacity .18s ease}
  .composer-order-path.is-active{opacity:.78}
  .composer-order-path[data-status="same"]{stroke:#94a3b8;stroke-dasharray:6 6}
  .composer-order-path[data-status="same"].is-active{opacity:.35}
  .composer-order-item.is-hovered{box-shadow:0 0 0 2px color-mix(in srgb,var(--primary) 18%, transparent)}
  .composer-order-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;font-size:.95rem;color:var(--muted);pointer-events:none;padding:1rem}
  .composer-order-visual.is-empty .composer-order-lines{display:none}
  .composer-order-visual.is-empty .composer-order-columns{opacity:.15}
  @media (max-width:860px){
    .composer-order-columns{grid-template-columns:1fr;gap:1.8rem}
    .composer-order-lines{display:none}
    .composer-order-visual{padding:.4rem 1.2rem 1.4rem}
    .composer-order-item{padding:.32rem .55rem}
  }

  .btn-tertiary{appearance:none;border:1px solid transparent;background:transparent;color:color-mix(in srgb,var(--primary) 92%, var(--text));font-weight:600;font-size:.9rem;padding:.3rem .6rem;border-radius:8px;cursor:pointer;transition:color .16s ease, background-color .16s ease, border-color .16s ease}
  .btn-tertiary:hover{background:color-mix(in srgb,var(--primary) 12%, transparent);border-color:color-mix(in srgb,var(--primary) 48%, transparent);color:color-mix(in srgb,var(--primary) 98%, var(--text))}
  .btn-tertiary:focus-visible{outline:2px solid color-mix(in srgb,var(--primary) 55%, transparent);outline-offset:2px}
  .btn-tertiary[disabled]{opacity:.45;cursor:not-allowed;pointer-events:none}

  .composer-site-host{padding:.35rem 0 1.2rem}
  .composer-site-main{width:100%;max-width:none;margin:0;padding:0}
  #composerSite{width:100%}
  .cs-root{display:flex;flex-direction:column;gap:1.1rem;padding:.2rem 0 1.1rem}
  .cs-layout{display:grid;grid-template-columns:minmax(0,1fr);gap:1rem;align-items:start}
  .cs-viewport{min-width:0;display:flex;flex-direction:column;gap:1rem}
  .cs-section{border:1px solid color-mix(in srgb,var(--border) 96%, transparent);border-radius:12px;background:var(--card);box-shadow:0 6px 18px rgba(15,23,42,0.08);padding:.9rem 1rem;display:flex;flex-direction:column;gap:.6rem}
  .cs-section-head{display:flex;align-items:baseline;gap:.65rem;flex-wrap:wrap}
  .cs-section-title{margin:0;font-size:1rem;font-weight:700;color:color-mix(in srgb,var(--text) 90%, transparent)}
  .cs-section-description{margin:0;font-size:.82rem;color:color-mix(in srgb,var(--muted) 88%, transparent);flex:1 1 260px;text-align:right}
  .cs-config-subsection{display:flex;flex-direction:column;gap:.4rem}
  .cs-config-subsection + .cs-config-subsection{border-top:1px solid color-mix(in srgb,var(--border) 82%, transparent);margin-top:.35rem;padding-top:.95rem}
  .cs-config-subsection-head{display:flex;align-items:baseline;gap:.45rem;flex-wrap:wrap;margin-bottom:.05rem}
  .cs-config-subsection-title{margin:0;font-size:.84rem;font-weight:600;color:color-mix(in srgb,var(--text) 76%, transparent)}
  .cs-config-subsection-description{margin:0;font-size:.8rem;color:color-mix(in srgb,var(--muted) 88%, transparent);flex:1 1 auto;text-align:left}
  .cs-config-subsection > .cs-config-subsection-head + .cs-field{padding-top:0}
  .cs-field{margin:0;padding:.6rem 0;display:flex;flex-direction:column;gap:.4rem;position:relative}
  .cs-field + .cs-field{border-top:1px solid color-mix(in srgb,var(--border) 82%, transparent);margin-top:.35rem;padding-top:.95rem}
  .cs-field-head{display:flex;align-items:center;gap:.45rem;flex-wrap:wrap}
  .cs-field-inline-help .cs-field-head{align-items:baseline}
  .cs-field-label-wrap{display:flex;align-items:center;gap:.45rem;flex:1 1 auto;min-width:120px}
  .cs-field-inline-help .cs-field-label-wrap{align-items:baseline;gap:.4rem;flex-wrap:wrap}
  .cs-field-label-with-switch{gap:.6rem}
  .cs-field-action{margin-left:auto}
  .cs-field-label{font-weight:600;font-size:.9rem;color:color-mix(in srgb,var(--text) 86%, transparent);flex:0 1 auto;min-width:0}
  .cs-field-help{margin:0;font-size:.8rem;color:color-mix(in srgb,var(--muted) 88%, transparent)}
  .cs-field-inline-help .cs-field-help{flex:1 1 auto;min-width:120px}
  .cs-field-controls{display:flex;flex-wrap:wrap;gap:.4rem;align-items:center}
  .cs-field-controls-inline{flex-wrap:nowrap}
  .cs-field-head-switch{display:flex;align-items:center;gap:.4rem}
  .cs-localized-list{display:flex;flex-direction:column;gap:.35rem}
  .cs-localized-row{display:flex;flex-wrap:wrap;gap:.45rem;padding:.2rem 0}
  .cs-identity-grid,.cs-localized-list--grid,.cs-single-grid-fieldset,.cs-link-list{--cs-editor-row-gap:.35rem;--cs-editor-row-column-gap:.45rem;--cs-editor-control-height:1.95rem;--cs-editor-single-control-width:15rem}
  .cs-localized-list--grid{gap:var(--cs-editor-row-gap)}
  .cs-localized-row--grid{display:grid;grid-template-columns:minmax(88px,88px) minmax(0,1fr) minmax(72px,max-content);align-items:center;column-gap:var(--cs-editor-row-column-gap);row-gap:0;min-height:var(--cs-editor-control-height);padding:0}
  .cs-localized-input{flex:1 1 240px;min-width:180px}
  .cs-localized-row--grid .cs-localized-input{min-width:0}
  .cs-localized-row--grid .cs-lang-chip{justify-self:end}
  .cs-localized-row--multiline textarea.cs-localized-textarea{box-sizing:border-box;display:block;height:var(--cs-editor-control-height);min-height:var(--cs-editor-control-height);max-height:var(--cs-editor-control-height);padding-block:0;line-height:calc(var(--cs-editor-control-height) - 2px);resize:none;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;transition:height .18s ease,min-height .18s ease,max-height .18s ease,border-color .16s ease,box-shadow .16s ease,background .16s ease}
  .cs-localized-row--multiline.is-expanded,.cs-localized-row--multiline:has(textarea.cs-localized-textarea:focus){align-items:start}
  .cs-localized-row--multiline.is-expanded .cs-remove-lang,.cs-localized-row--multiline:has(textarea.cs-localized-textarea:focus) .cs-remove-lang{align-self:start}
  .cs-localized-row--multiline.is-expanded textarea.cs-localized-textarea{height:4.6rem;min-height:4.6rem;max-height:12rem;padding-block:.3rem;line-height:1.25;resize:vertical;overflow:auto;white-space:pre-wrap}
  .cs-localized-row--multiline:has(textarea.cs-localized-textarea:focus) textarea.cs-localized-textarea{height:4.6rem;min-height:4.6rem;max-height:12rem;padding-block:.3rem;line-height:1.25;resize:vertical;overflow:auto;white-space:pre-wrap}
  .cs-localized-row--grid .cs-remove-lang{align-self:center;margin-left:0;white-space:nowrap}
  .cs-lang-chip{display:inline-flex;align-items:center;gap:.3rem;padding:.18rem .55rem;border-radius:999px;background:color-mix(in srgb,var(--primary) 14%, var(--card));color:color-mix(in srgb,var(--primary) 95%, var(--text));font-size:.75rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
  .cs-identity-grid{display:flex;flex-direction:column;gap:var(--cs-editor-row-gap)}
  .cs-identity-row{display:grid;grid-template-columns:minmax(88px,max-content) minmax(0,1fr) minmax(0,3fr) minmax(72px,max-content);align-items:center;gap:var(--cs-editor-row-column-gap)}
  .cs-identity-head{align-items:end;padding:0 0 .1rem}
  .cs-identity-head-spacer{min-width:1px}
  .cs-identity-column-title{font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:color-mix(in srgb,var(--muted) 78%, transparent)}
  .cs-identity-lang{min-width:0;display:flex;align-items:center;justify-content:flex-end}
  .cs-identity-field{min-width:0;display:flex;flex-direction:column;gap:.2rem}
  .cs-identity-field .cs-input{min-width:0}
  .cs-identity-cell-label{display:none;font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:color-mix(in srgb,var(--muted) 78%, transparent)}
  .cs-identity-actions{display:flex;align-items:center;justify-content:flex-end;min-width:0}
  .cs-identity-remove{width:100%;min-width:72px;margin-left:0;white-space:nowrap}
  .cs-single-grid-fieldset{gap:0}
  .cs-single-grid{display:grid;grid-template-columns:var(--cs-editor-single-label-width,88px) minmax(0,var(--cs-editor-single-control-width));column-gap:var(--cs-editor-row-column-gap);row-gap:var(--cs-editor-row-gap);align-items:center;justify-content:start}
  .cs-single-grid-row{display:grid;grid-template-columns:subgrid;grid-column:1/-1;align-items:center;gap:var(--cs-editor-row-column-gap);min-height:var(--cs-editor-control-height);padding:0;position:relative}
  .cs-single-grid-label{display:inline-flex;align-items:center;justify-content:flex-end;gap:.35rem;min-width:0;font-weight:700;color:color-mix(in srgb,var(--text) 86%, transparent)}
  .cs-single-grid-title{font-size:.84rem;white-space:nowrap}
  .cs-single-grid-control{min-width:0;display:flex;align-items:center}
  .cs-single-grid-control .cs-input,.cs-single-grid-control .cs-select{width:100%;min-width:0}
  .cs-single-grid-switch{margin:0}
  .cs-help-tooltip-wrap{position:relative;display:inline-flex;align-items:center;flex:0 0 auto}
  .cs-help-tooltip{appearance:none;width:1rem;height:1rem;border-radius:999px;border:1px solid color-mix(in srgb,var(--primary) 42%, var(--border));background:color-mix(in srgb,var(--card) 99%, transparent);color:color-mix(in srgb,var(--primary) 88%, var(--text));font-size:.68rem;font-weight:700;line-height:1;display:inline-flex;align-items:center;justify-content:center;padding:0;cursor:help}
  .cs-help-tooltip:focus-visible{outline:2px solid color-mix(in srgb,var(--primary) 55%, transparent);outline-offset:2px}
  .cs-help-tooltip-bubble{position:absolute;left:0;bottom:calc(100% + .35rem);width:max-content;max-width:min(20rem,70vw);padding:.38rem .5rem;border:1px solid color-mix(in srgb,var(--border) 88%, transparent);border-radius:8px;background:color-mix(in srgb,var(--card) 99%, transparent);box-shadow:0 10px 24px rgba(15,23,42,0.14);color:color-mix(in srgb,var(--text) 82%, transparent);font-size:.76rem;line-height:1.3;font-weight:500;text-transform:none;letter-spacing:0;opacity:0;transform:translateY(3px);pointer-events:none;transition:opacity .14s ease,transform .14s ease;z-index:20}
  .cs-help-tooltip-wrap:hover .cs-help-tooltip-bubble,.cs-help-tooltip:focus-visible + .cs-help-tooltip-bubble{opacity:1;transform:translateY(0);pointer-events:auto}
  .cs-input{width:100%;min-height:1.95rem;padding:.3rem .5rem;border-radius:8px;border:1px solid color-mix(in srgb,var(--border) 80%, transparent);background:color-mix(in srgb,var(--card) 99%, transparent);color:var(--text);font-size:.84rem;line-height:1.25;font-family:inherit;transition:border-color .16s ease, box-shadow .16s ease, background .16s ease}
  .cs-input:focus{outline:none;border-color:color-mix(in srgb,var(--primary) 55%, var(--border));box-shadow:0 0 0 2px color-mix(in srgb,var(--primary) 18%, transparent)}
  textarea.cs-input{min-height:4.6rem;resize:vertical}
  .cs-input-small{max-width:220px}
  .cs-empty{padding:.7rem .85rem;border:1px dashed color-mix(in srgb,var(--border) 75%, transparent);border-radius:9px;background:color-mix(in srgb,var(--text) 2%, var(--card));color:color-mix(in srgb,var(--muted) 90%, transparent);font-size:.88rem}
  .cs-field[data-diff="changed"] .cs-empty{background:color-mix(in srgb,#f59e0b 10%, var(--card));border-color:color-mix(in srgb,#f59e0b 45%, var(--border));color:color-mix(in srgb,#b45309 72%, var(--text))}
  .cs-add-lang,.cs-add-link{align-self:flex-start}
  .cs-remove-lang,.cs-remove-link{margin-left:auto}
  .cs-select{min-width:200px;padding:.3rem .45rem;border-radius:8px;border:1px solid color-mix(in srgb,var(--border) 80%, transparent);background:color-mix(in srgb,var(--card) 99%, transparent);color:var(--text);font-size:.84rem;line-height:1.25;font-family:inherit;transition:border-color .16s ease, box-shadow .16s ease}
  .cs-select:focus{outline:none;border-color:color-mix(in srgb,var(--primary) 55%, var(--border));box-shadow:0 0 0 2px color-mix(in srgb,var(--primary) 18%, transparent)}
  .cs-link-list{display:flex;flex-direction:column;gap:var(--cs-editor-row-gap)}
  .cs-link-head{display:flex;align-items:end;gap:var(--cs-editor-row-column-gap);min-height:1.1rem;padding:0}
  .cs-link-head-spacer{width:1.95rem;flex:0 0 1.95rem}
  .cs-link-head-actions{flex:0 0 72px}
  .cs-link-row{display:flex;flex-wrap:wrap;align-items:flex-start;gap:var(--cs-editor-row-column-gap);min-height:var(--cs-editor-control-height);padding:0}
  .cs-link-row.is-dragging{pointer-events:none;border-radius:10px;background:color-mix(in srgb,var(--card) 98%, transparent);box-shadow:0 14px 30px rgba(15,23,42,0.16),0 4px 12px rgba(15,23,42,0.12)}
  .cs-link-row + .cs-link-row{margin-top:0}
  .cs-link-drop-placeholder{border:1px dashed color-mix(in srgb,var(--primary) 48%, var(--border));border-radius:10px;background:color-mix(in srgb,var(--primary) 8%, transparent);min-height:var(--cs-editor-control-height);box-sizing:border-box}
  .cs-link-field{flex:1 1 200px;min-width:160px;display:flex;flex-direction:column;gap:.25rem}
  .cs-link-field--label{flex:1 1 0}
  .cs-link-field--href{flex:3 1 0}
  .cs-link-field--compact{gap:.15rem}
  .cs-link-field-title{font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:color-mix(in srgb,var(--muted) 78%, transparent)}
  .cs-link-field-title--label{flex:1 1 0;min-width:160px}
  .cs-link-field-title--href{flex:3 1 0;min-width:160px}
  .cs-link-drag-handle{width:1.95rem;min-height:var(--cs-editor-control-height);align-self:flex-end;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:.16rem;padding:.25rem .45rem;border:0;background:transparent;box-shadow:none;border-radius:8px;cursor:grab;touch-action:none;color:color-mix(in srgb,var(--muted) 86%, transparent);box-sizing:border-box;user-select:none}
  .cs-link-drag-handle:hover{background:color-mix(in srgb,var(--text) 4%, transparent)}
  .cs-link-drag-handle:focus-visible{outline:2px solid color-mix(in srgb,var(--primary) 36%, transparent);outline-offset:2px;background:color-mix(in srgb,var(--primary) 8%, transparent)}
  .cs-link-drag-handle:active{cursor:grabbing}
  .cs-link-drag-handle span{display:block;width:.9rem;height:1px;border-radius:999px;background:currentColor}
  .cs-link-row.is-dragging .cs-link-drag-handle{border-color:transparent !important;background:color-mix(in srgb,var(--primary) 12%, transparent);color:color-mix(in srgb,var(--primary) 92%, var(--text))}
  .cs-link-row.is-dragging .cs-input{border-color:color-mix(in srgb,var(--primary) 45%, var(--border));box-shadow:0 0 0 2px color-mix(in srgb,var(--primary) 14%, transparent)}
  .cs-link-actions{display:flex;gap:.35rem;margin-left:auto;align-self:flex-end;padding-top:0}
  .cs-link-actions .btn-tertiary{min-height:var(--cs-editor-control-height)}
  .cs-remove-link{color:color-mix(in srgb,#dc2626 82%, var(--text))}
  .cs-remove-link:hover{background:color-mix(in srgb,#dc2626 12%, transparent);border-color:color-mix(in srgb,#dc2626 48%, transparent);color:#b91c1c}
  .cs-repo-grid{display:flex;align-items:flex-end;gap:.45rem;flex-wrap:nowrap;margin-top:.35rem}
  .cs-repo-path{display:flex;align-items:flex-end;gap:.35rem;flex:2 1 0;min-width:0;flex-wrap:nowrap}
  .cs-repo-field-group{display:flex;flex-direction:column;gap:.3rem;min-width:0}
  .cs-repo-field-group--owner{flex:1 1 0}
  .cs-repo-field-group--name{flex:1 1 0}
  .cs-repo-field-group--branch{flex:1 1 0}
  .cs-repo-field-title{padding-left:.55rem;font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:color-mix(in srgb,var(--muted) 78%, transparent)}
  .cs-repo-field{display:inline-flex;align-items:center;gap:.35rem;width:100%;padding:.22rem .55rem;border-radius:999px;border:1px solid color-mix(in srgb,var(--border) 78%, transparent);background:color-mix(in srgb,var(--card) 98%, transparent);transition:border-color .16s ease, box-shadow .16s ease}
  .cs-repo-field:focus-within{border-color:color-mix(in srgb,var(--primary) 50%, var(--border));box-shadow:0 0 0 2px color-mix(in srgb,var(--primary) 18%, transparent)}
  .cs-repo-field .cs-repo-input{border:0;background:transparent;padding:0;min-height:1.8rem;font-size:.84rem;line-height:1.25;color:var(--text);min-width:0;width:100%;flex:1 1 auto}
  .cs-repo-field .cs-repo-input:focus{outline:none;box-shadow:none}
  .cs-repo-field--owner{min-width:0}
  .cs-repo-field--name{min-width:0}
  .cs-repo-field--branch{min-width:0}
  .cs-repo-affix{font-size:.82rem;font-weight:600;color:color-mix(in srgb,var(--muted) 78%, transparent);text-transform:lowercase;letter-spacing:.04em}
  .cs-repo-icon-affix{width:1rem;height:1rem;display:inline-flex;align-items:center;justify-content:center;flex:0 0 1rem}
  .cs-repo-icon-affix svg{display:block;fill:currentColor}
  .cs-repo-divider{align-self:flex-end;padding-bottom:.48rem;font-size:1.1rem;font-weight:600;color:color-mix(in srgb,var(--muted) 82%, transparent)}
  .cs-publish-transport-settings{margin-top:.75rem;display:flex;flex-direction:column;gap:.6rem;width:100%;padding-top:.75rem;border-top:1px solid color-mix(in srgb,var(--border) 72%, transparent)}
  .cs-publish-transport-header{display:flex;align-items:center;justify-content:space-between;gap:.8rem;flex-wrap:wrap}
  .cs-publish-transport-title{font-size:.82rem;font-weight:700;color:color-mix(in srgb,var(--text) 88%, transparent)}
  .cs-publish-method-switch{margin-left:auto}
  .cs-connect-publish-settings,.cs-pat-publish-settings{display:flex;flex-direction:column;gap:.45rem;width:100%}
  .cs-connect-publish-settings[hidden],.cs-pat-publish-settings[hidden]{display:none}
  .cs-connect-url-field{width:100%}
  .cs-repo-field--connect-url{width:100%}
  .cs-repo-input--connect-url{font-family:var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)}
  .cs-connect-publish-grant{margin:0;font-size:.8rem}
  .cs-connect-publish-grant.is-error{color:color-mix(in srgb,#dc2626 88%, var(--text))}
  .cs-connect-help{margin:0;font-size:.8rem}
  .cs-token-settings{margin-top:.35rem;display:flex;flex-direction:column;gap:.45rem;width:100%}
  .cs-token-field{width:100%;max-width:100%}
  .cs-token-field input{min-height:1.8rem;background:transparent}
  .cs-repo-field--token{width:100%}
  .cs-repo-input--token{font-family:var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)}
  .cs-token-affix svg{fill:currentColor}
  .cs-token-clear,.cs-token-clear:hover,.cs-token-clear:focus-visible,.cs-token-clear:active{border:0!important;border-color:transparent!important;background:transparent!important;background-image:none!important;box-shadow:none!important;color:color-mix(in srgb,var(--muted) 84%, transparent);width:1.65rem;height:1.65rem;min-width:1.65rem;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;font:inherit;font-size:1.1rem;font-weight:400;line-height:1;cursor:pointer;padding:0;margin:0;text-decoration:none;outline:0;user-select:none}
  .cs-token-clear:hover,.cs-token-clear:focus-visible{background:color-mix(in srgb,var(--text) 6%, transparent)!important;color:color-mix(in srgb,var(--text) 82%, transparent);outline:0}
  .cs-token-clear[aria-disabled="true"]{opacity:.28;cursor:default;pointer-events:none;border:0!important;background:transparent!important;box-shadow:none!important}
  .cs-token-help{margin:0;font-size:.8rem}
  .cs-extra-list{margin:.2rem 0 0;padding-left:1.1rem;color:color-mix(in srgb,var(--muted) 90%, transparent);font-size:.88rem}
  .cs-extra-list li{margin:.2rem 0}
  .cs-switch{display:inline-flex;align-items:center;gap:.45rem;padding:.12rem .2rem;border-radius:999px;cursor:pointer;user-select:none;color:color-mix(in srgb,var(--text) 85%, transparent);transition:color .16s ease}
  .cs-switch-input{position:absolute;opacity:0;width:1px;height:1px;margin:-1px;border:0;padding:0;clip:rect(0 0 0 0);clip-path:inset(50%)}
  .cs-switch-track{position:relative;display:inline-flex;align-items:center;width:2.4rem;height:1.25rem;border-radius:999px;background:color-mix(in srgb,var(--text) 8%, var(--card));border:1px solid color-mix(in srgb,var(--border) 80%, transparent);padding:0 .15rem;transition:background .16s ease,border-color .16s ease}
  .cs-switch-thumb{width:1rem;height:1rem;border-radius:999px;background:color-mix(in srgb,var(--card) 98%, transparent);box-shadow:0 1px 2px rgba(15,23,42,0.2);transform:translateX(0);transition:transform .18s ease,background .18s ease,box-shadow .18s ease}
  .cs-switch[data-state="on"] .cs-switch-track{background:color-mix(in srgb,var(--primary) 45%, var(--card));border-color:color-mix(in srgb,var(--primary) 55%, var(--border))}
  .cs-switch[data-state="on"] .cs-switch-thumb{transform:translateX(1.05rem);background:color-mix(in srgb,var(--primary) 96%, var(--card));box-shadow:0 4px 10px color-mix(in srgb,var(--primary) 35%, transparent)}
  .cs-switch[data-state="mixed"] .cs-switch-track{background:color-mix(in srgb,#f59e0b 35%, var(--card));border-color:color-mix(in srgb,#f59e0b 55%, var(--border))}
  .cs-switch[data-state="mixed"] .cs-switch-thumb{background:color-mix(in srgb,#f59e0b 94%, var(--card));box-shadow:0 3px 8px color-mix(in srgb,#f59e0b 35%, transparent)}
  .cs-switch-input:focus-visible + .cs-switch-track{outline:2px solid color-mix(in srgb,var(--primary) 60%, transparent);outline-offset:2px}
  .cs-input[data-diff="changed"],.cs-select[data-diff="changed"],.cs-field[data-diff="changed"] .cs-input,.cs-field[data-diff="changed"] .cs-select,.cs-single-grid-row[data-diff="changed"] .cs-input,.cs-single-grid-row[data-diff="changed"] .cs-select{background:color-mix(in srgb,#f59e0b 10%, transparent);border-color:color-mix(in srgb,#f59e0b 45%, var(--border))}
  .cs-repo-field[data-diff="changed"],.cs-repo-grid[data-diff="changed"] .cs-repo-field,.cs-extra-list[data-diff="changed"] li{background:color-mix(in srgb,#f59e0b 10%, transparent);border-color:color-mix(in srgb,#f59e0b 45%, var(--border))}
  .cs-switch[data-diff="changed"] .cs-switch-track,.cs-field[data-diff="changed"] .cs-switch-track,.cs-single-grid-row[data-diff="changed"] .cs-switch-track{background:color-mix(in srgb,#f59e0b 18%, var(--card));border-color:color-mix(in srgb,#f59e0b 45%, var(--border))}
  @media (max-width:920px){
    .cs-layout{grid-template-columns:minmax(0,1fr);gap:1rem}
  }
  @media (max-width:880px){
    .cs-section{padding:.9rem .9rem}
    .cs-select{min-width:0;width:100%}
    .cs-input-small{max-width:100%}
    .cs-identity-row{grid-template-columns:minmax(74px,max-content) minmax(0,1fr) minmax(0,3fr) minmax(68px,max-content)}
    .cs-link-actions{width:100%;justify-content:flex-end;margin-left:0;align-self:auto;padding-top:.35rem}
  }
  @media (max-width:720px){
    .cs-section-description{text-align:left}
    .cs-identity-grid,.cs-localized-list--grid,.cs-single-grid-fieldset,.cs-link-list{--cs-editor-row-gap:.5rem}
    .cs-repo-grid,.cs-repo-path{flex-wrap:wrap}
    .cs-repo-path,.cs-repo-field-group--branch{flex:1 1 100%}
    .cs-repo-field-group--owner,.cs-repo-field-group--name{flex:1 1 calc(50% - .4rem)}
    .cs-localized-row--grid{grid-template-columns:1fr;gap:.35rem}
    .cs-localized-row--grid .cs-remove-lang{justify-self:flex-start}
    .cs-identity-grid{gap:.5rem}
    .cs-identity-head{display:none}
    .cs-identity-row{grid-template-columns:1fr;align-items:stretch;gap:.4rem;padding:.55rem 0;border-top:1px solid color-mix(in srgb,var(--border) 72%, transparent)}
    .cs-identity-head + .cs-identity-row{border-top:0;padding-top:.1rem}
    .cs-identity-cell-label{display:block}
    .cs-identity-actions{justify-content:flex-start}
    .cs-single-grid{grid-template-columns:1fr;row-gap:.35rem}
    .cs-single-grid-row{grid-template-columns:1fr;align-items:stretch;gap:.35rem;padding:.2rem 0}
  }

  /* Modal animations */
  @keyframes nsModalFadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes nsModalFadeOut { from { opacity: 1 } to { opacity: 0 } }
  @keyframes nsModalSlideIn { from { transform: translateY(10px) scale(.98); opacity: 0 } to { transform: translateY(0) scale(1); opacity: 1 } }
  @keyframes nsModalSlideOut { from { transform: translateY(0) scale(1); opacity: 1 } to { transform: translateY(8px) scale(.98); opacity: 0 } }
  .press-modal.press-anim-in { animation: nsModalFadeIn 160ms ease both; }
  .press-modal.press-anim-out { animation: nsModalFadeOut 160ms ease both; }
  .press-modal.press-anim-in .press-modal-dialog { animation: nsModalSlideIn 200ms cubic-bezier(.2,.95,.4,1) both; }
  .press-modal.press-anim-out .press-modal-dialog { animation: nsModalSlideOut 160ms ease both; }
  @media (prefers-reduced-motion: reduce){
    .press-modal.press-anim-in,
    .press-modal.press-anim-out,
    .press-modal.press-anim-in .press-modal-dialog,
    .press-modal.press-anim-out .press-modal-dialog { animation: none !important; }
  }
  `;
  const style = documentRef.createElement('style');
  style.id = 'composer-runtime-styles';
  style.textContent = css;
  documentRef.head.appendChild(style);
  return style;
}
