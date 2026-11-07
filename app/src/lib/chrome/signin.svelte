<script lang="ts">
  import { load, signin } from '../auth'

  let { onin }: { onin: () => void } = $props()
  let failed = $state(false)

  $effect(() => {
    load().catch(() => {})
  })

  async function go() {
    failed = false
    try {
      await signin()
      onin()
    } catch {
      failed = true
    }
  }
</script>

<main class="app signin">
  <h1>Magpie</h1>
  <p>Collect images, links and notes on boards that live in your Google Drive.</p>
  <button type="button" onclick={go}>Sign in with Google</button>
  {#if failed}<p class="err">Couldn't sign in. Try again.</p>{/if}
</main>

<style>
  .signin {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--canvas);
    color: var(--ink);
    padding: 0 24px;
    text-align: center;
  }
  h1 {
    margin: 0;
    font: 400 clamp(56px, 18vw, 88px) / 1 var(--f-display);
    letter-spacing: -0.01em;
  }
  p {
    margin: 14px 0 36px;
    font-size: 15px;
    color: var(--ink-2);
  }
  button {
    appearance: none;
    border: 0;
    border-radius: var(--r-m);
    background: var(--ink);
    color: var(--canvas);
    font: 500 14px/1 var(--f-ui);
    height: 44px;
    padding: 0 20px;
    cursor: pointer;
  }
  button:focus-visible {
    outline: 2px solid var(--sel);
    outline-offset: 2px;
  }
  .err {
    position: absolute;
    bottom: var(--s-9);
    margin: 0;
    font-size: 13px;
    color: var(--ink-3);
  }
</style>
