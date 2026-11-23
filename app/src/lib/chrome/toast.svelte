<script lang="ts">
  import { app, undo } from '../board.svelte'

  let held = $state(false)

  $effect(() => {
    const n = app.toast?.n
    if (!n || held) return
    const t = setTimeout(() => app.toast?.n === n && (app.toast = null), 4500)
    return () => clearTimeout(t)
  })

  /** slide up and fade in, fade out */
  function show(node: Element, { out = false } = {}) {
    const css = getComputedStyle(node)
    return {
      duration: parseFloat(css.getPropertyValue(out ? '--d-base' : '--d-glide')),
      easing: out ? undefined : (t: number) => 1 - (1 - t) ** 3,
      css: (t: number) => `opacity:${t};transform:translate(-50%, ${out ? 0 : (1 - t) * 12}px)`
    }
  }
</script>

{#if app.toast}
  {#key app.toast.n}
    <div
      class="toast"
      role="status"
      in:show
      out:show={{ out: true }}
      onpointerenter={() => (held = true)}
      onpointerleave={() => (held = false)}
    >
      <span>{app.toast.text}</span>
      {#if app.toast.back}<button type="button" onclick={() => ((held = false), undo())}>Undo</button>{/if}
    </div>
  {/key}
{/if}

<style>
  .toast {
    position: fixed;
    left: 50%;
    bottom: 16px;
    transform: translateX(-50%);
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 4px;
    max-width: calc(100vw - 32px);
    padding: 4px 4px 4px 14px;
    min-height: 38px;
    border-radius: var(--r-l);
    background: var(--ink);
    color: var(--canvas);
    box-shadow: var(--sh-pop);
    font: 13px var(--f-ui);
    white-space: nowrap;
  }
  span {
    padding-right: 10px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  button {
    flex: none;
    appearance: none;
    border: 0;
    margin-left: -4px;
    padding: 7px 10px;
    border-radius: var(--r-m);
    background: none;
    color: inherit;
    font: 600 13px var(--f-ui);
    cursor: pointer;
    transition: background var(--d-fast) var(--ease);
  }
  button:hover {
    background: color-mix(in srgb, var(--canvas) 14%, transparent);
  }
  button:focus-visible {
    outline: 2px solid var(--sel);
    outline-offset: 1px;
  }
  @media (max-width: 640px) {
    .toast {
      bottom: 60px;
    }
  }
</style>
