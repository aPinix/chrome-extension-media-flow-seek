export const TOOLS_STYLES = `
:host{all:initial;color-scheme:dark;font:13px/1.45 system-ui,sans-serif;color:#f6f7fb;pointer-events:none}
*{box-sizing:border-box} [hidden]{display:none!important}
button,input,select{font:inherit;color:inherit}button{cursor:pointer;border:1px solid #ffffff26;background:#ffffff12;border-radius:8px;padding:6px 9px;white-space:nowrap}button:not(:disabled):hover{background:#ffffff26}button:disabled{opacity:.4;cursor:default}
button:focus-visible,input:focus-visible{outline:2px solid #a4c4ff;outline-offset:2px}
input:not([type=checkbox]):not([type=range]),select{background:#121720;border:1px solid #ffffff35;border-radius:6px;padding:5px;min-width:0;max-width:100%}input[type=number]{width:76px}input[type=range]{min-width:60px;width:100%;accent-color:#8db7ff}input[type=checkbox]{accent-color:#8db7ff}
.launcher{position:fixed;pointer-events:auto;background:#161b27e8;box-shadow:0 2px 16px #0008;padding:6px 10px}
.panel{position:fixed;pointer-events:auto;width:320px;max-width:calc(100vw - 16px);max-height:calc(100vh - 70px);overflow:auto;background:#151a24f5;border:1px solid #ffffff30;border-radius:14px;padding:14px;box-shadow:0 12px 40px #0008;backdrop-filter:blur(16px)}
header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}h2{font-size:14px;margin:0}h3{font-size:12px;margin:14px 0 7px;color:#aebace;text-transform:uppercase;letter-spacing:.06em}
.row{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:6px 0}.field{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:8px 0}.field>span{flex:1}.field input[type=range]{flex:1}
summary{cursor:pointer;color:#aebace;padding:8px 0}details{margin:6px 0}.muted{color:#aebace;font-size:12px;margin:6px 0}.status{color:#ffd399;white-space:normal;font-size:12px}.items{display:grid;gap:5px}.item{display:flex;gap:5px}.item button:first-child{flex:1;text-align:left;white-space:normal;overflow-wrap:anywhere}
.timeline{position:fixed;pointer-events:none;height:10px}.timeline.editing{height:32px;pointer-events:auto;background:#121a2ee8;border:1px solid #a4c4ff;border-radius:6px;touch-action:none;cursor:crosshair}
.range{position:absolute;top:0;bottom:0;background:#F3CD4533;border:1px solid #a4c4ff;pointer-events:auto;cursor:grab;min-width:3px}.handle{z-index:3;position:absolute;top:0;bottom:0;width:12px;padding:0;border:0;border-radius:2px;background:#F3CD45;cursor:ew-resize}.handle.start{left:-3px;transform:translateX(-100%)}.handle.end{right:-3px;transform:translateX(100%)}
.timeline.editing .range,.timeline.editing .saved-range{border:3px solid #F3CD45;border-radius:0}
.timeline.editing .handle{top:-3px;bottom:-3px;width:16px;background:#F3CD45!important;border-radius:2px;opacity:1}
.timeline.editing .handle.start{border-radius:5px 0 0 5px}.timeline.editing .handle.end{border-radius:0 5px 5px 0}
.timeline.editing .handle::after{content:"";position:absolute;left:50%;top:25%;bottom:25%;width:3px;transform:translateX(-50%);border-radius:999px;background:#332b0c}
.timeline.editing[data-loop-enabled=false] .range,.timeline.editing[data-loop-enabled=false] .saved-range{border-color:#F3CD45;background:#F3CD4522}
.loop-editor-actions{position:absolute;bottom:calc(100% + 12px);left:50%;transform:translateX(-50%);display:flex;gap:6px;padding:5px;border:1px solid #ffffff35;border-radius:999px;background:#202020f2;box-shadow:0 3px 12px #0006;pointer-events:auto;z-index:5}
.loop-editor-actions .fine-tune-loop[aria-pressed=true]{background:#f59e0b;color:#291500;border-color:#f59e0b}.loop-editor-actions .fine-tune-loop[aria-pressed=true]:not(:disabled):hover{background:#fbbf24}
.fine-tune-control{position:relative;display:inline-flex}
.fine-tune-help{position:absolute;bottom:calc(100% + 12px);right:0;width:240px;padding:10px 12px;border:1px solid #ffffff30;border-radius:10px;background:#202020f5;box-shadow:0 4px 16px #0005;color:#eee;font-size:12px;line-height:1.5;text-align:left;white-space:normal;opacity:0;visibility:hidden;pointer-events:none;z-index:10;transition:opacity 120ms ease}
.fine-tune-control:hover .fine-tune-help,.fine-tune-control:focus-within .fine-tune-help{opacity:1;visibility:visible}
.loop-edit-hint{position:absolute;bottom:calc(100% + 7px);left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:4px;padding:5px 9px;border:1px solid #ffffff26;border-radius:999px;background:#202020ee;color:#eee;font-size:11px;line-height:16px;white-space:nowrap;pointer-events:none}.loop-edit-hint kbd{padding:0 4px;border:1px solid #ffffff40;border-radius:4px;background:#ffffff12;font:inherit;font-weight:600}
.loop-editor-actions button{display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:999px;padding:7px 12px;font-size:12px;line-height:18px;font-weight:600}
.loop-editor-actions .close-loop-editor{background:#fff;color:#202020;border-color:transparent}.loop-editor-actions .close-loop-editor:not(:disabled):hover{background:#e4e4e4}
.loop-editor-actions .clear-loop-sections{background:transparent;color:#eee;border-color:transparent}.loop-editor-actions .clear-loop-sections:not(:disabled):hover{background:#ffffff20}
.loop-editor-actions .discard-loop-edits{color:#fca5a5;border-color:#f8717140;background:#ef444414}.loop-editor-actions .discard-loop-edits:not(:disabled):hover{color:#fecaca;background:#ef444430;border-color:#f8717180}
.timeline:not(.editing) .loop-editor-actions{display:none}

.delete-loop-section{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:4;width:24px;height:24px;display:flex;align-items:center;justify-content:center;padding:0;border:0;border-radius:999px;background:#F3CD45;color:#332b0c;font-size:20px;line-height:1;opacity:0;pointer-events:none}
.timeline.editing .range:hover .delete-loop-section,.timeline.editing .saved-range:hover .delete-loop-section,.timeline.editing .delete-loop-section:focus-visible{opacity:1;pointer-events:auto}
.delete-loop-section:not(:disabled):hover{background:#ffe477}
.timeline:not(.editing) .delete-loop-section,.timeline[data-dragging=true] .delete-loop-section{display:none}
.marker{position:absolute;top:0;width:8px;height:10px;padding:0;transform:translateX(-50%);background:#ffce75;border:1px solid #332300;pointer-events:auto;border-radius:2px}
.saved-range{z-index:2;position:absolute;bottom:1px;height:6px;padding:0;border-radius:1px;background:#F3CD45;pointer-events:auto;min-width:4px}
.loop-editor{width:auto;max-width:none;display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:10px;border-radius:12px 12px 4px 4px;transform-origin:bottom center;opacity:0;transform:translateY(16px) scaleY(.85);visibility:hidden;pointer-events:none;transition:opacity 200ms ease,transform 240ms ease,visibility 0s 240ms}
.loop-editor[data-open=true]{opacity:1;transform:translateY(0) scaleY(1);visibility:visible;pointer-events:auto;transition-delay:0s}
.loop-editor header{display:flex;gap:10px;margin:0}.loop-editor header h2{white-space:nowrap}.loop-editor .row{display:contents}.loop-editor .field{gap:5px;margin:0}.loop-editor .field input[type=number]{width:64px}.loop-editor .field input:not([type=number]){width:140px}.loop-editor .field>span{flex:none}.loop-editor .status{flex-basis:100%;margin:0;font-size:11px}.loop-editor .status:empty{display:none}.loop-editor .items{display:flex;gap:6px;overflow-x:auto;max-height:40px;flex-basis:100%}.loop-editor .item{flex:none}.loop-editor .item button:first-child{white-space:nowrap}.loop-editor .loop-hint{font-size:11px;color:#bac8dc}
.timeline{transition:height 220ms ease,background-color 220ms ease,border-color 220ms ease;border:1px solid transparent;transform-origin:bottom center}.timeline.editing{height:24px;background:#121a2ee8;border-color:#a4c4ff;overflow:visible}
.range,.saved-range{transition:opacity 200ms ease,transform 220ms ease;transform-origin:bottom;outline:none}.range{z-index:3;border-color:#F3CD45}.timeline:not(.editing) .range,.timeline:not(.editing) .saved-range{opacity:1;transform:none;pointer-events:auto;cursor:pointer;min-height:3px}
.timeline:not(.editing) .handle{display:none}
.timeline:not(.editing)[data-loop-enabled=false] .range,.timeline:not(.editing)[data-loop-enabled=false] .saved-range{pointer-events:none}
.timeline[data-loop-enabled=false] .range,.timeline[data-loop-enabled=false] .saved-range{background:#b3b3b355;border-color:#b3b3b380}
.timeline[data-loop-enabled=true] .range{background:#F3CD4555;border-color:#F3CD45}.saved-range{top:0;bottom:0;height:auto;background:#F3CD4522;border:1px solid #F3CD45;cursor:grab}.saved-range:hover{background:#F3CD4544}.saved-range .handle{opacity:.7}.handle{overflow:visible;touch-action:none}.handle .time-pill{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translate(-50%,4px);padding:4px 7px;border-radius:999px;background:#171e2c;color:#fff;border:1px solid #a4c4ff88;font-size:11px;font-variant-numeric:tabular-nums;line-height:1;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity 120ms ease,transform 120ms ease}
.handle:hover .time-pill,.handle:focus-visible .time-pill,.timeline[data-dragging=true] .range .time-pill{opacity:1;transform:translate(-50%,0)}.range.narrow .handle.end .time-pill{bottom:calc(100% + 34px)}
.timeline.editing[data-fine-tune=true] .range,.timeline.editing[data-fine-tune=true] .saved-range{border-color:#f59e0b;background:#f59e0b33}.timeline.editing[data-fine-tune=true][data-loop-enabled=true] .range{background:#f59e0b55}.timeline.editing[data-fine-tune=true] .saved-range:hover{background:#f59e0b44}.timeline.editing[data-fine-tune=true] .handle{background:#f59e0b!important}.timeline.editing[data-fine-tune=true] .handle::after{background:#291500}
.loop-editor-actions .fine-tune-loop,.timeline .handle{transition:background-color 200ms ease,color 200ms ease,border-color 200ms ease}.range,.saved-range{transition:opacity 200ms ease,transform 220ms ease,background-color 200ms ease,border-color 200ms ease}.handle::after{transition:background-color 200ms ease}
@media(prefers-reduced-motion:reduce){.loop-editor-actions .fine-tune-loop,.timeline .handle,.handle::after{transition:none}.loop-editor,.timeline,.range,.saved-range,.handle .time-pill{transition:none}}
.shade{position:fixed;background:#000;pointer-events:auto}
.mini-bar{position:fixed;pointer-events:auto;display:flex;gap:6px;align-items:center;justify-content:space-between;background:#151a24;border:1px solid #ffffff35;border-radius:8px 8px 0 0;padding:4px 8px;cursor:move;touch-action:none}.resize{position:fixed;pointer-events:auto;cursor:nwse-resize;touch-action:none}
.pip-controls{pointer-events:auto;display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px;background:#151a24;color:#fff}.pip-controls input[type=range]{width:100px}
`;

export function element<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className = '',
  text = ''
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}
export function button(
  doc: Document,
  text: string,
  action: () => void,
  parent: Node
): HTMLButtonElement {
  const node = element(doc, 'button', '', text);
  node.type = 'button';
  node.addEventListener('click', action);
  parent.appendChild(node);
  return node;
}
export function field(
  doc: Document,
  text: string,
  input: HTMLElement,
  parent: Node
): HTMLLabelElement {
  const label = element(doc, 'label', 'field');
  label.append(element(doc, 'span', '', text), input);
  parent.appendChild(label);
  return label;
}
export function numberInput(
  doc: Document,
  value: number,
  min: number,
  max: number,
  step: number,
  onChange: (value: number) => void
): HTMLInputElement {
  const input = element(doc, 'input');
  input.type = 'number';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.addEventListener('change', () => {
    if (input.checkValidity() && Number.isFinite(input.valueAsNumber))
      onChange(input.valueAsNumber);
  });
  return input;
}
