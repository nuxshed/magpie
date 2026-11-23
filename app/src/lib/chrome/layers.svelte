<script lang="ts">
  import { app, setpile } from '../board.svelte'
</script>

<div class="layers" class:right={app.pile} role="tablist" aria-label="Layer">
  <i class="thumb" aria-hidden="true"></i>
  <button type="button" role="tab" aria-selected={!app.pile} onclick={() => setpile(false)}>Canvas</button>
  <button type="button" role="tab" aria-selected={app.pile} title="Pile (I)" onclick={() => setpile(true)}>Pile</button>
</div>

<style>
  .layers {
    position: absolute;
    left: 50%;
    top: 12px;
    transform: translateX(-50%);
    z-index: 21;
    display: grid;
    grid-template-columns: 1fr 1fr;
    padding: 3px;
    border-radius: var(--r-l);
    background: var(--surface);
    box-shadow: var(--sh-0);
  }
  .thumb {
    position: absolute;
    left: 3px;
    top: 3px;
    bottom: 3px;
    width: calc(50% - 3px);
    border-radius: var(--r-m);
    background: var(--surface-2);
    box-shadow: var(--sh-0);
    transition: transform var(--d-glide) var(--ease-glide);
  }
  .right .thumb {
    transform: translateX(100%);
  }
  button {
    position: relative;
    appearance: none;
    border: 0;
    background: none;
    min-width: 76px;
    padding: 7px 12px;
    font: 13px/1 var(--f-ui);
    color: var(--ink-3);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border-radius: var(--r-m);
    transition: color var(--d-glide) var(--ease-glide);
  }
  button:hover,
  button[aria-selected='true'] {
    color: var(--ink);
  }
  button:focus-visible {
    outline: 2px solid var(--sel);
    outline-offset: 1px;
  }
  @media (prefers-reduced-motion: reduce) {
    .thumb {
      transition: none;
    }
  }
  @media (max-width: 640px) {
    .layers {
      top: auto;
      bottom: 8px;
      left: auto;
      right: 8px;
      transform: none;
    }
    button {
      min-width: 64px;
      padding: 9px 10px;
    }
  }
</style>
